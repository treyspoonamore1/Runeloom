import { enemyDef } from '../../../data/enemies';
import { addKnockback } from '../actors/knockback';
import { PLAYER_ID, type Enemy } from '../actors/enemies';
import { isInvulnerable, type PlayerState } from '../actors/player';
import { killPlayer } from '../actors/playerVitals';
import { emit, type DeathCause } from '../events';
import { onEnemyKilled } from '../hero/onKill';
import type { GameState } from '../state';
import { applyHitAilments, isFrozen, teamOfSource, type AilmentTarget } from './ailments';
import { arcShock } from './arcs';
import { deathTerrain, dousedTakenMult } from '../actors/chemistry';
import { noteHurt, noteKill } from '../weave/runtime/queue';
import { resolveHit, zeroAmounts, type DamagePacket, type DamageTarget, type HitResult } from './damage';

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
  /** The player spell instance dealing it, for the 'hit' event. */
  spellId?: number;
  /** OWNER code of the team dealing it (rule 19 arcs reach who that team can hurt). Default: the team of sourceId. */
  owner?: number;
  /** A rule 19 arc: applies no ailments of its own and never arcs again (one generation). */
  arc?: boolean;
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
  targetSide.takenMult = 'kind' in t ? dousedTakenMult(t) : 1;
  return targetSide;
}

/** After a hit landed on a live target: its ailments (unless it's an arc), then rule 19 arcs. */
function afterHit(
  state: GameState,
  t: AilmentTarget,
  packet: DamagePacket,
  res: HitResult,
  info: HitInfo,
): void {
  if (info.arc) return;
  applyHitAilments(state, t, packet, res, info.sourceId);
  if (res.byType.storm > 0)
    arcShock(state, t, packet, res, info.sourceId, info.owner ?? teamOfSource(info.sourceId));
}

/**
 * Applies a hit to an enemy or the player: resolves damage (DESIGN §7) with the combat RNG
 * stream and the target's Shock, subtracts life, adds knockback, emits 'hit', handles death and
 * hitstop, and, if the target survives, applies the hit's ailments (combat/ailments.ts) and,
 * when it carried Storm damage onto a Wet target, its rule 19 arcs (combat/arcs.ts).
 *
 * Player hits during i-frames are evaded: no damage, no knockback, no ailments, an 'evaded'
 * event, null. Hits on dead targets do nothing and return null. Dummies (immortal) reset to full
 * life at 0 instead of dying. A crit adds feel.hitstopCrit; killing a Frozen enemy shatters it
 * and adds feel.hitstopShatter. Player kills and hits on the player are noted for the Harvest
 * and On Hurt triggers (weave/runtime/queue.ts).
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
    byType: res.byType,
    spellId: info.spellId,
  });
  if (res.crit) addHitstop(state, state.tuning.feel.hitstopCrit);
  if (e.life <= 0 && killEnemy(state, e, info.sourceId, 'hit')) {
    if (info.killHitstop !== undefined) addHitstop(state, info.killHitstop);
    return res;
  }
  afterHit(state, e, packet, res, info);
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
  if (killerId === PLAYER_ID) noteKill(state, e.id, e.x, e.y);
  if (shattered && cause === 'hit') addHitstop(state, state.tuning.feel.hitstopShatter);
  if (cause !== 'console') {
    deathTerrain(state, e, killerId, shattered);
    onEnemyKilled(state, e, killerId, cause);
  }
  return true;
}

/**
 * Damage that ignores resistances, Shock and i-frames (a fall, rule 25): subtracts life (not
 * from the player in god mode), sends 'hit' and handles death. A hit on the player counts for
 * On Hurt. Does nothing to a dead target.
 */
export function dealDirectDamage(
  state: GameState,
  t: Enemy | PlayerState,
  amount: number,
  sourceId: number,
): void {
  if (t.dead || amount <= 0) return;
  const player = t === state.player;
  if (!player || !state.cheats.god) t.life -= amount;
  const byType = zeroAmounts();
  byType.physical = amount;
  emit(state, {
    type: 'hit',
    target: player ? 'player' : (t as Enemy).id,
    sourceId,
    amount,
    crit: false,
    damageType: 'physical',
    x: t.x,
    y: t.y,
    kbX: 0,
    kbY: 0,
    byType,
  });
  if (player) {
    const p = t as PlayerState;
    if (p.maxLife > 0) noteHurt(state, amount / p.maxLife);
    if (p.life <= 0) killPlayer(state);
  } else if (t.life <= 0) killEnemy(state, t as Enemy, sourceId, 'hit');
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
    byType: res.byType,
  });
  if (res.crit) addHitstop(state, state.tuning.feel.hitstopCrit);
  if (p.maxLife > 0) noteHurt(state, res.total / p.maxLife);
  if (p.life <= 0) killPlayer(state);
  else afterHit(state, p, packet, res, info);
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
