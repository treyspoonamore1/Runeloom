import type { Room } from './room';

/**
 * Line of sight on the cell grid: a DDA walk (Amanatides–Woo) visiting every cell the segment
 * from (x0, y0) to (x1, y1) passes through, in order. The segment is clear if none of those
 * cells is set in `mask` (row-major, room.width × room.height). Cells outside the room block.
 *
 * Exact corner crossings step along y first, so a segment squeezing diagonally between two
 * blocking cells that only touch at a corner visits one of them and is blocked (conservative).
 * Cost is one mask read per cell crossed, about |dx| + |dy| reads.
 */
export function segmentClear(
  room: Room,
  mask: Uint8Array,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  const w = room.width;
  const h = room.height;
  let cx = Math.floor(x0);
  let cy = Math.floor(y0);
  const ex = Math.floor(x1);
  const ey = Math.floor(y1);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  // Parametric distance (0..1 along the segment) to the next vertical / horizontal cell edge.
  // Number.POSITIVE_INFINITY, not the global `Infinity`: with the global, V8 keeps these loop
  // floats boxed and allocates a heap number on every step.
  const tDeltaX = stepX !== 0 ? stepX / dx : Number.POSITIVE_INFINITY;
  const tDeltaY = stepY !== 0 ? stepY / dy : Number.POSITIVE_INFINITY;
  let tMaxX = stepX > 0 ? (cx + 1 - x0) / dx : stepX < 0 ? (cx - x0) / dx : Number.POSITIVE_INFINITY;
  let tMaxY = stepY > 0 ? (cy + 1 - y0) / dy : stepY < 0 ? (cy - y0) / dy : Number.POSITIVE_INFINITY;
  let left = (ex > cx ? ex - cx : cx - ex) + (ey > cy ? ey - cy : cy - ey);
  for (;;) {
    if (cx < 0 || cy < 0 || cx >= w || cy >= h || mask[cy * w + cx] === 1) return false;
    if (left-- === 0) return true;
    if (tMaxX < tMaxY) {
      tMaxX += tDeltaX;
      cx += stepX;
    } else {
      tMaxY += tDeltaY;
      cy += stepY;
    }
  }
}

/** True if nothing that stops shots (walls, pillars; not water or pits) lies between the points. */
export function hasLineOfSight(room: Room, x0: number, y0: number, x1: number, y1: number): boolean {
  return segmentClear(room, room.shotSolid, x0, y0, x1, y1);
}

/** True if no unwalkable cell (walls, water, pits) lies on the straight path between the points. */
export function hasWalkLine(room: Room, x0: number, y0: number, x1: number, y1: number): boolean {
  return segmentClear(room, room.solid, x0, y0, x1, y1);
}
