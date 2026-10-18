import { TILE_CELLS } from '../core/constants';
import type { Room } from '../world/room';

/**
 * Path costs toward one goal tile (the player's), over the room's tile grid: Dijkstra (by bucket
 * queue) with 8-way moves (straight STRAIGHT_COST, diagonal DIAGONAL_COST, about √2 apart) and no corner
 * cutting, so a diagonal step needs both side tiles walkable. Walls in M1 are whole tiles, so
 * the tile grid loses nothing and keeps a rebuild at about 2,000 nodes for the test arena.
 *
 * Determinism and hashing: `cost` is a pure function of the room's walkability and `goalTile`,
 * so hashState hashes only `goalTile` and `builtTick` (when it was last rebuilt), not the array.
 */
export interface FlowField {
  tilesW: number;
  tilesH: number;
  /** 1 where a tile can be walked through (all of its cells walkable). */
  walkable: Uint8Array;
  /** Path cost from each tile to the goal; UNREACHABLE where no path exists. */
  cost: Int32Array;
  /** Goal tile index (ty × tilesW + tx), or -1 before the first build. */
  goalTile: number;
  /** state.tick of the last rebuild, -1 before the first. */
  builtTick: number;
}

export const UNREACHABLE = 0x3fffffff;
const STRAIGHT_COST = 2;
const DIAGONAL_COST = 3;

// Neighbor offsets: the 4 straight moves first, then the 4 diagonals.
const NX = [1, -1, 0, 0, 1, -1, 1, -1];
const NY = [0, 0, 1, -1, 1, 1, -1, -1];

export function createFlowField(room: Room): FlowField {
  const n = room.tilesW * room.tilesH;
  const walkable = new Uint8Array(n);
  for (let ty = 0; ty < room.tilesH; ty++) {
    for (let tx = 0; tx < room.tilesW; tx++) {
      walkable[ty * room.tilesW + tx] = tileWalkable(room, tx, ty) ? 1 : 0;
    }
  }
  return {
    tilesW: room.tilesW,
    tilesH: room.tilesH,
    walkable,
    cost: new Int32Array(n).fill(UNREACHABLE),
    goalTile: -1,
    builtTick: -1,
  };
}

function tileWalkable(room: Room, tx: number, ty: number): boolean {
  for (let cy = 0; cy < TILE_CELLS; cy++) {
    const row = (ty * TILE_CELLS + cy) * room.width + tx * TILE_CELLS;
    for (let cx = 0; cx < TILE_CELLS; cx++) if (room.solid[row + cx] === 1) return false;
  }
  return true;
}

/** Tile index under the cell position (x, y), clamped into the room. */
export function tileAt(f: FlowField, x: number, y: number): number {
  let tx = Math.floor(x / TILE_CELLS);
  let ty = Math.floor(y / TILE_CELLS);
  tx = tx < 0 ? 0 : tx >= f.tilesW ? f.tilesW - 1 : tx;
  ty = ty < 0 ? 0 : ty >= f.tilesH ? f.tilesH - 1 : ty;
  return ty * f.tilesW + tx;
}

// Dial's algorithm: edge costs are only STRAIGHT_COST or DIAGONAL_COST, so while costs `c` are
// being settled every queued cost lies in [c, c + DIAGONAL_COST]; BUCKETS circular buckets cover
// that window. Buckets are reused across rebuilds and grow as needed.
const BUCKETS = DIAGONAL_COST + 1;
const bucket: Int32Array[] = Array.from({ length: BUCKETS }, () => new Int32Array(256));
const bucketLen = new Int32Array(BUCKETS);

function enqueue(c: number, t: number): void {
  const b = c % BUCKETS;
  let arr = bucket[b]!;
  if (bucketLen[b] === arr.length) {
    const bigger = new Int32Array(arr.length * 2);
    bigger.set(arr);
    bucket[b] = arr = bigger;
  }
  arr[bucketLen[b]!++] = t;
}

/**
 * Rebuilds costs toward `goalTile` (Dijkstra by bucket queue). A tile is queued again whenever
 * its cost improves; entries whose cost no longer matches are stale and skipped. Shortest-path
 * costs are unique, so the result depends only on the room and the goal, not on queue order.
 */
export function buildFlowField(f: FlowField, goalTile: number, tick: number): void {
  const { cost, walkable, tilesW, tilesH } = f;
  cost.fill(UNREACHABLE);
  f.goalTile = goalTile;
  f.builtTick = tick;
  bucketLen.fill(0);
  cost[goalTile] = 0;
  enqueue(0, goalTile);
  let queued = 1;
  for (let c = 0; queued > 0; c++) {
    const b = c % BUCKETS;
    // Settling cost c only queues costs c + 2 and c + 3, never into this bucket.
    const arr = bucket[b]!;
    const len = bucketLen[b]!;
    bucketLen[b] = 0;
    queued -= len;
    for (let i = 0; i < len; i++) {
      const t = arr[i]!;
      if (cost[t] !== c) continue;
      const tx = t % tilesW;
      const ty = (t - tx) / tilesW;
      for (let k = 0; k < 8; k++) {
        const nx = tx + NX[k]!;
        const ny = ty + NY[k]!;
        if (nx < 0 || ny < 0 || nx >= tilesW || ny >= tilesH) continue;
        const nt = ny * tilesW + nx;
        if (walkable[nt] !== 1) continue;
        let step = STRAIGHT_COST;
        if (k >= 4) {
          if (walkable[ty * tilesW + nx] !== 1 || walkable[ny * tilesW + tx] !== 1) continue;
          step = DIAGONAL_COST;
        }
        const nc = c + step;
        if (nc < cost[nt]!) {
          cost[nt] = nc;
          enqueue(nc, nt);
          queued++;
        }
      }
    }
  }
}

/**
 * Where to walk from (x, y) to follow the field: the center (in cells) of the cheapest
 * neighboring tile, written to `out`. Returns false when the position's tile is the goal, is
 * unreachable, or has no cheaper neighbor (then walk straight at the goal instead).
 */
export function flowStep(f: FlowField, x: number, y: number, out: { x: number; y: number }): boolean {
  const t = tileAt(f, x, y);
  const { cost, walkable, tilesW, tilesH } = f;
  let best = cost[t]!;
  if (best === 0 || best >= UNREACHABLE) return false;
  const tx = t % tilesW;
  const ty = (t - tx) / tilesW;
  let bestT = -1;
  for (let k = 0; k < 8; k++) {
    const nx = tx + NX[k]!;
    const ny = ty + NY[k]!;
    if (nx < 0 || ny < 0 || nx >= tilesW || ny >= tilesH) continue;
    const nt = ny * tilesW + nx;
    if (walkable[nt] !== 1) continue;
    if (k >= 4 && (walkable[ty * tilesW + nx] !== 1 || walkable[ny * tilesW + tx] !== 1)) continue;
    if (cost[nt]! < best) {
      best = cost[nt]!;
      bestT = nt;
    }
  }
  if (bestT < 0) return false;
  const bx = bestT % tilesW;
  out.x = (bx + 0.5) * TILE_CELLS;
  out.y = ((bestT - bx) / tilesW + 0.5) * TILE_CELLS;
  return true;
}
