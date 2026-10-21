/**
 * Spawning and ending spell instances (DESIGN §5.3): instance counts and fan rotations, the
 * per-cast and global spawn caps, Echo scheduling, and On Expire on the way out.
 */
import { damageTypes } from '../../../../data/combatTypes';
import { weaveLimits, type ElementId, type TriggerId } from '../../../../data/runes';
import { spindles, type SpindleImplicit } from '../../../../data/spindles';
import { PLAYER_ID } from '../../actors/enemies';
import { zeroAmounts, type DamagePacket } from '../../combat/damage';
import { emit, type ProjectileEndReason } from '../../events';
import type { GameState } from '../../state';
import type { HeroMods } from '../../hero/mods';
import { specPacket } from '../packet';
import type { SpellProgram, SpellSpec } from '../program';
import { initForm, resolveInstant } from './forms';
import { rotateInto } from './geom';
import { fireOnExpire } from './procs';
import { paintOnEnd } from './terrain';
import type { CastRecord, SpawnAt, SpellEndReason, SpellInstance } from './types';

/** Opens the record for one fire of a weave slot (or of a program outside the slots: slot -1). */
export function openCast(
  state: GameState,
  slot: number,
  trigger: TriggerId,
  program: SpellProgram,
): CastRecord {
  const w = state.weaves;
  const cast: CastRecord = {
    id: state.nextCastId++,
    slot,
    trigger,
    notation: program.notation,
    spindleId: w.spindleId,
    capacity: w.capacity,
    program,
    spawned: 0,
    dropped: 0,
    refs: 0,
  };
  state.casts.push(cast);
  state.stats.fires++;
  return cast;
}

/** Packets are shared and never mutated, so one per (spec, spindle, character, damage factor) is cached. */
const packetCache = new WeakMap<
  SpellSpec,
  { spindleId: string; mods: HeroMods; damageMult: number; packet: DamagePacket }[]
>();

/**
 * The hit packet for `spec` on the current spindle and character, with an extra damage factor
 * (Echo). Shared; never mutate. The character's HeroMods Core group adds increased damage by type
 * (with a spindle item equipped, its implicit arrives this way too), increased damage for branch
 * spells (depth ≥ 1) and added crit chance. Without a spindle item (sandbox, arena, lab) the
 * spindle id's implicit applies as before M4. Neutral mods leave the packet exactly as before.
 */
export function buildPacket(state: GameState, spec: SpellSpec, damageMult: number): DamagePacket {
  const spindleId = state.weaves.spindleId;
  const mods = state.heroMods;
  let list = packetCache.get(spec);
  if (list === undefined) packetCache.set(spec, (list = []));
  for (const c of list)
    if (c.spindleId === spindleId && c.mods === mods && c.damageMult === damageMult) return c.packet;
  const packet = specPacket(spec, damageMult !== 1 ? [damageMult] : []);
  packet.ailmentDuration = spec.ailmentDurationMult;
  const imp: SpindleImplicit =
    state.hero.equipped.spindle === null ? spindles[spindleId].implicit : NO_IMPLICIT;
  let by: DamagePacket['increasedByType'];
  if (imp.increased) {
    by = zeroAmounts();
    for (const t of damageTypes) by[t] = imp.increased[t] ?? 0;
  }
  for (const t of damageTypes)
    if (mods.damageInc[t] !== 0) {
      by ??= zeroAmounts();
      by[t] += mods.damageInc[t];
    }
  if (by) packet.increasedByType = by;
  if (spec.depth >= 1 && mods.branchDamageInc !== 0) packet.increased += mods.branchDamageInc;
  if (mods.critChanceAdd !== 0) packet.critChance += mods.critChanceAdd;
  // The character's chill build-up (chillGainInc) scales chill points in ailmentScale
  // (hero/effectsCombat.ts); only a sandbox spindle id's implicit still rides on the packet.
  if (imp.chillGain) packet.chillGain = 1 + imp.chillGain;
  list.push({ spindleId, mods, damageMult, packet });
  return packet;
}

const NO_IMPLICIT: SpindleImplicit = {};

const elementCache = new WeakMap<SpellSpec, ElementId[]>();

/** The elements a spec deals, in slot order (for events; shared, never mutate). */
export function elementsOf(spec: SpellSpec): ElementId[] {
  let e = elementCache.get(spec);
  if (e === undefined) elementCache.set(spec, (e = spec.elements.map((x) => x.element)));
  return e;
}

/** Shared empty list for fields an instance never fills (no children; hit cooldowns off Orbs). */
const NONE: number[] = [];

const rot = { x: 0, y: 0 };

/**
 * Spawns `spec`'s instances (Split: one per fan rotation, in order) at `at`, counting each
 * against the cast's spawn cap and the global live cap, then schedules its Echo. Instant forms
 * (Beam, Strike, Swath) resolve their hits right away, so their branches spawn before the next
 * instance: tree order, then index (DESIGN §5.3).
 */
export function spawnSpell(state: GameState, cast: CastRecord, spec: SpellSpec, at: SpawnAt): void {
  const { count, rotations } = spec.instances;
  const packet = buildPacket(state, spec, at.damageMult);
  for (let i = 0; i < count; i++) {
    if (!claimSpawn(state, cast, spec)) continue;
    const r = rotations[i]!;
    rotateInto(at.dirX, at.dirY, r, rot);
    const dirX = rot.x;
    const dirY = rot.y;
    rotateInto(at.aimX - at.x, at.aimY - at.y, r, rot);
    const inst = createInstance(state, cast, spec, at, packet, dirX, dirY);
    initForm(state, inst, at, at.x + rot.x, at.y + rot.y);
    announce(state, cast, inst);
    resolveInstant(state, inst);
  }
  if (spec.echo && !at.echo) {
    cast.refs++;
    state.pendingSpells.push({
      castId: cast.id,
      cast,
      spec,
      delayLeft: spec.echo.delay,
      queuedTick: state.tick,
      at: { ...at, echo: true, damageMult: at.damageMult * spec.echo.damageMult },
    });
  }
}

/** True (and counted) if the cast may spawn one more instance; else counts the drop and sends 'spawnDropped'. */
function claimSpawn(state: GameState, cast: CastRecord, spec: SpellSpec): boolean {
  if (cast.spawned >= cast.program.spawnCap) {
    cast.dropped++;
    state.stats.dropped++;
    emit(state, {
      type: 'spawnDropped',
      castId: cast.id,
      slot: cast.slot,
      form: spec.form,
      depth: spec.depth,
    });
    return false;
  }
  cast.spawned++;
  makeRoom(state);
  return true;
}

/**
 * Fork (M5, CONTENT §1.4): on a bolt's first hit, its fork bolts start at (x, y) along its
 * direction turned by each fork rotation (±40°), with the fork's short life. They are instances
 * of the same spell (same packet, procs and branches) that never fork again and can't hit the
 * enemy that was just hit; each counts against the cast's spawn cap.
 */
export function spawnForks(
  state: GameState,
  parent: SpellInstance,
  hitId: number,
  x: number,
  y: number,
): void {
  const fork = parent.spec.fork;
  if (fork === null || parent.form !== 'bolt') return;
  const cast = parent.cast;
  for (const r of fork.rotations) {
    if (!claimSpawn(state, cast, parent.spec)) continue;
    rotateInto(parent.dirX, parent.dirY, r, rot);
    const at: SpawnAt = {
      x,
      y,
      dirX: rot.x,
      dirY: rot.y,
      aimX: x + rot.x,
      aimY: y + rot.y,
      sourceId: parent.sourceId,
      echo: parent.echo,
      damageMult: 1,
      fromPlayer: false,
    };
    const inst = createInstance(state, cast, parent.spec, at, parent.packet, rot.x, rot.y);
    initForm(state, inst, at, at.aimX, at.aimY);
    inst.forked = true;
    inst.lifeLeft = fork.life;
    inst.hitIds.push(hitId);
    announce(state, cast, inst);
  }
}

/** 'spellSpawn' (and 'projectileSpawn' for bolts) for a new instance. */
function announce(state: GameState, cast: CastRecord, inst: SpellInstance): void {
  const spec = inst.spec;
  emit(state, {
    type: 'spellSpawn',
    id: inst.id,
    castId: cast.id,
    slot: cast.slot,
    form: spec.form,
    elements: elementsOf(spec),
    depth: spec.depth,
    echo: inst.echo,
    x: inst.x,
    y: inst.y,
    dirX: inst.dirX,
    dirY: inst.dirY,
    toX: inst.toX,
    toY: inst.toY,
    followsPlayer: inst.followsPlayer,
    params: spec.params,
  });
  if (spec.form === 'bolt')
    emit(state, {
      type: 'projectileSpawn',
      id: inst.id,
      kind: boltKind(spec),
      team: 'player',
      ownerId: PLAYER_ID,
      x: inst.x,
      y: inst.y,
      vx: inst.vx,
      vy: inst.vy,
      radius: inst.radius,
    });
}

/** M1 projectile kind for a player bolt, for render and audio: '<first element>_bolt'. */
export function boltKind(spec: SpellSpec): string {
  const el = spec.elements[0]?.element;
  return el === undefined ? 'physical_bolt' : BOLT_KINDS[el];
}

const BOLT_KINDS: Record<ElementId, string> = {
  fire: 'fire_bolt',
  frost: 'frost_bolt',
  storm: 'storm_bolt',
  tide: 'tide_bolt',
  gale: 'gale_bolt',
};

function createInstance(
  state: GameState,
  cast: CastRecord,
  spec: SpellSpec,
  at: SpawnAt,
  packet: DamagePacket,
  dirX: number,
  dirY: number,
): SpellInstance {
  const n = spec.children.length;
  const inst: SpellInstance = {
    id: state.nextId++,
    castId: cast.id,
    cast,
    slot: cast.slot,
    form: spec.form,
    spec,
    depth: spec.depth,
    sourceId: at.sourceId,
    echo: at.echo,
    packet,
    x: at.x,
    y: at.y,
    prevX: at.x,
    prevY: at.y,
    dirX,
    dirY,
    vx: 0,
    vy: 0,
    radius: 0,
    age: 0,
    lifeLeft: 0,
    pierceLeft: spec.pierce,
    chainLeft: spec.chain?.count ?? 0,
    fromX: at.x,
    fromY: at.y,
    toX: at.x,
    toY: at.y,
    cx: at.x,
    cy: at.y,
    followsPlayer: false,
    hitIds: [],
    hitCooldowns: spec.form === 'orb' ? [] : NONE,
    hitCount: 0,
    procs: n === 0 ? NONE : new Array<number>(n).fill(0),
    emitLeft: n === 0 ? NONE : spec.children.map((c) => (c.proc.kind === 'emit' ? c.proc.interval : 0)),
    refunded: 0,
    terrainR: 0,
    terrainLeft: 0,
    forked: false,
    returning: false,
    ended: false,
    endReason: null,
  };
  state.spells.push(inst);
  cast.refs++;
  state.stats.spells++;
  return inst;
}

/** Global cap (DESIGN §5.3): at most maxLivePlayerInstances live; the oldest expires first. */
function makeRoom(state: GameState): void {
  const cap = weaveLimits.maxLivePlayerInstances;
  const list = state.spells;
  for (let i = 0; state.stats.spells >= cap && i < list.length; i++) {
    const s = list[i]!;
    if (s.ended) continue;
    state.stats.evicted++;
    endSpell(state, s, 'evicted');
  }
}

const PROJECTILE_REASON: Record<SpellEndReason, ProjectileEndReason> = {
  expired: 'expired',
  hit: 'hit',
  blocked: 'blocked',
  wall: 'wall',
  done: 'expired',
  evicted: 'expired',
};

/**
 * Ends an instance where it stands (set x, y first). Sends 'spellEnd' (and 'projectileEnd' for
 * bolts), then, unless the global cap evicted it, paints its terrain footprint (Bolt, Beam, Lob,
 * Strike, Swath; runtime/terrain.ts) and fires its On Expire branches from there.
 * `stoppedOn`: the enemy it stopped on, which its On Expire spells spawn from.
 */
export function endSpell(
  state: GameState,
  inst: SpellInstance,
  reason: SpellEndReason,
  stoppedOn = -1,
): void {
  if (inst.ended) return;
  inst.ended = true;
  inst.endReason = reason;
  inst.vx = inst.vy = 0;
  inst.cast.refs--;
  state.stats.spells--;
  emit(state, {
    type: 'spellEnd',
    id: inst.id,
    castId: inst.castId,
    form: inst.form,
    x: inst.x,
    y: inst.y,
    reason,
  });
  if (inst.form === 'bolt')
    emit(state, {
      type: 'projectileEnd',
      id: inst.id,
      kind: boltKind(inst.spec),
      x: inst.x,
      y: inst.y,
      reason: PROJECTILE_REASON[reason],
    });
  if (reason === 'evicted') return;
  paintOnEnd(state, inst);
  fireOnExpire(state, inst, stoppedOn);
}
