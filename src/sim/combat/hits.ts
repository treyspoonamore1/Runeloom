import { enemyDef } from '../../../data/enemies';
import { addKnockback } from '../actors/knockback';
import type { Enemy } from '../actors/enemies';
import { isInvulnerable, type PlayerState } from '../actors/player';
import { killPlayer } from '../actors/playerVitals';
import { emit, type DeathCause } from '../events';
import type { GameState } from '../state';
import { applyHitAilments, isFrozen, type AilmentTarget } from './ailments';
import { resolveHit, type DamagePacket, type DamageTarget, type HitResult } from './damage';

/** How a hit was delivered, besides its damage. */
export interface HitInfo {
  /** Attacker id (PLAYER_ID for the player). */
  sourceId: number;
  /** Unit knockback direction (0, 0 for none). */
  dirX: number;
  dirY: number;
  /** Knockback distance in cells, before the target's knockbackScale. */
  knockback: number;
  /** Hitstop seconds if this hit kills (Strike: feel.hitstopStrikeKill). */
  killHitstop?: number;
}

/**
 * Freezes the sim for `seconds` from the next step. Overlapping hitstops don't add up: the
 * longest pending one wins.
 */
export function addHitstop(state: GameState, seconds: number): void {
  if (seconds <= state.hitstopLeft) return;
  state.hitstopLeft = seconds;
  emit(state, { type: 'hitstop', seconds });
}

// Scratch target side for resolveHit; the sim is single-threaded.
const targetSide: DamageTarget = { resist: { physical: 0, fire: 0, frost: 0, storm: 0 }, shock: 0 };

function damageTarget(t: AilmentTarget): DamageTarget {
  targetSide.resist = t.resist;
  targetSide.shock = t.ailments.shock.effect;
  return targetSide;
}

/**
 * Applies a hit to an enemy or the player: resolves damage (DESIGN §7) with the combat RNG
 * stream and the target's Shock, subtracts life, adds knockback, emits 'hit', handles death and
 * hitstop, and, if the target survives, applies the hit's ailments (combat/ailments.ts).
 *
 * Player hits during i-frames are evaded: no damage, no knockback, no ailments, an 'evaded'
 * event, null. Hits on dead targets do nothing and return null. Dummies (immortal) reset to full
 * life at 0 instead of dying. A crit adds feel.hitstopCrit; killing a Frozen enemy shatters it
 * and adds feel.hitstopShatter.
 */
export function applyHit(
  state: GameState,
  target: Enemy | PlayerState,
  packet: DamagePacket,
  info: HitInfo,
): HitResult | null {
  if (target.dead) return null;
  if (target === state.player) return hitPlayer(state, state.player, packet, info);
  return hitEnemy(state, target as Enemy, packet, info);
}

function hitEnemy(state: GameState, e: Enemy, packet: DamagePacket, info: HitInfo): HitResult {
  const def = enemyDef(e.kind);
  const res = resolveHit(packet, damageTarget(e), state.combatRng);
  e.life -= res.total;
  const kb = info.knockback * def.knockbackScale;
  if (kb > 0) addKnockback(e, info.dirX, info.dirY, kb, state.tuning.feel);
  emit(state, {
    type: 'hit',
    target: e.id,
    sourceId: info.sourceId,
    amount: res.total,
    crit: res.crit,
    damageType: res.mainType,
    x: e.x,
    y: e.y,
    kbX: kb > 0 ? info.dirX : 0,
    kbY: kb > 0 ? info.dirY : 0,
  });
  if (res.crit) addHitstop(state, state.tuning.feel.hitstopCrit);
  if (e.life <= 0 && killEnemy(state, e, info.sourceId, 'hit')) {
    if (info.killHitstop !== undefined) addHitstop(state, info.killHitstop);
    return res;
  }
  applyHitAilments(state, e, packet, res, info.sourceId);
  return res;
}

/**
 * Life reached 0: the enemy dies (Shattering if it was Frozen) and 'death' is sent, crediting
 * `killerId`. A hit shatter adds feel.hitstopShatter; damage over time never adds hitstop
 * (DESIGN §4). Dummies (immortal) reset to full life instead. Returns true if it died.
 */
export function killEnemy(state: GameState, e: Enemy, killerId: number, cause: DeathCause): boolean {
  if (enemyDef(e.kind).immortal) {
    e.life = e.maxLife;
    return false;
  }
  const shattered = isFrozen(e);
  e.life = 0;
  e.dead = true;
  e.vx = e.vy = e.kbX = e.kbY = 0;
  emit(state, { type: 'death', id: e.id, kind: e.kind, x: e.x, y: e.y, killerId, cause, shattered });
  if (shattered && cause === 'hit') addHitstop(state, state.tuning.feel.hitstopShatter);
  return true;
}

function hitPlayer(state: GameState, p: PlayerState, packet: DamagePacket, info: HitInfo): HitResult | null {
  if (isInvulnerable(p)) {
    emit(state, { type: 'evaded', x: p.x, y: p.y, sourceId: info.sourceId });
    return null;
  }
  const res = resolveHit(packet, damageTarget(p), state.combatRng);
  if (!state.cheats.god) p.life -= res.total;
  const kb = info.knockback;
  if (kb > 0) addKnockback(p, info.dirX, info.dirY, kb, state.tuning.feel);
  emit(state, {
    type: 'hit',
    target: 'player',
    sourceId: info.sourceId,
    amount: res.total,
    crit: res.crit,
    damageType: res.mainType,
    x: p.x,
    y: p.y,
    kbX: kb > 0 ? info.dirX : 0,
    kbY: kb > 0 ? info.dirY : 0,
  });
  if (res.crit) addHitstop(state, state.tuning.feel.hitstopCrit);
  if (p.life <= 0) killPlayer(state);
  else applyHitAilments(state, p, packet, res, info.sourceId);
  return res;
}

/** Unit vector from (ax, ay) to (bx, by), or (fx, fy) when they coincide. */
export function directionOr(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  fx: number,
  fy: number,
): [number, number] {
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.sqrt(dx * dx + dy * dy);
  return d > 0 ? [dx / d, dy / d] : [fx, fy];
}
