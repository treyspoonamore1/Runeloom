/**
 * Spell runtime state (BUILD_PLAN M2 task 4): what compiled weaves (SpellProgram) become in the
 * world. Everything here is plain data in GameState and hashed (hash.ts), except where noted.
 *
 * Lifecycle: a trigger fires a weave slot (triggers.ts) → a CastRecord is opened and the root
 * SpellSpec spawns its instances (spawn.ts) → instances step every tick (step.ts, forms/*) and
 * fire branches (procs.ts) → ended instances are removed at the end of the step, and a cast
 * record goes when nothing of its tree is left.
 */
import type { FormId, TriggerEvent, TriggerId } from '../../../../data/runes';
import type { SpindleId } from '../../../../data/spindles';
import type { DamagePacket } from '../../combat/damage';
import type { SpellProgram, SpellSpec } from '../program';

/**
 * Why an instance ended (the 'spellEnd' event):
 * - 'expired': its life ran out (Bolt, Orb, Sigil).
 * - 'hit': it stopped on an enemy (Bolt without Pierce left; Beam that used all its targets).
 * - 'blocked': a Shieldbearer's shield stopped it (Bolt, Beam). Counts as stopping on an enemy.
 * - 'wall': it hit a wall (Bolt; Beam cut short by a wall).
 * - 'done': it finished its job (Nova fully expanded, Lob landed and burst, Strike, Swath, Beam
 *   that reached full length).
 * - 'evicted': the global cap of live player instances removed it (oldest first). No On Expire.
 */
export type SpellEndReason = 'expired' | 'hit' | 'blocked' | 'wall' | 'done' | 'evicted';

/**
 * One live player spell instance, in `state.spells` in spawn order (ended ones are removed at
 * the end of each step). Enemy arrows stay in `state.projectiles`.
 *
 * Render: interpolate (prevX, prevY) → (x, y) with the frame alpha; `spec.params` holds the shape
 * numbers (radius, length, width, orbit, reach, …). Per form:
 * - bolt: (x, y) is the center, (vx, vy) its velocity, `radius` its collision radius. Also sends
 *   the M1 'projectileSpawn' / 'projectileEnd' events with kind `<element>_bolt`.
 * - nova: ring centered on (cx, cy); `radius` is the ring's current radius (0 → params.radius
 *   over params.expandTime).
 * - beam: instant; lives for the tick it fires. Draw from the 'beamFire' event.
 * - lob: flies from (fromX, fromY) to (toX, toY) over params.flightTime; (x, y) is the ground
 *   point under it (draw the arc height yourself from `age / params.flightTime`). Bursts on
 *   landing with params.burstRadius ('lobLand' event).
 * - orb: (x, y) is the orb; it circles (cx, cy) (the player when `followsPlayer`) at
 *   params.orbitRadius; `radius` is its hit radius.
 * - strike: instant; the arc is at (x, y) along (dirX, dirY) with params.reach / halfAngleCos.
 * - swath: instant; the strip starts at (x, y) along (dirX, dirY), params.length × params.width.
 * - sigil: stationary at (x, y) for params.duration; emits only.
 */
export interface SpellInstance {
  /** Unique for the run, from state.nextId (shared with enemies and projectiles). */
  id: number;
  /** The fire (CastRecord.id) whose tree this instance belongs to. */
  castId: number;
  /** That fire's record (same object as in state.casts; hashed there, by castId here). */
  cast: CastRecord;
  /** Weave slot that fired the root, or -1 (bench, tests). */
  slot: number;
  form: FormId;
  /** Compiled node this instance runs. Shared with the program; never mutated. Not hashed (see CastRecord). */
  spec: SpellSpec;
  /** 0 for the root spell, +1 per branch. */
  depth: number;
  /** Entity it spawned from (a branch's hit or killed target, an On Crit target), or -1. It can't hit it unless spec.canHitSource. */
  sourceId: number;
  /** This instance is an Echo repeat (it doesn't echo again). */
  echo: boolean;
  /** Damage per hit, built at spawn (spec, Echo, spindle). Chain jumps add their falloff on top. Shared, never mutated. */
  packet: DamagePacket;
  x: number;
  y: number;
  /** Position at the start of the current tick, for render interpolation. */
  prevX: number;
  prevY: number;
  /** Unit direction: flight (bolt, lob), aim (beam, strike, swath, nova, sigil), offset from center (orb). */
  dirX: number;
  dirY: number;
  /** Bolt velocity, cells/s (0 for other forms). */
  vx: number;
  vy: number;
  /** Bolt collision radius, Nova current ring radius, Orb hit radius, Lob burst radius; 0 otherwise. */
  radius: number;
  /** Seconds alive. */
  age: number;
  /** Seconds until it ends on its own (bolt life, nova expansion, lob flight, orb or sigil duration). */
  lifeLeft: number;
  /** Bolt: extra targets it may still pass through. */
  pierceLeft: number;
  /** Bolt and Beam: Chain jumps left (spent on its first hit). */
  chainLeft: number;
  /** Lob: launch and landing points. */
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Nova and Orb: center (the orb's follows the player while `followsPlayer`). */
  cx: number;
  cy: number;
  /** Orb: circles the player (true) or the fixed point (cx, cy). */
  followsPlayer: boolean;
  /** Ids hit so far (or blocked by), in order; nothing is hit twice except by an Orb after its interval. */
  hitIds: number[];
  /** Orb only, parallel to hitIds: seconds until that target can be hit again (a shared empty list on other forms). */
  hitCooldowns: number[];
  /** Direct hits landed (area forms fire On Hit on the first only). */
  hitCount: number;
  /** Per child branch (spec.children order): times it fired from this instance. */
  procs: number[];
  /** Per child branch: seconds until the next Emit (0 for other branches). */
  emitLeft: number[];
  /** Mana restored by this instance ("Closer pays more"), capped per instance. */
  refunded: number;
  /** Nova: terrain radius painted so far (runtime/terrain.ts); 0 for other forms. */
  terrainR: number;
  /** Orb: seconds until it paints its trail footprint again (0 at spawn: paints on its first tick). */
  terrainLeft: number;
  /** Ended this tick; removed at the end of the step. */
  ended: boolean;
  endReason: SpellEndReason | null;
}

/**
 * One fire of a weave: owns the per-cast spawn cap. Kept while any instance or pending Echo of
 * its tree is alive. The program is derived from (notation, spindleId, capacity), which is what
 * the hash covers.
 */
export interface CastRecord {
  id: number;
  slot: number;
  trigger: TriggerId;
  notation: string;
  spindleId: SpindleId;
  capacity: number | null;
  /** Not hashed: derived from the fields above. */
  program: SpellProgram;
  /** Instances spawned so far across the tree (Echo and children included). */
  spawned: number;
  /** Spawns dropped by the per-cast cap. */
  dropped: number;
  /** Live instances and pending spawns that belong to it; removed at 0. */
  refs: number;
}

/** An Echo repeat waiting for its delay (DESIGN §5.3: same origin and aim, its own damage mult). */
export interface PendingSpawn {
  castId: number;
  /** The record for castId (hashed in state.casts). */
  cast: CastRecord;
  spec: SpellSpec;
  /** Seconds left; it starts counting down on the tick after `queuedTick`. */
  delayLeft: number;
  queuedTick: number;
  at: SpawnAt;
}

/** Where and how a spell spawns. */
export interface SpawnAt {
  x: number;
  y: number;
  /** Unit aim direction (Nova ignores it except for its On Expire direction). */
  dirX: number;
  dirY: number;
  /** Aim point (Lob landing, Sigil placement), clamped to the form's range at spawn. */
  aimX: number;
  aimY: number;
  /** Entity it spawned from, or -1. */
  sourceId: number;
  /** An Echo repeat. */
  echo: boolean;
  /** Extra damage factor for this spawn (Echo 0.8), 1 for none. */
  damageMult: number;
  /** Orb: circle the player instead of (x, y). True when the spell starts at the player. */
  fromPlayer: boolean;
}

/**
 * Something that may fire an event trigger, queued by the system where it happened (dodge in
 * actors/player.ts, kill and hurt in combat/hits.ts, crit in procs.ts) and consumed at the next
 * trigger phase (triggers.ts). Only queued while some slot listens for it.
 */
export interface TriggerQueueEntry {
  event: TriggerEvent;
  /** Killed or crit enemy id; -1 otherwise. */
  targetId: number;
  /** Where it happened: dodge start, killed or crit target, the player when hurt. */
  x: number;
  y: number;
  /** Dodge direction, or the crit hit's direction; 0 otherwise. */
  dirX: number;
  dirY: number;
  /** 'hurt': the hit's damage as a fraction of max life. */
  amount: number;
}

/**
 * Debug counters for the overlay ("spells", "dropped"). Not hashed: `spells` is derived from
 * `state.spells`, the rest only count.
 */
export interface SpellStats {
  /** Live player spell instances. */
  spells: number;
  /** Spawns dropped by per-cast caps since the game started. */
  dropped: number;
  /** Instances removed by the global cap since the game started. */
  evicted: number;
  /** Weave fires since the game started. */
  fires: number;
}
