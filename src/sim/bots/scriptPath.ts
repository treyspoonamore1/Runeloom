/**
 * Tile paths for the script driver (script.ts): Dijkstra over the room's tiles with 8-way moves
 * (straight 2, diagonal 3, no corner cutting). A tile is walkable when every one of its cells is
 * (room.solid, which follows doors, blocks and frozen water). When the target's tile can't be
 * reached, the path ends at the reachable tile nearest to it.
 */
import { TILE_CELLS } from '../core/constants';
import type { Room } from '../world/room';

const NX = [1, -1, 0, 0, 1, -1, 1, -1];
const NY = [0, 0, 1, -1, 1, 1, -1, -1];
const STRAIGHT = 2;
const DIAGONAL = 3;

export function tileWalkable(room: Room, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= room.tilesW || ty >= room.tilesH) return false;
  for (let cy = 0; cy < TILE_CELLS; cy++) {
    const row = (ty * TILE_CELLS + cy) * room.width + tx * TILE_CELLS;
    for (let cx = 0; cx < TILE_CELLS; cx++) if (room.solid[row + cx] === 1) return false;
  }
  return true;
}

/** The walkable tile nearest to (x, y) cells: its own, else one of the 8 around it. */
function startTile(room: Room, x: number, y: number): number {
  const tx = Math.floor(x / TILE_CELLS);
  const ty = Math.floor(y / TILE_CELLS);
  if (tileWalkable(room, tx, ty)) return ty * room.tilesW + tx;
  let best = -1;
  let bestD = Number.POSITIVE_INFINITY;
  for (let k = 0; k < 8; k++) {
    const nx = tx + NX[k]!;
    const ny = ty + NY[k]!;
    if (!tileWalkable(room, nx, ny)) continue;
    const ex = (nx + 0.5) * TILE_CELLS - x;
    const ey = (ny + 0.5) * TILE_CELLS - y;
    const d = ex * ex + ey * ey;
    if (d < bestD) {
      bestD = d;
      best = ny * room.tilesW + nx;
    }
  }
  return best;
}

/**
 * Waypoints (tile centers, in cells) from (x0, y0) toward (x1, y1), excluding the start tile;
 * the caller walks to (x1, y1) itself after the last one. Null when the player stands nowhere
 * walkable.
 */
export function findPath(
  room: Room,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { x: number; y: number }[] | null {
  const w = room.tilesW;
  const n = w * room.tilesH;
  const start = startTile(room, x0, y0);
  if (start < 0) return null;
  const cost = new Int32Array(n).fill(-1);
  const parent = new Int32Array(n).fill(-1);
  const walk = new Uint8Array(n);
  for (let t = 0; t < n; t++) walk[t] = tileWalkable(room, t % w, Math.floor(t / w)) ? 1 : 0;
  // Bucket queue: costs are small integers.
  const buckets: number[][] = [[start]];
  cost[start] = 0;
  for (let c = 0; c < buckets.length; c++) {
    const b = buckets[c];
    if (!b) continue;
    for (const t of b) {
      if (cost[t] !== c) continue;
      const tx = t % w;
      const ty = (t - tx) / w;
      for (let k = 0; k < 8; k++) {
        const nx = tx + NX[k]!;
        const ny = ty + NY[k]!;
        if (nx < 0 || ny < 0 || nx >= w || ny >= room.tilesH) continue;
        const nt = ny * w + nx;
        if (!walk[nt]) continue;
        if (k >= 4 && (!walk[ty * w + nx] || !walk[ny * w + tx])) continue;
        const nc = c + (k < 4 ? STRAIGHT : DIAGONAL);
        if (cost[nt] !== -1 && cost[nt]! <= nc) continue;
        cost[nt] = nc;
        parent[nt] = t;
        (buckets[nc] ??= []).push(nt);
      }
    }
  }
  // The goal: the target's tile if reached, else the reached tile nearest the target.
  let goal = -1;
  let bestD = Number.POSITIVE_INFINITY;
  for (let t = 0; t < n; t++) {
    if (cost[t] === -1) continue;
    const tx = t % w;
    const ty = (t - tx) / w;
    const ex = (tx + 0.5) * TILE_CELLS - x1;
    const ey = (ty + 0.5) * TILE_CELLS - y1;
    const d = ex * ex + ey * ey;
    if (d < bestD || (d === bestD && cost[t]! < cost[goal]!)) {
      bestD = d;
      goal = t;
    }
  }
  const out: { x: number; y: number }[] = [];
  for (let t = goal; t !== start && t >= 0; t = parent[t]!) {
    const tx = t % w;
    out.push({ x: (tx + 0.5) * TILE_CELLS, y: ((t - tx) / w + 0.5) * TILE_CELLS });
  }
  return out.reverse();
}
