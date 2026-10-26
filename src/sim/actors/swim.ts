/**
 * Swimmer routes (M8, DESIGN §6.3 rule 31, §6.5 "Entities on it"): how a swimmer (Bog Lurker,
 * Glasspike, the Glasswater Coil) finds its way through the water toward a goal, following water
 * as it appears (Tide's borrowed water, a Spark Heron's puddle, meltwater) and stopping at the
 * shore nearest the goal when the water ends. Stranding (rule 31) is actors/strand.ts.
 *
 * A plan is a bounded breadth-first search over water cells from the swimmer's cell (8
 * neighbors, no corner cutting, at most tuning.swim.planCells cells). The reached cell nearest
 * the goal wins (ties: the shorter route), and the swimmer heads for the cell
 * tuning.swim.lookahead steps along the route to it, re-planning every repathTicks ticks or when
 * it gets there. A water body larger than the search is crossed in steps, a plan at a time.
 *
 * Reusable: `swimToward` drives any swimmer (the bosses' Coil included); `planRoute` and
 * `searchFrom` are the parts.
 */
import type { GameState } from '../state';
import type { Enemy } from './enemies';
import { isWaterCell } from './locomotion';

// Scratch for the searches (one at a time; the sim is single-threaded).
let seen = new Uint32Array(0);
let parent = new Int32Array(0);
let depth = new Int32Array(0);
let queue = new Int32Array(0);
let stamp = 0;

function ensureScratch(n: number): void {
  if (seen.length < n) {
    seen = new Uint32Array(n);
    parent = new Int32Array(n);
    depth = new Int32Array(n);
    queue = new Int32Array(n);
    stamp = 0;
  }
  stamp++;
  if (stamp === 0xffffffff) {
    seen.fill(0);
    stamp = 1;
  }
}

/** What a search may cross: 'water' (swimming) or 'open' (anything shots cross: crawling, rule 31). */
export type SearchMedium = 'water' | 'open';

function passable(state: GameState, i: number, medium: SearchMedium): boolean {
  return medium === 'water' ? isWaterCell(state.grid, i) : state.room.shotSolid[i] === 0;
}

const NX = [1, -1, 0, 0, 1, 1, -1, -1];
const NY = [0, 0, 1, -1, 1, -1, 1, -1];

/**
 * Breadth-first search from cell `start` over `medium` cells (8 neighbors; a diagonal step needs
 * both side cells passable), visiting at most `maxCells` cells and `maxDepth` steps. Returns the
 * number of visited cells; `visited(k)` is the k-th in visiting order, with parentOf and depthOf.
 * The start cell is always visited, whatever it is.
 */
export function searchFrom(
  state: GameState,
  start: number,
  medium: SearchMedium,
  maxCells: number,
  maxDepth: number,
): number {
  const g = state.grid;
  const w = g.width;
  const h = g.height;
  ensureScratch(w * h);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  seen[start] = stamp;
  parent[start] = -1;
  depth[start] = 0;
  while (head < tail && tail < maxCells) {
    const c = queue[head++]!;
    const d = depth[c]!;
    if (d >= maxDepth) continue;
    const x = c % w;
    const y = (c - x) / w;
    for (let k = 0; k < 8 && tail < maxCells; k++) {
      const nx = x + NX[k]!;
      const ny = y + NY[k]!;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (seen[n] === stamp || !passable(state, n, medium)) continue;
      if (k >= 4 && (!passable(state, y * w + nx, medium) || !passable(state, ny * w + x, medium))) continue;
      seen[n] = stamp;
      parent[n] = c;
      depth[n] = d + 1;
      queue[tail++] = n;
    }
  }
  return tail;
}

/** The k-th cell the last search visited. */
export function visited(k: number): number {
  return queue[k]!;
}

/** The cell `steps` steps from the last search's start along the route to `cell` (or `cell` if nearer). */
export function routeStep(cell: number, steps: number): number {
  let c = cell;
  for (let k = depth[cell]! - steps; k > 0; k--) c = parent[c]!;
  return c;
}

/** Cell index under (x, y), or -1 outside the grid. */
export function cellOf(state: GameState, x: number, y: number): number {
  const g = state.grid;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= g.width || cy >= g.height) return -1;
  return cy * g.width + cx;
}

/**
 * Plans `e`'s route through the water toward (gx, gy): sets EnemySpecial.routeCell to the cell
 * to head for, or -1 when its own cell is already the reachable water nearest the goal (or it
 * isn't in water). `maxCells` defaults to tuning.swim.planCells. Returns true if it has a route.
 */
export function planRoute(state: GameState, e: Enemy, gx: number, gy: number, maxCells?: number): boolean {
  const s = e.special;
  s.routeCell = -1;
  const start = cellOf(state, e.x, e.y);
  if (start < 0 || !isWaterCell(state.grid, start)) return false;
  const T = state.tuning.swim;
  const n = searchFrom(state, start, 'water', maxCells ?? T.planCells, Number.MAX_SAFE_INTEGER);
  const w = state.grid.width;
  let best = start;
  let bestD2 = Infinity;
  for (let k = 0; k < n; k++) {
    const c = queue[k]!;
    const x = c % w;
    const dx = x + 0.5 - gx;
    const dy = (c - x) / w + 0.5 - gy;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = c;
    }
  }
  if (best === start) return false;
  s.routeCell = routeStep(best, T.lookahead);
  return true;
}

/**
 * Sets `e`'s velocity along its route through the water toward (gx, gy) at `speed` cells/s
 * (re-planning when due, when it reached its route cell or when that cell stopped being water).
 * Returns false, standing still, when it is already at the reachable water nearest the goal.
 * actors/locomotion.ts swimMove keeps the body on water while it moves.
 */
export function swimToward(state: GameState, e: Enemy, gx: number, gy: number, speed: number): boolean {
  const s = e.special;
  const here = cellOf(state, e.x, e.y);
  const rc = s.routeCell;
  s.routeReplan--;
  if (s.routeReplan <= 0 || rc === here || (rc >= 0 && !isWaterCell(state.grid, rc))) {
    planRoute(state, e, gx, gy);
    s.routeReplan = state.tuning.swim.repathTicks;
  }
  return headFor(state, e, s.routeCell, speed);
}

/** Velocity toward the center of `cell` at `speed`; stops (false) for -1 or when already on it. */
export function headFor(state: GameState, e: Enemy, cell: number, speed: number): boolean {
  if (cell < 0) {
    e.vx = e.vy = 0;
    return false;
  }
  const w = state.grid.width;
  const x = cell % w;
  const dx = x + 0.5 - e.x;
  const dy = (cell - x) / w + 0.5 - e.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) {
    e.vx = e.vy = 0;
    return false;
  }
  e.vx = (dx / d) * speed;
  e.vy = (dy / d) * speed;
  return true;
}
