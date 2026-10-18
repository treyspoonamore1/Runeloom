import { enemyDef } from '../../../data/enemies';
import { stepEnemyAI } from '../ai';
import { stepEnemyAttack } from '../combat/enemyAttacks';
import { DT } from '../core/constants';
import type { GameState } from '../state';
import { moveCircle, type CircleBody } from './collision';
import type { Enemy } from './enemies';
import { stepKnockback } from './knockback';

// Scratch: separation velocity per enemy index, neighbor query results, and a body for moveCircle.
let sepX = new Float64Array(64);
let sepY = new Float64Array(64);
const near: number[] = [];
const body: CircleBody = { x: 0, y: 0, vx: 0, vy: 0 };
// Separation push accumulated for the enemy being processed.
let accX = 0;
let accY = 0;

/**
 * The enemy phase of a tick:
 * 1. prevX/prevY ← position; rebuild state.enemyHash.
 * 2. Per enemy in array order: stepEnemyAI (decisions; may start attacks), then stepEnemyAttack
 *    (phase timers; attacks land on entering 'active').
 * 3. Soft separation from overlapping neighbors and the player, from positions before anyone moves.
 * 4. Per enemy: move by (AI velocity + separation) through moveCircle, then by knockback.
 * 5. Rebuild state.enemyHash at the new positions for spells and projectiles.
 * Dead enemies are skipped throughout.
 */
export function stepEnemies(state: GameState): void {
  const list = state.enemies;
  for (const e of list) {
    e.prevX = e.x;
    e.prevY = e.y;
  }
  state.enemyHash.rebuild(list);

  for (let i = 0; i < list.length; i++) {
    const e = list[i]!;
    if (e.dead) continue;
    stepEnemyAI(state, e);
    if (!e.dead) stepEnemyAttack(state, e);
  }

  computeSeparation(state);

  const feel = state.tuning.feel;
  for (let i = 0; i < list.length; i++) {
    const e = list[i]!;
    if (e.dead) continue;
    const mvx = e.vx + sepX[i]!;
    const mvy = e.vy + sepY[i]!;
    if (mvx !== 0 || mvy !== 0) {
      body.x = e.x;
      body.y = e.y;
      body.vx = mvx;
      body.vy = mvy;
      moveCircle(state.room, body, e.radius, mvx * DT, mvy * DT);
      e.x = body.x;
      e.y = body.y;
    }
    stepKnockback(state.room, e, e.radius, feel);
  }

  state.enemyHash.rebuild(list);
}

/**
 * Overlapping bodies push each other apart at separationStiffness × overlap cells/s (capped at
 * separationMaxSpeed). Each enemy only moves itself, so the pair splits the correction. The player
 * pushes enemies but is never pushed. Enemies with knockbackScale 0 (dummies) are never moved, but
 * still push others. Exactly coincident bodies split along x by array order.
 */
function computeSeparation(state: GameState): void {
  const list = state.enemies;
  const n = list.length;
  if (sepX.length < n) {
    let cap = sepX.length;
    while (cap < n) cap *= 2;
    sepX = new Float64Array(cap);
    sepY = new Float64Array(cap);
  }
  sepX.fill(0, 0, n);
  sepY.fill(0, 0, n);
  const t = state.tuning.enemies;
  const p = state.player;
  const pr = state.tuning.player.radius;
  for (let i = 0; i < n; i++) {
    const e = list[i]!;
    if (e.dead || enemyDef(e.kind).knockbackScale === 0) continue;
    accX = 0;
    accY = 0;
    const count = state.enemyHash.queryCircle(e.x, e.y, e.radius, near);
    for (let k = 0; k < count; k++) {
      const j = near[k]!;
      if (j === i) continue;
      const o = list[j]!;
      if (o.dead) continue;
      pushFrom(e, o.x, o.y, o.radius, i < j ? -1 : 1, t.separationStiffness);
    }
    if (!p.dead) pushFrom(e, p.x, p.y, pr, -1, t.separationStiffness);
    let px = accX;
    let py = accY;
    const sp2 = px * px + py * py;
    const max = t.separationMaxSpeed;
    if (sp2 > max * max) {
      const k = max / Math.sqrt(sp2);
      px *= k;
      py *= k;
    }
    sepX[i] = px;
    sepY[i] = py;
  }
}

/** Adds to (accX, accY) the push on `e` away from a body at (ox, oy) with radius `or`. */
function pushFrom(e: Enemy, ox: number, oy: number, or: number, tieSign: number, stiffness: number): void {
  const dx = e.x - ox;
  const dy = e.y - oy;
  const rr = e.radius + or;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return;
  const d = Math.sqrt(d2);
  const push = (rr - d) * stiffness;
  if (d === 0) {
    accX += tieSign * push;
    return;
  }
  accX += (dx / d) * push;
  accY += (dy / d) * push;
}
