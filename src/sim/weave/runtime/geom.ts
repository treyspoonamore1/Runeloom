/** Geometry and target queries for the spell runtime. No trig: rotations are precomputed (angles.ts). */
import type { Enemy } from '../../actors/enemies';
import type { GameState } from '../../state';
import { hasLineOfSight } from '../../world/los';
import type { Room } from '../../world/room';
import type { Rotation } from '../angles';

/** Writes (x, y) rotated by `r` into `out`. */
export function rotateInto(x: number, y: number, r: Rotation, out: { x: number; y: number }): void {
  out.x = x * r.cos - y * r.sin;
  out.y = x * r.sin + y * r.cos;
}

/** Unit vector of (dx, dy), or (fx, fy) when it has no length. */
export function unitOr(dx: number, dy: number, fx: number, fy: number): [number, number] {
  const d = Math.sqrt(dx * dx + dy * dy);
  return d > 0 ? [dx / d, dy / d] : [fx, fy];
}

/** The point `range` cells from (x, y) toward (px, py) if that is farther, else (px, py); then kept inside the room. */
export function clampPoint(
  room: Room,
  x: number,
  y: number,
  px: number,
  py: number,
  range: number,
): [number, number] {
  let dx = px - x;
  let dy = py - y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > range && d > 0) {
    dx *= range / d;
    dy *= range / d;
  }
  return [clampTo(x + dx, 0, room.width), clampTo(y + dy, 0, room.height)];
}

function clampTo(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// Scratch for enemy queries. Callers never hold it across another query.
const found: number[] = [];

/**
 * Nearest live enemy to (x, y) within `range` (centers; Infinity scans every enemy) that passes
 * `accept`, optionally only with line of sight. Ties go to the earlier enemy in state.enemies.
 */
export function nearestEnemy(
  state: GameState,
  x: number,
  y: number,
  range: number,
  accept: ((e: Enemy) => boolean) | null,
  needSight: boolean,
): Enemy | null {
  let best: Enemy | null = null;
  let bestD = Infinity;
  let bestIdx = -1;
  const consider = (e: Enemy, idx: number): void => {
    if (e.dead || (accept !== null && !accept(e))) return;
    const dx = e.x - x;
    const dy = e.y - y;
    const d = dx * dx + dy * dy;
    if (d > range * range) return;
    if (d > bestD || (d === bestD && idx > bestIdx)) return;
    if (needSight && !hasLineOfSight(state.room, x, y, e.x, e.y)) return;
    best = e;
    bestD = d;
    bestIdx = idx;
  };
  if (range === Infinity) {
    state.enemies.forEach(consider);
    return best;
  }
  const n = state.enemyHash.queryCircle(x, y, range, found);
  for (let k = 0; k < n; k++) consider(state.enemies[found[k]!]!, found[k]!);
  return best;
}

/**
 * Indices (into state.enemies) of live enemies whose bodies touch the circle (x, y, r), in the
 * spatial hash's deterministic order. A fresh array, so callers may spawn spells while iterating.
 */
export function enemiesTouching(state: GameState, x: number, y: number, r: number): number[] {
  const n = state.enemyHash.queryCircle(x, y, r, found);
  const out: number[] = [];
  for (let k = 0; k < n; k++) if (!state.enemies[found[k]!]!.dead) out.push(found[k]!);
  return out;
}

/**
 * Distance along the unit ray from (x0, y0) to the first cell that blocks shots (or the room
 * edge), at most maxLen. 0 if it starts inside one. A DDA walk like world/los.ts.
 */
export function rayWallDistance(
  room: Room,
  x0: number,
  y0: number,
  dx: number,
  dy: number,
  maxLen: number,
): number {
  const w = room.width;
  const h = room.height;
  const mask = room.shotSolid;
  let cx = Math.floor(x0);
  let cy = Math.floor(y0);
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  // Number.POSITIVE_INFINITY, not the global `Infinity`: with the global, V8 keeps these loop
  // floats boxed and allocates a heap number on every step.
  const tDeltaX = stepX !== 0 ? stepX / dx : Number.POSITIVE_INFINITY;
  const tDeltaY = stepY !== 0 ? stepY / dy : Number.POSITIVE_INFINITY;
  let tMaxX = stepX > 0 ? (cx + 1 - x0) / dx : stepX < 0 ? (cx - x0) / dx : Number.POSITIVE_INFINITY;
  let tMaxY = stepY > 0 ? (cy + 1 - y0) / dy : stepY < 0 ? (cy - y0) / dy : Number.POSITIVE_INFINITY;
  let t = 0;
  for (;;) {
    if (cx < 0 || cy < 0 || cx >= w || cy >= h || mask[cy * w + cx] === 1) return t < maxLen ? t : maxLen;
    if (tMaxX < tMaxY) {
      t = tMaxX;
      tMaxX += tDeltaX;
      cx += stepX;
    } else {
      t = tMaxY;
      tMaxY += tDeltaY;
      cy += stepY;
    }
    if (t >= maxLen) return maxLen;
  }
}
