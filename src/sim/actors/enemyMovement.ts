import { enemyDef } from '../../../data/enemies';
import { stepEnemyAI } from '../ai';
import { actionSpeed, isFrozen } from '../combat/ailments';
import { stepEnemyAttack } from '../combat/enemyAttacks';
import { DT } from '../core/constants';
import type { GameState } from '../state';
import { moveCircle, type CircleBody } from './collision';
import type { Enemy } from './enemies';
import { stepKnockback } from './knockback';
import { readGround } from './ground';
import { isStunned } from './terrainState';
import { stepEnemyPassive } from '../ai/passive';
import { floatRoom, swimMove, traitsOf } from './locomotion';
import { fenMoveMult } from './fenChemistry';

// Scratch: separation velocity per enemy index and a body for moveCircle.
let sepX = new Float64Array(64);
let sepY = new Float64Array(64);
const body: CircleBody = { x: 0, y: 0, vx: 0, vy: 0 };
// Separation push (x, y) accumulated for the enemy being processed. A typed array, not module
// `let`s: writing a float to a module variable allocates a heap number every time.
const acc = new Float64Array(2);

/**
 * The enemy phase of a tick:
 * 1. prevX/prevY ← position; rebuild state.enemyHash.
 * 2. Per enemy in array order: stepEnemyPassive (M4 chemistry and boss bookkeeping, even when
 *    Frozen: ai/passive.ts), then stepEnemyAI (decisions; may start attacks), then
 *    stepEnemyAttack (phase timers; attacks land on entering 'active'). Frozen and stunned
 *    (doused Tinderling) enemies skip the last two and stand still.
 * 3. Soft separation from overlapping neighbors and the player, from positions before anyone moves.
 *    Frozen enemies aren't pushed (they still push others).
 * 4. Per enemy: move by (walking velocity + separation) through moveCircle, then by knockback
 *    (Frozen enemies are still knocked back). Walking velocity = AI velocity × actionSpeed (Chill)
 *    × the ground's moveMult, eased on ice (walkVelocity). Floaters collide only with
 *    shot-blocking cells; swimmers stay on water (actors/locomotion.ts).
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
    stepEnemyPassive(state, e);
    if (e.dead) continue;
    if (isFrozen(e) || isStunned(e)) {
      e.vx = e.vy = 0;
      continue;
    }
    stepEnemyAI(state, e);
    if (!e.dead) stepEnemyAttack(state, e);
  }

  computeSeparation(state);

  const feel = state.tuning.feel;
  for (let i = 0; i < list.length; i++) {
    const e = list[i]!;
    if (e.dead) continue;
    walkVelocity(state, e);
    const ts = e.terrain;
    const mvx = ts.slideX + sepX[i]!;
    const mvy = ts.slideY + sepY[i]!;
    const traits = traitsOf(e.kind);
    // M8: a Stranded swimmer crawls over anything shots cross (rule 31, actors/strand.ts).
    const crawling = traits.swims && e.special.stranded;
    const room = traits.floats || crawling ? floatRoom(state.room) : state.room;
    if (mvx !== 0 || mvy !== 0) {
      body.x = e.x;
      body.y = e.y;
      body.vx = mvx;
      body.vy = mvy;
      if (traits.swims && !crawling) swimMove(state, body, mvx * DT, mvy * DT);
      else if (moveCircle(room, body, e.radius, mvx * DT, mvy * DT) && ts.onIce) {
        // Sliding into a wall loses the part of the slide pointing into it.
        ts.slideX = body.vx - sepX[i]!;
        ts.slideY = body.vy - sepY[i]!;
      }
      e.x = body.x;
      e.y = body.y;
    }
    stepKnockback(room, e, e.radius, feel);
  }

  state.enemyHash.rebuild(list);
}

/**
 * The enemy's actual walking velocity into terrain.slideX/Y: the AI's wanted velocity × action
 * speed (Chill) × the ground's moveMult. On ice it eases toward that at the kind's top speed per
 * iceAccelTime (iceDecelTime when stopping), so enemies slide too.
 */
function walkVelocity(state: GameState, e: Enemy): void {
  let ts = e.terrain;
  const traits = traitsOf(e.kind);
  if (traits.groundless) {
    // Floating (or fixed): the ground neither slows nor slides it.
    ts.moveMult = 1;
    ts.onIce = false;
  } else ts = readGround(state, e.x, e.y, ts, traits.unslowed);
  // M8: a Cracked Slagshell is slower (actors/fenChemistry.ts).
  const k = actionSpeed(state, e) * ts.moveMult * fenMoveMult(e);
  const wx = e.vx * k;
  const wy = e.vy * k;
  // M8: a dash (the Mirebull's charge on ice) runs at its own speed; it doesn't ease in.
  if (!ts.onIce || e.special.dashSpeed > 0) {
    ts.slideX = wx;
    ts.slideY = wy;
    return;
  }
  const T = state.tuning.terrain;
  const top = enemyDef(e.kind).speed;
  // After a dash on ice it slides on from no faster than its top speed.
  const s2 = ts.slideX * ts.slideX + ts.slideY * ts.slideY;
  if (s2 > top * top) {
    const c = top / Math.sqrt(s2);
    ts.slideX *= c;
    ts.slideY *= c;
  }
  const rate = top / (wx !== 0 || wy !== 0 ? T.iceAccelTime : T.iceDecelTime);
  const max = rate * DT;
  const dx = wx - ts.slideX;
  const dy = wy - ts.slideY;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= max) {
    ts.slideX = wx;
    ts.slideY = wy;
  } else {
    ts.slideX += (dx / d) * max;
    ts.slideY += (dy / d) * max;
  }
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
  const hash = state.enemyHash;
  for (let i = 0; i < n; i++) {
    const e = list[i]!;
    if (e.dead || enemyDef(e.kind).knockbackScale === 0 || isFrozen(e)) continue;
    // Neighbors in the hash's query order (the push sums depend on it). This is pushFrom written
    // out: called per neighbor, it boxed its float arguments whenever V8 didn't inline it.
    const count = hash.query(e.x, e.y, e.radius);
    const near = hash.hits;
    const stiffness = t.separationStiffness;
    let ax = 0;
    let ay = 0;
    for (let k = 0; k < count; k++) {
      const j = near[k]!;
      if (j === i) continue;
      const o = list[j]!;
      if (o.dead) continue;
      const dx = e.x - o.x;
      const dy = e.y - o.y;
      const rr = e.radius + o.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2);
      const push = (rr - d) * stiffness;
      if (d === 0) {
        ax += (i < j ? -1 : 1) * push;
        continue;
      }
      ax += (dx / d) * push;
      ay += (dy / d) * push;
    }
    acc[0] = ax;
    acc[1] = ay;
    if (!p.dead) pushFrom(e, p.x, p.y, pr, -1, stiffness);
    let px = acc[0]!;
    let py = acc[1]!;
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

/**
 * Adds to `acc` the push on `e` away from a body at (ox, oy) with radius `or` (the player; the
 * neighbor loop in computeSeparation does the same inline).
 */
function pushFrom(e: Enemy, ox: number, oy: number, or: number, tieSign: number, stiffness: number): void {
  const dx = e.x - ox;
  const dy = e.y - oy;
  const rr = e.radius + or;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return;
  const d = Math.sqrt(d2);
  const push = (rr - d) * stiffness;
  if (d === 0) {
    acc[0]! += tieSign * push;
    return;
  }
  acc[0]! += (dx / d) * push;
  acc[1]! += (dy / d) * push;
}
