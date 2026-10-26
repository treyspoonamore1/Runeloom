/**
 * A Hot Slagshell steers clear of water (M8, CONTENT §5: "Avoids water while Hot"), the way
 * ai/hazards.ts steers enemies around fire: a water cell ahead turns it 45° or 90° toward dry
 * ground, or it waits. Once Cracked it walks through water like anyone. Luring one into a pool
 * (or Tide) is how the player cracks it.
 */
import { enemyDef } from '../../../data/enemies';
import type { Enemy } from '../actors/enemies';
import { isWaterAt } from '../actors/locomotion';
import type { GameState } from '../state';

const D = 0.7071067811865476;
const TURNS: ReadonlyArray<readonly [number, number]> = [
  [D, D],
  [D, -D],
  [0, 1],
  [0, -1],
];

/** Call after the behavior set e.vx/vy. */
export function avoidWaterWhileHot(state: GameState, e: Enemy): void {
  if (!e.special.hot || enemyDef(e.kind).chemistry?.hotShell === undefined) return;
  const v2 = e.vx * e.vx + e.vy * e.vy;
  if (v2 === 0 || isWaterAt(state, e.x, e.y)) return;
  const v = Math.sqrt(v2);
  const ux = e.vx / v;
  const uy = e.vy / v;
  if (!waterAhead(state, e, ux, uy)) return;
  const side = e.ai.strafe >= 0 ? 1 : -1;
  for (const [c, s0] of TURNS) {
    const s = s0 * side;
    const dx = ux * c - uy * s;
    const dy = ux * s + uy * c;
    if (waterAhead(state, e, dx, dy)) continue;
    e.vx = dx * v;
    e.vy = dy * v;
    return;
  }
  e.vx = e.vy = 0;
}

function waterAhead(state: GameState, e: Enemy, ux: number, uy: number): boolean {
  const reach = e.radius + state.tuning.terrain.hazardProbe;
  for (let d = 1; ; d++) {
    const k = d < reach ? d : reach;
    if (isWaterAt(state, e.x + ux * k, e.y + uy * k)) return true;
    if (k >= reach) return false;
  }
}
