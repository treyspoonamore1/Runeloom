import { isSolidCell, type Room } from '../world/room';

/**
 * Circle-vs-cell collision for any walking body (player now, enemies later).
 *
 * A body moves in substeps no longer than MAX_SUBSTEP. After each substep it is
 * pushed out of overlapping solid cells, deepest overlap first, using the closest
 * point on each cell's square. Resolving the deepest cell first means a body
 * pressed into a flat wall is always pushed straight out by the cell under its
 * center, never sideways by the corner of a neighboring cell, so it does not snag
 * on cell seams. Velocity and the remaining displacement lose the part that points
 * into each contact normal, so bodies slide along walls and around corners.
 */

/**
 * Longest move between collision checks, in cells. A body can sink at most this far
 * into a wall before being pushed out, and it always leaves by the nearer side, so
 * keeping it under half a cell means no body of any radius skips a one-cell wall.
 */
const MAX_SUBSTEP = 0.4;
/** Push-out passes per substep. Each pass resolves the single deepest overlap. */
const RESOLVE_PASSES = 6;
/** Overlap depth (cells) below which a body counts as touching rather than overlapping. */
const CONTACT_EPSILON = 1e-9;
/** Gap (cells) within which a body counts as touching a wall for clipToContacts. */
const CONTACT_SKIN = 1e-6;

/** The parts of a body collision reads and writes. Positions in cells, velocity in cells/s. */
export interface CircleBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// Scratch for the deepest-overlap search; the sim is single-threaded.
let hitX = 0;
let hitY = 0;
let hitNx = 0;
let hitNy = 0;

/**
 * Finds the solid cell the circle overlaps most. On a hit, sets hitX/hitY to the
 * position that just clears that cell and hitNx/hitNy to the push direction.
 */
function findDeepest(room: Room, x: number, y: number, r: number): boolean {
  const x0 = Math.floor(x - r);
  const x1 = Math.floor(x + r);
  const y0 = Math.floor(y - r);
  const y1 = Math.floor(y + r);
  let best = CONTACT_EPSILON;
  let found = false;
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (!isSolidCell(room, cx, cy)) continue;
      const qx = x < cx ? cx : x > cx + 1 ? cx + 1 : x;
      const qy = y < cy ? cy : y > cy + 1 ? cy + 1 : y;
      const dx = x - qx;
      const dy = y - qy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 0) {
        const d = Math.sqrt(d2);
        const depth = r - d;
        if (depth <= best) continue;
        best = depth;
        found = true;
        hitNx = dx / d;
        hitNy = dy / d;
        hitX = qx + hitNx * r;
        hitY = qy + hitNy * r;
      } else {
        // Center inside the cell (only if a body starts inside a wall): leave by the nearest face.
        const left = x - cx;
        const right = cx + 1 - x;
        const top = y - cy;
        const bottom = cy + 1 - y;
        const exit = Math.min(left, right, top, bottom);
        const depth = r + exit;
        if (depth <= best) continue;
        best = depth;
        found = true;
        hitX = x;
        hitY = y;
        hitNx = 0;
        hitNy = 0;
        if (exit === left) {
          hitNx = -1;
          hitX = cx - r;
        } else if (exit === right) {
          hitNx = 1;
          hitX = cx + 1 + r;
        } else if (exit === top) {
          hitNy = -1;
          hitY = cy - r;
        } else {
          hitNy = 1;
          hitY = cy + 1 + r;
        }
      }
    }
  }
  return found;
}

/**
 * Removes from `v` every component pointing into a wall the circle at (x, y) is
 * touching. Walkers clip their target velocity with this before accelerating, so
 * acceleration isn't spent pushing into a wall and sliding gets up to speed as
 * fast as open-ground running.
 */
export function clipToContacts(
  room: Room,
  x: number,
  y: number,
  r: number,
  v: { x: number; y: number },
): void {
  const reach = r + CONTACT_SKIN;
  const x0 = Math.floor(x - reach);
  const x1 = Math.floor(x + reach);
  const y0 = Math.floor(y - reach);
  const y1 = Math.floor(y + reach);
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (!isSolidCell(room, cx, cy)) continue;
      const qx = x < cx ? cx : x > cx + 1 ? cx + 1 : x;
      const qy = y < cy ? cy : y > cy + 1 ? cy + 1 : y;
      const dx = x - qx;
      const dy = y - qy;
      const d2 = dx * dx + dy * dy;
      if (d2 === 0 || d2 >= reach * reach) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const vn = v.x * nx + v.y * ny;
      if (vn < 0) {
        v.x -= vn * nx;
        v.y -= vn * ny;
      }
    }
  }
}

/** True if a circle at (x, y) overlaps any solid cell by more than a rounding error. */
export function circleOverlapsSolid(room: Room, x: number, y: number, r: number): boolean {
  return findDeepest(room, x, y, r);
}

/**
 * Moves a circle body by (dx, dy) cells through the room, sliding along walls.
 * Updates body.x/y, and removes from body.vx/vy any component pointing into a
 * wall it touched. Returns true if it touched a wall.
 */
export function moveCircle(room: Room, body: CircleBody, r: number, dx: number, dy: number): boolean {
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, Math.ceil(dist / MAX_SUBSTEP));
  let sx = dx / steps;
  let sy = dy / steps;
  let touched = false;
  for (let i = 0; i < steps; i++) {
    const startX = body.x;
    const startY = body.y;
    body.x += sx;
    body.y += sy;
    let pass = 0;
    for (; pass < RESOLVE_PASSES; pass++) {
      if (!findDeepest(room, body.x, body.y, r)) break;
      touched = true;
      body.x = hitX;
      body.y = hitY;
      const vn = body.vx * hitNx + body.vy * hitNy;
      if (vn < 0) {
        body.vx -= vn * hitNx;
        body.vy -= vn * hitNy;
      }
      const sn = sx * hitNx + sy * hitNy;
      if (sn < 0) {
        sx -= sn * hitNx;
        sy -= sn * hitNy;
      }
    }
    if (pass === RESOLVE_PASSES && findDeepest(room, body.x, body.y, r)) {
      // Wedged where pushes fight each other: stay at the last clear position.
      body.x = startX;
      body.y = startY;
      break;
    }
  }
  return touched;
}
