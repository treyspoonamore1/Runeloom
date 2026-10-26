/**
 * The Glasswater Coil's way through the water (DESIGN §10.5; actors/swim.ts generalized): one
 * bounded breadth-first search over the water from its cell (tuning.bosses.coilPlanCells, so the
 * Eye, both channels and any lure path fit) gives both its route toward a goal and how far the
 * player stands from the nearest water it can reach (BossState.fen.waterGap: "within N cells of
 * its water"). Re-planned every tuning.swim.repathTicks ticks, or when it reached its route cell
 * or that cell stopped being water. It heads for the deep water nearest its goal, leaving deep
 * water only when shallow water reaches closer to the goal: borrowed water (a Tide path, a spit
 * puddle joined to the Eye) coilLeaveDeepBorrowed cells closer, the map's own shallows (the Eye's
 * rim) coilLeaveDeep cells closer, which the rim never is. Borrowed water lures it out.
 *
 * Phase 1 it circles the Eye and its channels (PATROL, around its spawn point, waypoints that
 * aren't water are passed by), hunting the player instead when they come within lunge reach of its
 * water. Phases 2–3 it chases the player through any water it can reach.
 */
import { MAT } from '../../../../data/materials';
import { isWaterCell } from '../../actors/locomotion';
import type { Enemy } from '../../actors/enemies';
import { cellOf, headFor, routeStep, searchFrom, visited } from '../../actors/swim';
import { swimSpeed } from '../leaper';
import type { GameState } from '../../state';

// prettier-ignore
/** Phase 1 patrol: offsets from its home (the Eye's middle): around the Eye, out along each channel. */
const PATROL: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [0.7, 0.7], [0, 1], [-0.7, 0.7], [-1, 0], [-2.9, 0], [-1, 0], [-0.7, -0.7], [0, -1],
  [0.7, -0.7], [1, 0], [2.9, 0],
];

/** A patrol waypoint counts as reached within this many cells. */
const ARRIVE = 4;

/** Plans its route toward (gx, gy) and measures the player's distance to its water. */
export function planCoil(state: GameState, e: Enemy, gx: number, gy: number): void {
  const s = e.special;
  const f = e.boss!.fen!;
  s.routeCell = -1;
  const start = cellOf(state, e.x, e.y);
  if (start < 0 || !isWaterCell(state.grid, start)) return;
  const n = searchFrom(state, start, 'water', state.tuning.bosses.coilPlanCells, Number.MAX_SAFE_INTEGER);
  const w = state.grid.width;
  const p = state.player;
  const g = state.grid;
  let best = start;
  let bestD2 = Infinity;
  let deep = -1;
  let deepD2 = Infinity;
  let gap2 = Infinity;
  for (let k = 0; k < n; k++) {
    const c = visited(k);
    const x = c % w;
    const y = (c - x) / w;
    const dx = x + 0.5 - gx;
    const dy = y + 0.5 - gy;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = c;
    }
    if (g.ground[c] === MAT.deep_water && d2 < deepD2) {
      deepD2 = d2;
      deep = c;
    }
    const px = x + 0.5 - p.x;
    const py = y + 0.5 - p.y;
    const p2 = px * px + py * py;
    if (p2 < gap2) gap2 = p2;
  }
  f.waterGap = Math.sqrt(gap2);
  // It keeps to deep water unless shallow water leads clearly closer (a lure path, not the rim).
  const T = state.tuning.bosses;
  const leave = g.borrowed[best] === 1 ? T.coilLeaveDeepBorrowed : T.coilLeaveDeep;
  if (deep >= 0 && Math.sqrt(deepD2) - Math.sqrt(bestD2) < leave) best = deep;
  if (best !== start) s.routeCell = routeStep(best, state.tuning.swim.lookahead);
}

/** Phase 1: true while the player is within lunge reach of its water (it hunts them then). */
export function coilHunting(state: GameState, e: Enemy): boolean {
  return e.boss!.phase >= 2 || e.boss!.fen!.waterGap <= state.tuning.bosses.coilLungeReach;
}

/** One tick of swimming: patrol (phase 1) or chase the player; returns the mode name for the AI overlay. */
export function stepCoilSwim(state: GameState, e: Enemy): string {
  const s = e.special;
  const f = e.boss!.fen!;
  const T = state.tuning.bosses;
  const hunt = coilHunting(state, e);
  let gx = state.player.x;
  let gy = state.player.y;
  if (!hunt) {
    const r = T.coilPatrolRadius;
    let [ox, oy] = PATROL[f.patrol % PATROL.length]!;
    gx = f.homeX + ox * r;
    gy = f.homeY + oy * r;
    if ((gx - e.x) ** 2 + (gy - e.y) ** 2 < ARRIVE * ARRIVE) {
      f.patrol = (f.patrol + 1) % PATROL.length;
      [ox, oy] = PATROL[f.patrol]!;
      gx = f.homeX + ox * r;
      gy = f.homeY + oy * r;
      f.planLeft = 0;
    }
  }
  const here = cellOf(state, e.x, e.y);
  const rc = s.routeCell;
  f.planLeft--;
  if (f.planLeft <= 0 || rc === here || (rc >= 0 && !isWaterCell(state.grid, rc))) {
    planCoil(state, e, gx, gy);
    f.planLeft = state.tuning.swim.repathTicks;
    // Its nearest water to this waypoint is where it already is: on to the next one.
    if (!hunt && s.routeCell < 0) f.patrol = (f.patrol + 1) % PATROL.length;
  }
  const moving = headFor(state, e, s.routeCell, swimSpeed(e, hunt ? 1 : T.coilPatrolSpeed));
  return moving ? (hunt ? 'chase' : 'patrol') : 'hold';
}
