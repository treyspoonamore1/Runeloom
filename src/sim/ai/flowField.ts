import { TILE_CELLS } from '../core/constants';
import type { Room } from '../world/room';

/**
 * Path costs toward one goal tile (the player's), over the room's tile grid: Dijkstra with
 * 8-way moves (straight STRAIGHT_COST, diagonal DIAGONAL_COST, about √2 apart) and no corner
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

// Binary min-heap of (cost, tile) pairs ordered by cost then tile index, reused across rebuilds.
let heapKey = new Int32Array(256);
let heapTile = new Int32Array(256);
let heapSize = 0;

function before(ka: number, ta: number, kb: number, tb: number): boolean {
  return ka < kb || (ka === kb && ta < tb);
}

function push(key: number, t: number): void {
  if (heapSize === heapKey.length) {
    const k2 = new Int32Array(heapKey.length * 2);
    const t2 = new Int32Array(heapKey.length * 2);
    k2.set(heapKey);
    t2.set(heapTile);
    heapKey = k2;
    heapTile = t2;
  }
  let i = heapSize++;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (!before(key, t, heapKey[parent]!, heapTile[parent]!)) break;
    heapKey[i] = heapKey[parent]!;
    heapTile[i] = heapTile[parent]!;
    i = parent;
  }
  heapKey[i] = key;
  heapTile[i] = t;
}

// The key of the entry last popped.
let poppedKey = 0;

function pop(): number {
  const top = heapTile[0]!;
  poppedKey = heapKey[0]!;
  heapSize--;
  const lk = heapKey[heapSize]!;
  const lt = heapTile[heapSize]!;
  let i = 0;
  for (;;) {
    const l = 2 * i + 1;
    if (l >= heapSize) break;
    const r = l + 1;
    const c = r < heapSize && before(heapKey[r]!, heapTile[r]!, heapKey[l]!, heapTile[l]!) ? r : l;
    if (!before(heapKey[c]!, heapTile[c]!, lk, lt)) break;
    heapKey[i] = heapKey[c]!;
    heapTile[i] = heapTile[c]!;
    i = c;
  }
  heapKey[i] = lk;
  heapTile[i] = lt;
  return top;
}

/**
 * Rebuilds costs toward `goalTile`. A tile is pushed again whenever its cost improves; entries
 * whose key is above the tile's current cost are stale and skipped when popped. With integer
 * costs and the (cost, index) order, the result depends only on the room and the goal.
 */
export function buildFlowField(f: FlowField, goalTile: number, tick: number): void {
  const { cost, walkable, tilesW, tilesH } = f;
  cost.fill(UNREACHABLE);
  f.goalTile = goalTile;
  f.builtTick = tick;
  heapSize = 0;
  cost[goalTile] = 0;
  push(0, goalTile);
  while (heapSize > 0) {
    const t = pop();
    const base = cost[t]!;
    if (poppedKey > base) continue;
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
      const c = base + step;
      if (c < cost[nt]!) {
        cost[nt] = c;
        push(c, nt);
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
