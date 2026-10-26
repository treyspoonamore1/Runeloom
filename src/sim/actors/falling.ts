/**
 * Rule 25 (DESIGN §6.3), extended to any ground that drops away: when the cell under an entity's
 * center stops being walkable (an ice bridge breaks, a bridge or wooden floor burns away), the
 * entity falls: it takes tuning.terrain.fall.lifeFraction of its max life (ignoring resistances
 * and i-frames) and returns to its last safe spot (TerrainState.safeX/Y), or, without one, to
 * the nearest safe cell within fall.searchRadius. Sends 'fell'.
 *
 * A safe cell is walkable and can't turn unwalkable under you: not an ice bridge (it melts or
 * breaks into deep water) and not wood over deep water or a pit.
 */
import { materialByCode, materials } from '../../../data/materials';
import { targetRef, type AilmentTarget } from '../combat/ailments';
import { dealDirectDamage } from '../combat/hits';
import { WORLD_SOURCE_ID } from '../grid/cells';
import type { Grid } from '../grid/grid';
import { emit } from '../events';
import type { GameState } from '../state';
import { circleOverlapsSolid } from './collision';
import { touchesLitVent } from '../grid/query';
import { ignoresGround } from './locomotion';

export function isSafeCell(g: Grid, i: number): boolean {
  const def = materialByCode[g.ground[i]!]!;
  if (!def.walk) return false;
  if (def.fireTo !== undefined && !materials[def.fireTo].walk) return false;
  if (def.flammable?.burntTo === 'under' && !materialByCode[g.under[i]!]!.walk) return false;
  return true;
}

function radiusOf(state: GameState, t: AilmentTarget): number {
  return 'kind' in t ? t.radius : state.tuning.player.radius;
}

/**
 * Nearest safe cell center within the search radius where a body of radius r fits, or null. Ties:
 * row-major order. `clear`: the spot must also be at least that far from any solid cell.
 */
function nearestSafe(state: GameState, x: number, y: number, r: number, clear = 0): [number, number] | null {
  const g = state.grid;
  const R = state.tuning.terrain.fall.searchRadius;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (let yy = Math.max(0, cy - R); yy <= Math.min(g.height - 1, cy + R); yy++)
    for (let xx = Math.max(0, cx - R); xx <= Math.min(g.width - 1, cx + R); xx++) {
      const px = xx + 0.5;
      const py = yy + 0.5;
      const d = (px - x) * (px - x) + (py - y) * (py - y);
      if (d >= bestD || !isSafeCell(g, yy * g.width + xx)) continue;
      if (circleOverlapsSolid(state.room, px, py, r + clear)) continue;
      best = [px, py];
      bestD = d;
    }
  return best;
}

export function fall(state: GameState, t: AilmentTarget): void {
  const ts = t.terrain;
  const r = radiusOf(state, t);
  const g = state.grid;
  let to: [number, number] | null = null;
  if (ts.hasSafe) {
    const i = Math.floor(ts.safeY) * g.width + Math.floor(ts.safeX);
    if (isSafeCell(g, i) && !circleOverlapsSolid(state.room, ts.safeX, ts.safeY, r))
      to = [ts.safeX, ts.safeY];
  }
  to ??= nearestSafe(state, t.x, t.y, r);
  if (to === null) return; // Nowhere to go: stay put (it keeps standing over the gap).
  const fromX = t.x;
  const fromY = t.y;
  t.x = t.prevX = to[0];
  t.y = t.prevY = to[1];
  t.vx = t.vy = 0;
  t.kbX = t.kbY = 0;
  ts.slideX = ts.slideY = 0;
  ts.safeX = to[0];
  ts.safeY = to[1];
  ts.hasSafe = true;
  if (t === state.player) state.player.dodgeLeft = 0;
  const damage = t.maxLife * state.tuning.terrain.fall.lifeFraction;
  emit(state, { type: 'fell', target: targetRef(t), fromX, fromY, toX: to[0], toY: to[1], damage });
  dealDirectDamage(state, t, damage, WORLD_SOURCE_ID);
}

/**
 * Rule 30 (M8): a doused furnace vent relit under the entity. Collision pushes it off: it moves
 * to the nearest safe spot clear of the vent's touch range (tuning.tide.ventTouch), so the relight
 * doesn't ignite it, with no fall damage. Sends 'pushedOff'. Stays put if nowhere fits.
 */
export function pushOff(state: GameState, t: AilmentTarget): void {
  const r = radiusOf(state, t);
  const to = nearestSafe(state, t.x, t.y, r, state.tuning.tide.ventTouch + 0.05);
  if (to === null) return;
  const fromX = t.x;
  const fromY = t.y;
  t.x = t.prevX = to[0];
  t.y = t.prevY = to[1];
  t.vx = t.vy = 0;
  t.kbX = t.kbY = 0;
  t.terrain.slideX = t.terrain.slideY = 0;
  emit(state, { type: 'pushedOff', target: targetRef(t), fromX, fromY, toX: to[0], toY: to[1] });
}

/**
 * Rule 30 (M8), after each grid tick: a body overlapping a lit vent can only have been standing
 * on its doused grate when it relit, so it is pushed off (pushOff) before collision or the vent's
 * touch can ignite it. Floating and fixed kinds are above it.
 */
export function pushOffVents(state: GameState): void {
  if (state.grid.vents === 0) return;
  const p = state.player;
  const r = state.tuning.player.radius;
  if (!p.dead && touchesLitVent(state, p.x, p.y, r - 1e-6, 0)) pushOff(state, p);
  for (const e of state.enemies)
    if (!e.dead && !ignoresGround(e.kind) && touchesLitVent(state, e.x, e.y, e.radius - 1e-6, 0))
      pushOff(state, e);
}
