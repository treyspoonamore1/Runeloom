import { modImmune } from '../actors/rarity';
import { igniteImmune } from '../hero/uniques';
import type { AilmentKind } from '../../../data/combatTypes';
import { enemyDef } from '../../../data/enemies';
import type { Tuning } from '../../../data/tuning';
import type { Enemy } from '../actors/enemies';
import type { PlayerState } from '../actors/player';
import { emit } from '../events';
import type { GameState } from '../state';
import type { DamagePacket, HitResult } from './damage';
import { OWNER } from '../../../data/materials';
import { PLAYER_ID } from '../actors/enemies';
import { isWet } from '../actors/terrainState';
import { ailmentScale, kindredTargets } from '../hero/effectsCombat';

/**
 * Entity ailments (DESIGN §6.4): Ignite, Chill, Freeze and Shock on enemies and the player.
 * This file holds the state, the queries other systems use (isFrozen, actionSpeed, shockEffect)
 * and the apply functions. Per-tick decay and ignite damage are in ailmentTick.ts.
 *
 * Every ailment record is always present (no nulls) and inactive when its timer is 0, so state
 * hashes and copies stay flat. Magnitudes from a hit use that hit's damage of the matching type
 * after resistance and before Shock (Shock never feeds itself or double-dips into Ignite).
 *
 * Terrain (M3, actors/terrain.ts) calls applyIgnite (refresh mode) for burning ground; Wet
 * blocks Ignite (igniteBlocked) and multiplies chill gain (chillGain); Oiled doubles Ignite
 * damage (ailmentTick.ts).
 */

/** Damage over time from a fire hit. Active while timeLeft > 0. */
export interface IgniteState {
  /** Fire damage per second, the target's fire resistance already applied, before Shock. */
  dps: number;
  /** Seconds left; 0 when not ignited. */
  timeLeft: number;
  /** Who applied it (PLAYER_ID for the player): its damage and kills are credited to them. -1 if none. */
  sourceId: number;
  /**
   * OWNER code (data/materials.ts) of the team that ignited it: the fire it lights as it walks
   * over flammable cells (rule 22) and its Oiled trail (rule 18) belong to that team.
   */
  owner: number;
}

/** Can't act. Active while timeLeft > 0. */
export interface FreezeState {
  /** Seconds left frozen; 0 when not frozen. */
  timeLeft: number;
  /** Seconds left during which the target can't be frozen (boss rule; 0 for everyone else). */
  immuneLeft: number;
}

/** Increased damage taken. Active while timeLeft > 0. */
export interface ShockState {
  /** Increased damage taken as a fraction (0.2 = 20%); 0 when not shocked. */
  effect: number;
  /** Seconds left; 0 when not shocked. */
  timeLeft: number;
}

/** All ailments on one entity (Enemy.ailments, PlayerState.ailments). Hashed. */
export interface Ailments {
  ignite: IgniteState;
  /** Chill points, 0 to tuning.ailments.freezeThreshold. Slows movement and actions. */
  chill: number;
  freeze: FreezeState;
  shock: ShockState;
  /** Ignite damage dealt since the last 'dot' event (damage-number batching). */
  dotPending: number;
  /** Seconds until the next 'dot' event while ignited. */
  dotReportLeft: number;
}

/** Anything that can suffer ailments. */
export type AilmentTarget = Enemy | PlayerState;

type AilmentTuning = Tuning['ailments'];

/** Timers and thresholds within this of their limit count as reached (absorbs float rounding). */
export const AILMENT_EPSILON = 1e-9;

export function createAilments(): Ailments {
  return {
    ignite: { dps: 0, timeLeft: 0, sourceId: -1, owner: OWNER.world },
    chill: 0,
    freeze: { timeLeft: 0, immuneLeft: 0 },
    shock: { effect: 0, timeLeft: 0 },
    dotPending: 0,
    dotReportLeft: 0,
  };
}

/** Clears every ailment in place (death, respawn). Sends no events. */
export function clearAilments(a: Ailments): void {
  a.ignite.dps = a.ignite.timeLeft = 0;
  a.ignite.sourceId = -1;
  a.ignite.owner = OWNER.world;
  a.chill = 0;
  a.freeze.timeLeft = a.freeze.immuneLeft = 0;
  a.shock.effect = a.shock.timeLeft = 0;
  a.dotPending = a.dotReportLeft = 0;
}

/** The enemy, or null for the player. */
export function asEnemy(t: AilmentTarget): Enemy | null {
  return 'kind' in t ? t : null;
}

/** How events name the target: the enemy's id, or 'player'. */
export function targetRef(t: AilmentTarget): number | 'player' {
  return 'kind' in t ? t.id : 'player';
}

/** True if the target uses the boss chill rule. */
export function isBoss(t: AilmentTarget): boolean {
  const e = asEnemy(t);
  return e !== null && enemyDef(e.kind).isBoss === true;
}

/** True if the target never suffers `kind`. Chill immunity also prevents Freeze. Player immunities come with gear (M4+). */
export function isImmune(t: AilmentTarget, kind: AilmentKind): boolean {
  const e = asEnemy(t);
  if (e === null) return false;
  // M5 monster mods: Frostbound (chill, freeze), Grounded (shock).
  if (e.mods.length > 0 && modImmune(e, kind)) return true;
  const immune = enemyDef(e.kind).immune;
  if (immune === undefined) return false;
  return immune.includes(kind) || (kind === 'freeze' && immune.includes('chill'));
}

export function isFrozen(t: AilmentTarget): boolean {
  return t.ailments.freeze.timeLeft > 0;
}

export function isIgnited(t: AilmentTarget): boolean {
  return t.ailments.ignite.timeLeft > 0;
}

/** Shock as a fraction of increased damage taken (0 when not shocked). */
export function shockEffect(t: AilmentTarget): number {
  return t.ailments.shock.effect;
}

/** Slow from chill: 0.3% per point, at most 30% (bosses 15%). */
export function chillSlow(state: GameState, t: AilmentTarget): number {
  const A = state.tuning.ailments;
  const max = isBoss(t) ? A.bossChillSlowMax : A.chillSlowMax;
  const s = t.ailments.chill * A.chillSlowPerPoint;
  return s < max ? s : max;
}

/**
 * Multiplier on how fast the target moves and acts this tick: 0 while frozen, else 1 − chill
 * slow. The single place chill and freeze change speed: enemy movement, AI timers and turning,
 * attack phases, player walking and casting all scale by it.
 */
export function actionSpeed(state: GameState, t: AilmentTarget): number {
  if (isFrozen(t)) return 0;
  const a = t.ailments;
  return a.chill > 0 ? 1 - chillSlow(state, t) : 1;
}

/** Wet extinguishes and prevents Ignite (rule 15; the terrain phase puts out a burning entity that gets wet). */
function igniteBlocked(t: AilmentTarget): boolean {
  return isWet(t);
}

/** Chill gain multiplier: tuning.ailments.wetChillMultiplier while Wet (DESIGN §6.4). */
function chillGain(t: AilmentTarget, A: AilmentTuning): number {
  return isWet(t) ? A.wetChillMultiplier : 1;
}

/** OWNER code of the team behind an attacker id: the player, the world (WORLD_SOURCE_ID, -1) or an enemy. */
export function teamOfSource(sourceId: number): number {
  return sourceId === PLAYER_ID ? OWNER.player : sourceId < 0 ? OWNER.world : OWNER.enemy;
}

/** OWNER code of the target's own team. */
export function teamOf(t: AilmentTarget): number {
  return 'kind' in t ? OWNER.enemy : OWNER.player;
}

/**
 * The Shock effect a hit of `storm` damage (after resistance, before Shock) gives the target:
 * clamp(storm ÷ max life × shockPerLifeFraction, shockMin, shockMax), before the player cap.
 */
export function shockFor(state: GameState, t: AilmentTarget, storm: number): number {
  const A = state.tuning.ailments;
  const raw = (storm / t.maxLife) * A.shockPerLifeFraction;
  return raw < A.shockMin ? A.shockMin : raw > A.shockMax ? A.shockMax : raw;
}

/**
 * Applies the ailments a resolved hit carries (DESIGN §6.4) to a live target: Ignite from its
 * fire part, Chill (and maybe Freeze) from its frost part, Shock from its storm part. Durations
 * are scaled by packet.ailmentDuration; chill points by packet.chillGain (spindle implicit).
 * The player's passives and Fuse parts scale durations and effects on top (ailmentScale,
 * hero/effectsCombat.ts; neutral for every other source).
 */
export function applyHitAilments(
  state: GameState,
  t: AilmentTarget,
  packet: DamagePacket,
  res: HitResult,
  sourceId: number,
): void {
  const A = state.tuning.ailments;
  const durMul = packet.ailmentDuration ?? 1;
  const unshock = (1 + res.shock) * res.takenMult;
  const fire = res.byType.fire / unshock / (res.fireTakenMult ?? 1);
  const frost = res.byType.frost / unshock;
  const storm = res.byType.storm / unshock;
  const k = ailmentScale(state, sourceId);
  if (fire > 0)
    applyIgnite(
      state,
      t,
      fire * A.igniteDpsFraction * k.igniteDps,
      A.igniteDuration * durMul * k.igniteDuration,
      sourceId,
    );
  if (frost > 0) {
    const points = isBoss(t) ? A.bossChillPerHit : (frost / t.maxLife) * A.chillPerLifeFraction;
    // Same association as before M4 (points × wet × implicit), so neutral mods change nothing.
    const total = points * chillGain(t, A) * (packet.chillGain ?? 1) * k.chillPoints;
    addChill(state, t, total, durMul * k.freezeDuration, sourceId, k.freezeAdd);
  }
  if (storm > 0)
    applyShock(
      state,
      t,
      shockFor(state, t, storm) * k.shockEffect,
      A.shockDuration * durMul * k.shockDuration,
      sourceId,
    );
}

/**
 * Ignites the target for `dps` (resistance already applied) over `duration` seconds, unless it
 * is immune, Wet, or already burning at least as strongly. A replacing ignite keeps the dot
 * report timer. `owner`: the igniting team (OWNER code), by default the team of `sourceId`.
 *
 * `refresh` (terrain fire, rule 16 "refreshed while standing in it"): an ignite of the same
 * strength has its time topped up to `duration` (no event); a stronger one is left alone.
 *
 * Kindred Flame (M7 mutation): when the player's fire newly ignites an enemy, Oiled or Ignited
 * enemies beside it (hero/effectsCombat.ts kindredTargets) are ignited too, for the same time and
 * the same strength before fire resistance. One hop: those don't spread further.
 */
export function applyIgnite(
  state: GameState,
  t: AilmentTarget,
  dps: number,
  duration: number,
  sourceId: number,
  owner = teamOfSource(sourceId),
  refresh = false,
): boolean {
  if (!igniteOnce(state, t, dps, duration, sourceId, owner, refresh)) return false;
  const e = owner === OWNER.player ? asEnemy(t) : null;
  if (e === null || e.resist.fire >= 1) return true;
  const raw = dps / (1 - e.resist.fire);
  for (const n of kindredTargets(state, e))
    igniteOnce(state, n, raw * (1 - n.resist.fire), duration, sourceId, owner, false);
  return true;
}

function igniteOnce(
  state: GameState,
  t: AilmentTarget,
  dps: number,
  duration: number,
  sourceId: number,
  owner: number,
  refresh: boolean,
): boolean {
  if (dps <= 0 || duration <= 0 || isImmune(t, 'ignite') || igniteBlocked(t)) return false;
  if (igniteImmune(state, t)) return false; // Kiln-Heart Cloak (hero/uniques.ts).
  const a = t.ailments;
  const ig = a.ignite;
  if (ig.timeLeft > 0 && dps <= ig.dps) {
    if (refresh && dps === ig.dps && ig.timeLeft < duration) {
      ig.timeLeft = duration;
      ig.sourceId = sourceId;
      ig.owner = owner;
    }
    return false;
  }
  if (ig.timeLeft <= 0) a.dotReportLeft = state.tuning.ailments.dotReportInterval;
  ig.dps = dps;
  ig.timeLeft = duration;
  ig.sourceId = sourceId;
  ig.owner = owner;
  emitApplied(state, t, 'ignite', dps, duration, sourceId);
  return true;
}

/** Puts out a burning target (Wet, rule 15): ends its Ignite with an 'ailmentEnded' event. */
export function extinguish(state: GameState, t: AilmentTarget): void {
  const a = t.ailments;
  if (a.ignite.timeLeft <= 0) return;
  a.ignite.dps = a.ignite.timeLeft = 0;
  a.ignite.sourceId = -1;
  a.ignite.owner = OWNER.world;
  a.dotPending = 0;
  a.dotReportLeft = 0;
  emit(state, { type: 'ailmentEnded', target: targetRef(t), ailment: 'ignite', x: t.x, y: t.y });
}

/**
 * Adds chill points (capped at freezeThreshold). Nothing builds while frozen. Reaching the
 * threshold freezes the target, unless it is immune to Freeze or in its boss immunity window;
 * `freezeDurationMul` scales that freeze, then `freezeAdd` seconds are added (Deep Freeze).
 * Sends 'ailmentApplied' with the new chill total and the seconds it takes to decay.
 */
export function addChill(
  state: GameState,
  t: AilmentTarget,
  points: number,
  freezeDurationMul: number,
  sourceId: number,
  freezeAdd = 0,
): void {
  if (points <= 0 || isImmune(t, 'chill') || isFrozen(t)) return;
  // M4: the Superheated Cinder Warden builds chill only while standing in water (DESIGN §10.3).
  const boss = asEnemy(t)?.boss;
  if (boss && boss.chillNeedsWater && !boss.inWater) return;
  const A = state.tuning.ailments;
  const a = t.ailments;
  const bossRule = isBoss(t);
  const sum = a.chill + points;
  a.chill = sum < A.freezeThreshold ? sum : A.freezeThreshold;
  emitApplied(state, t, 'chill', a.chill, a.chill / (bossRule ? A.bossChillDecay : A.chillDecay), sourceId);
  if (a.chill < A.freezeThreshold - AILMENT_EPSILON) return;
  if (isImmune(t, 'freeze') || a.freeze.immuneLeft > 0) return;
  const base = bossRule ? A.bossFreezeDuration : A.freezeDuration;
  freezeTarget(state, t, base * freezeDurationMul + freezeAdd, sourceId);
}

/**
 * Freezes the target for `duration` seconds (at most playerFreezeMax on the player). Consumes
 * its chill. An enemy stops and loses an attack still in windup; the player's cast and dodge
 * end on their next tick (actors/player.ts, combat/casting.ts).
 */
export function freezeTarget(state: GameState, t: AilmentTarget, duration: number, sourceId: number): void {
  if (duration <= 0 || isImmune(t, 'freeze')) return;
  const A = state.tuning.ailments;
  const e = asEnemy(t);
  const d = e === null && duration > A.playerFreezeMax ? A.playerFreezeMax : duration;
  const a = t.ailments;
  a.chill = 0;
  a.freeze.timeLeft = d;
  t.vx = t.vy = 0;
  if (e !== null && e.attack.phase === 'windup') {
    e.attack.phase = 'none';
    e.attack.timeLeft = 0;
  }
  emit(state, { type: 'freeze', target: targetRef(t), duration: d, sourceId, x: t.x, y: t.y });
}

/**
 * Shocks the target for `duration` seconds with `effect` increased damage taken (at most
 * playerShockMax on the player), unless immune or already shocked at least as strongly.
 */
export function applyShock(
  state: GameState,
  t: AilmentTarget,
  effect: number,
  duration: number,
  sourceId: number,
): boolean {
  if (effect <= 0 || duration <= 0 || isImmune(t, 'shock')) return false;
  const A = state.tuning.ailments;
  const eff = asEnemy(t) === null && effect > A.playerShockMax ? A.playerShockMax : effect;
  const sh = t.ailments.shock;
  if (sh.timeLeft > 0 && eff <= sh.effect) return false;
  sh.effect = eff;
  sh.timeLeft = duration;
  emitApplied(state, t, 'shock', eff, duration, sourceId);
  return true;
}

function emitApplied(
  state: GameState,
  t: AilmentTarget,
  ailment: 'ignite' | 'chill' | 'shock',
  magnitude: number,
  duration: number,
  sourceId: number,
): void {
  emit(state, {
    type: 'ailmentApplied',
    target: targetRef(t),
    ailment,
    magnitude,
    duration,
    sourceId,
    x: t.x,
    y: t.y,
  });
}
