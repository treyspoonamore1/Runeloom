/**
 * Enemies avoid standing in hazards that hurt them when they can (CONTENT §5, DESIGN §6.3 hazard
 * ownership): burning or charged cells owned by the player or the world. Two layers:
 * - the flow field charges tuning.terrain.hazardTileCost extra for stepping into a tile with such
 *   a cell (markHazardTiles, before each rebuild), so paths bend around fires and live water;
 * - local steering (avoidHazards, after each behavior picks its velocity): a cell ahead that
 *   would hurt turns the enemy 45° or 90° toward a safe one (or it waits); an enemy already in
 *   one walks out the safest way.
 * Kinds with chemistry.ignoresHazards (Tinderlings) do neither; the shared flow field still bends.
 */
import { enemyDef } from '../../../data/enemies';
import { OWNER } from '../../../data/materials';
import type { Enemy } from '../actors/enemies';
import { TILE_CELLS } from '../core/constants';
import type { GameState } from '../state';
import { moveAlong } from './common';
import type { FlowField } from './flowField';

/** True if cell (cx, cy) burns or is charged by a team that can hurt enemies. Outside: false. */
export function hurtsEnemies(state: GameState, cx: number, cy: number): boolean {
  const g = state.grid;
  if (cx < 0 || cy < 0 || cx >= g.width || cy >= g.height) return false;
  const i = cy * g.width + cx;
  return (g.fire[i]! > 0 || g.charge[i]! > 0) && g.owner[i] !== OWNER.enemy;
}

/** Marks the tiles holding an enemy-hurting hazard in f.hazard, from the grid's active cells. */
export function markHazardTiles(state: GameState, f: FlowField): void {
  const h = f.hazard;
  h.fill(0);
  const g = state.grid;
  const a = g.active;
  const w = g.width;
  // Active cells include every burning and charged one (grid/active.ts).
  for (let k = 0; k < a.len; k++) {
    const i = a.list[k]!;
    if ((g.fire[i]! === 0 && g.charge[i]! === 0) || g.owner[i] === OWNER.enemy) continue;
    const x = i % w;
    const tx = Math.floor(x / TILE_CELLS);
    const ty = Math.floor((i - x) / w / TILE_CELLS);
    if (tx < f.tilesW && ty < f.tilesH) h[ty * f.tilesW + tx] = 1;
  }
}

// Turns tried, as (cos, sin) pairs: 45° and 90° to either side first, then back-quarters and
// straight back (only when already standing in a hazard).
const D = 0.7071067811865476;
const TURNS: ReadonlyArray<readonly [number, number]> = [
  [D, D],
  [D, -D],
  [0, 1],
  [0, -1],
  [-D, D],
  [-D, -D],
  [-1, 0],
];
const SIDE_TURNS = 4;

/** Local steering around hazards; see the file comment. Call after the behavior set e.vx/vy. */
export function avoidHazards(state: GameState, e: Enemy): void {
  const def = enemyDef(e.kind);
  if (def.chemistry?.ignoresHazards) return;
  const inHazard = hurtsEnemies(state, Math.floor(e.x), Math.floor(e.y));
  const v2 = e.vx * e.vx + e.vy * e.vy;
  if (v2 === 0) {
    if (inHazard) escape(state, e, e.facingX, e.facingY);
    return;
  }
  const v = Math.sqrt(v2);
  const ux = e.vx / v;
  const uy = e.vy / v;
  if (!aheadHurts(state, e, ux, uy)) return;
  const side = e.ai.strafe >= 0 ? 1 : -1;
  const n = inHazard ? TURNS.length : SIDE_TURNS;
  for (let k = 0; k < n; k++) {
    const [c, s0] = TURNS[k]!;
    const s = s0 * side;
    const dx = ux * c - uy * s;
    const dy = ux * s + uy * c;
    if (aheadHurts(state, e, dx, dy)) continue;
    e.vx = dx * v;
    e.vy = dy * v;
    return;
  }
  // Boxed in by fire: wait for it to burn down rather than walk in.
  if (!inHazard) e.vx = e.vy = 0;
}

/** Standing in a hazard with nowhere it wanted to go: walk out along the first safe direction. */
function escape(state: GameState, e: Enemy, fx: number, fy: number): void {
  if (!aheadHurts(state, e, fx, fy)) {
    moveAlong(e, fx, fy, 1);
    return;
  }
  for (const [c, s] of TURNS) {
    const dx = fx * c - fy * s;
    const dy = fx * s + fy * c;
    if (aheadHurts(state, e, dx, dy)) continue;
    moveAlong(e, dx, dy, 1);
    return;
  }
}

/** True if a cell on the way ahead (sampled every cell up to radius + hazardProbe) would hurt it. */
function aheadHurts(state: GameState, e: Enemy, ux: number, uy: number): boolean {
  const reach = e.radius + state.tuning.terrain.hazardProbe;
  for (let d = 1; ; d++) {
    const k = d < reach ? d : reach;
    if (hurtsEnemies(state, Math.floor(e.x + ux * k), Math.floor(e.y + uy * k))) return true;
    if (k >= reach) return false;
  }
}
