/**
 * Bolt (CONTENT §1.2): a projectile that stops on its first hit (Pierce passes through more),
 * Chains after its first hit, turns toward the nearest enemy with Seeker, and ends on walls,
 * shields and at the end of its life. M5: Fork splits it on its first hit; Return flies it back
 * to the player when its life runs out. Movement and collision follow combat/projectiles.ts:
 * substeps under one cell, bodies before walls, nearest candidate first.
 */
import type { Enemy } from '../../../actors/enemies';
import { DT } from '../../../core/constants';
import { anyShotSolid, circleHitsShotWall } from '../../../combat/projectiles';
import { isBlockedByShield } from '../../../combat/shield';
import { emit } from '../../../events';
import type { GameState } from '../../../state';
import type { Rotation } from '../../angles';
import { nearestEnemy } from '../geom';
import { canTarget, chainFrom, spellHit, TIME_EPSILON } from '../procs';
import { endSpell, spawnForks } from '../spawn';
import type { SpellInstance } from '../types';

/** Longest move between collision checks, in cells (as combat/projectiles.ts). */
const MAX_SUBSTEP = 0.5;

export function initBolt(b: SpellInstance): void {
  const p = b.spec.params;
  if (p.form !== 'bolt') return;
  b.vx = b.dirX * p.speed;
  b.vy = b.dirY * p.speed;
  b.radius = p.radius;
  b.lifeLeft = p.life;
}

// Scratch for the per-tick candidates; stepBolt never runs nested.
const order: number[] = [];
const dist2: number[] = [];

/** Enemies the bolt may still hit near its sweep, nearest to its start first (ties: array order). */
function gather(state: GameState, b: SpellInstance, cx: number, cy: number, r: number): number {
  const n = state.enemyHash.query(cx, cy, r);
  if (n === 0) return 0;
  const found = state.enemyHash.hits;
  let m = 0;
  for (let k = 0; k < n; k++) {
    const idx = found[k]!;
    const e = state.enemies[idx]!;
    if (!canTarget(b, e) || b.hitIds.includes(e.id)) continue;
    const dx = e.x - b.x;
    const dy = e.y - b.y;
    const d2 = dx * dx + dy * dy;
    let j = m++;
    while (j > 0 && (dist2[j - 1]! > d2 || (dist2[j - 1] === d2 && order[j - 1]! > idx))) {
      dist2[j] = dist2[j - 1]!;
      order[j] = order[j - 1]!;
      j--;
    }
    dist2[j] = d2;
    order[j] = idx;
  }
  return m;
}

/** Seeker: turn toward the nearest enemy it may hit by at most `rot` this tick; snap when closer. */
function steer(state: GameState, b: SpellInstance, rot: Rotation, speed: number): void {
  const t = nearestEnemy(
    state,
    b.x,
    b.y,
    Infinity,
    (e: Enemy) => canTarget(b, e) && !b.hitIds.includes(e.id),
    false,
  );
  if (t === null) return;
  const dx = t.x - b.x;
  const dy = t.y - b.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) return;
  const ux = dx / d;
  const uy = dy / d;
  const dot = b.dirX * ux + b.dirY * uy;
  if (dot >= rot.cos) {
    b.dirX = ux;
    b.dirY = uy;
  } else {
    const s = b.dirX * uy - b.dirY * ux >= 0 ? rot.sin : -rot.sin;
    const nx = b.dirX * rot.cos - b.dirY * s;
    const ny = b.dirX * s + b.dirY * rot.cos;
    const l = Math.sqrt(nx * nx + ny * ny);
    b.dirX = nx / l;
    b.dirY = ny / l;
  }
  b.vx = b.dirX * speed;
  b.vy = b.dirY * speed;
}

/** Hits at (x, y) at the end of one substep. Returns true if the bolt ended. */
function hitBodies(state: GameState, b: SpellInstance, x: number, y: number, candidates: number): boolean {
  for (let k = 0; k < candidates; k++) {
    const idx = order[k]!;
    if (idx < 0) continue;
    const e = state.enemies[idx]!;
    if (e.dead) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const rr = e.radius + b.radius;
    if (dx * dx + dy * dy > rr * rr) continue;
    order[k] = -1;
    b.hitIds.push(e.id);
    if (isBlockedByShield(e, x, y)) {
      b.x = x;
      b.y = y;
      emit(state, { type: 'shieldBlock', id: e.id, projectileId: b.id, x, y });
      endSpell(state, b, 'blocked', e.id);
      return true;
    }
    const first = b.hitCount === 0;
    spellHit(state, b, e, b.dirX, b.dirY, b.dirX, b.dirY);
    if (first) chainFrom(state, b, e);
    // Fork (M5): the first hit splits it into the fork's bolts.
    if (first && b.spec.fork !== null && !b.forked) {
      b.forked = true;
      spawnForks(state, b, e.id, x, y);
    }
    if (b.ended) return true;
    if (b.pierceLeft > 0) {
      b.pierceLeft--;
      continue;
    }
    b.x = x;
    b.y = y;
    endSpell(state, b, 'hit', e.id);
    return true;
  }
  return false;
}

/**
 * Return (M5): when its life runs out, the bolt turns back toward the player at its speed and
 * may hit everything again (targets, pierce). It ends on reaching the player, a wall, a stopping
 * hit, or after its outbound life again. Returns true if it started returning.
 */
function startReturn(b: SpellInstance): boolean {
  const p = b.spec.params;
  if (!b.spec.returns || b.returning || p.form !== 'bolt') return false;
  b.returning = true;
  b.hitIds.length = 0;
  b.pierceLeft = b.spec.pierce;
  b.lifeLeft = p.life;
  return true;
}

/** Points a returning bolt at the player; true when it has reached them. */
function homeOnPlayer(state: GameState, b: SpellInstance, speed: number): boolean {
  const pl = state.player;
  const dx = pl.x - b.x;
  const dy = pl.y - b.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= state.tuning.player.radius + b.radius) return true;
  b.dirX = dx / d;
  b.dirY = dy / d;
  b.vx = b.dirX * speed;
  b.vy = b.dirY * speed;
  return false;
}

export function stepBolt(state: GameState, b: SpellInstance): void {
  const p = b.spec.params;
  if (p.form !== 'bolt') return;
  if (b.returning) {
    if (homeOnPlayer(state, b, p.speed)) {
      endSpell(state, b, 'expired');
      return;
    }
  } else if (b.spec.seeker) steer(state, b, b.spec.seeker.tickRotation, p.speed);
  const dx = b.vx * DT;
  const dy = b.vy * DT;
  const r = b.radius;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, Math.ceil(dist / MAX_SUBSTEP));
  const sx = dx / steps;
  const sy = dy / steps;
  const ex = b.x + dx;
  const ey = b.y + dy;
  const wallsNear = anyShotSolid(
    state.room,
    Math.floor((b.x < ex ? b.x : ex) - r),
    Math.floor((b.y < ey ? b.y : ey) - r),
    Math.floor((b.x > ex ? b.x : ex) + r),
    Math.floor((b.y > ey ? b.y : ey) + r),
  );
  // Candidates near the sweep. Most bolts fly through empty buckets, which anyNear rules out
  // first: it takes integers, while gather's float arguments are boxed when it isn't inlined.
  const cx = b.x + dx / 2;
  const cy = b.y + dy / 2;
  const cr = dist / 2 + r;
  const candidates = state.enemyHash.anyNear(
    Math.floor(cx - cr),
    Math.floor(cy - cr),
    Math.floor(cx + cr),
    Math.floor(cy + cr),
  )
    ? gather(state, b, cx, cy, cr)
    : 0;
  for (let i = 0; i < steps; i++) {
    const nx = b.x + sx;
    const ny = b.y + sy;
    if (candidates > 0 && hitBodies(state, b, nx, ny, candidates)) return;
    if (wallsNear && circleHitsShotWall(state.room, nx, ny, r)) {
      endSpell(state, b, 'wall');
      return;
    }
    b.x = nx;
    b.y = ny;
  }
  b.lifeLeft -= DT;
  if (b.lifeLeft <= TIME_EPSILON && !startReturn(b)) endSpell(state, b, 'expired');
}
