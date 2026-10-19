import { enemyDef, type AttackDef } from '../../../data/enemies';
import { PLAYER_ID, type Enemy } from '../actors/enemies';
import { startEnemyAttack, type AttackAim } from '../combat/enemyAttacks';
import { locomotionOf } from '../actors/locomotion';
import { attackSpeedMult, moveSpeedMult } from '../actors/rarity';
import type { GameState } from '../state';
import { hasLineOfSight, hasWalkLine } from '../world/los';
import { flowStep } from './flowField';

/**
 * Helpers shared by the per-kind behaviors. Each behavior reads `toPlayer` (filled by
 * measurePlayer at the start of the enemy's think) and writes the enemy's velocity and facing.
 */

/** Vector from the thinking enemy to the player: unit direction, distance, edge-to-edge gap. */
export const toPlayer = { ux: 0, uy: 0, dist: 0, gap: 0 };

// Scratch flow-field waypoint.
const waypoint = { x: 0, y: 0 };

/** Fills `toPlayer` for enemy `e`. On top of the player, the direction is the enemy's facing. */
export function measurePlayer(state: GameState, e: Enemy): void {
  const p = state.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  toPlayer.dist = d;
  toPlayer.gap = d - e.radius - state.tuning.player.radius;
  if (d > 0) {
    toPlayer.ux = dx / d;
    toPlayer.uy = dy / d;
  } else {
    toPlayer.ux = e.facingX;
    toPlayer.uy = e.facingY;
  }
}

/**
 * Re-checks line of sight and a straight walk path to the player into `e.ai`. A Blind enemy
 * (in smoke or steam, or the player is: DESIGN §6.4) sees nothing beyond tuning.terrain.blindRange.
 */
export function refreshSight(state: GameState, e: Enemy): void {
  const p = state.player;
  const room = state.room;
  if (e.terrain.blind) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const r = state.tuning.terrain.blindRange;
    if (dx * dx + dy * dy > r * r) {
      e.ai.los = e.ai.walkLine = false;
      return;
    }
  }
  e.ai.los = hasLineOfSight(room, e.x, e.y, p.x, p.y);
  // Floaters cross anything shots cross, so a clear shot is a clear path for them.
  e.ai.walkLine = e.ai.los && (locomotionOf(e.kind) === 'float' || hasWalkLine(room, e.x, e.y, p.x, p.y));
}

/** True on the ticks this enemy re-checks sight (every losCheckTicks, staggered by id). */
export function sightDue(state: GameState, e: Enemy): boolean {
  return (state.tick + e.id) % state.tuning.ai.losCheckTicks === 0;
}

/** Switches mode, restarting the mode timer only when the mode actually changes. */
export function setMode(e: Enemy, mode: string): void {
  if (e.ai.mode === mode) return;
  e.ai.mode = mode;
  e.ai.timer = 0;
}

/**
 * The enemy notices the player: targets them, rolls its approach offset, strafe side and
 * reaction delay from the AI stream, and re-checks sight now. Safe to call on any enemy (arena
 * spawns use it to arrive aggroed).
 */
export function aggro(state: GameState, e: Enemy): void {
  const ai = e.ai;
  const rng = state.aiRng;
  const t = state.tuning.ai;
  ai.targetId = PLAYER_ID;
  setMode(e, 'chase');
  // Uniform direction without trig: rejection-sample the unit disk, then normalize.
  let ox: number;
  let oy: number;
  let l2: number;
  do {
    ox = rng.range(-1, 1);
    oy = rng.range(-1, 1);
    l2 = ox * ox + oy * oy;
  } while (l2 > 1 || l2 === 0);
  const l = Math.sqrt(l2);
  ai.offsetX = ox / l;
  ai.offsetY = oy / l;
  ai.strafe = rng.chance(0.5) ? 1 : -1;
  const def = enemyDef(e.kind);
  const b = def.behavior;
  ai.strafeLeft = b.kind === 'kite' ? rng.range(b.strafeFlipMin, b.strafeFlipMax) : 0;
  const reaction = rng.range(0, t.reactionJitter);
  if (ai.cooldown < reaction) ai.cooldown = reaction;
  // M4: secondary attacks with a cadence wait a random part of it before their first use.
  const extra = def.extraAttacks;
  if (extra !== undefined)
    for (let k = 0; k < extra.length && k < ai.cooldowns.length; k++) {
      const every = extra[k]!.every;
      if (every !== undefined) ai.cooldowns[k] = rng.range(0, every);
    }
  refreshSight(state, e);
}

/** Back to idle: no target, standing still. */
export function deaggro(e: Enemy): void {
  e.ai.targetId = -1;
  setMode(e, 'idle');
  stop(e);
}

export function stop(e: Enemy): void {
  e.vx = 0;
  e.vy = 0;
}

/** Sets the velocity along the unit direction at `fraction` of the kind's top speed (× Hasted). */
export function moveAlong(e: Enemy, dirX: number, dirY: number, fraction: number): void {
  const haste = e.mods.length > 0 ? moveSpeedMult(e) : 1;
  const speed = enemyDef(e.kind).speed * fraction * haste;
  e.vx = dirX * speed;
  e.vy = dirY * speed;
}

/**
 * Walks toward (tx, ty): straight at it while a straight walk path to the player exists,
 * otherwise along the flow field toward the player (around pillars), at `fraction` of top speed.
 */
export function steerTo(state: GameState, e: Enemy, tx: number, ty: number, fraction: number): void {
  let gx = tx;
  let gy = ty;
  if (!e.ai.walkLine && flowStep(state.flow, e.x, e.y, waypoint)) {
    gx = waypoint.x;
    gy = waypoint.y;
  }
  const dx = gx - e.x;
  const dy = gy - e.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) {
    stop(e);
    return;
  }
  moveAlong(e, dx / d, dy / d, fraction);
}

/** Faces the current walking direction (no-op while standing still). */
export function faceVelocity(e: Enemy): void {
  const v2 = e.vx * e.vx + e.vy * e.vy;
  if (v2 === 0) return;
  const v = Math.sqrt(v2);
  e.facingX = e.vx / v;
  e.facingY = e.vy / v;
}

/**
 * Starts attack `def` along the unit direction (`aim`: a targeted attack's point, a line's
 * length), stops, and sets the next cooldown (the attack's cooldown plus up to cooldownJitter).
 * Returns false if it couldn't start.
 */
export function attack(
  state: GameState,
  e: Enemy,
  def: AttackDef,
  dirX: number,
  dirY: number,
  aim?: AttackAim,
): boolean {
  if (!startEnemyAttack(state, e, dirX, dirY, def, aim)) return false;
  const haste = e.mods.length > 0 ? attackSpeedMult(e) : 1;
  e.ai.cooldown = def.cooldown / haste + state.aiRng.range(0, state.tuning.ai.cooldownJitter);
  stop(e);
  setMode(e, 'windup');
  return true;
}

/**
 * A running dash (EnemySpecial.dashSpeed > 0: lunge, charge) sets the velocity along the dash at
 * its own speed, above the kind's top speed.
 */
export function dashVelocity(e: Enemy): void {
  const s = e.special;
  e.vx = s.dashX * s.dashSpeed;
  e.vy = s.dashY * s.dashSpeed;
}
