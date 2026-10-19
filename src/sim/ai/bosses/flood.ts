/**
 * The Cinder Warden's phase 2 flood (DESIGN §10.3): the channels overflow and about half the
 * floor becomes shallow water. Breadth-first from every water cell, through walkable cells, in
 * whole rings (4-neighbor steps, fixed neighbor order), until water covers at least
 * tuning.bosses.floodFraction of the room's floor (walkable or water cells). Flooded cells
 * become permanent shallow water over their old ground (`under`); fire on them goes out for good
 * (fuel too), oil floats on. The grid arrays are written directly, then wakeRegion re-syncs
 * walkability and the active set (grid/region.ts).
 */
import { MAT, materialByCode } from '../../../../data/materials';
import { wakeRegion } from '../../grid/region';
import type { Enemy } from '../../actors/enemies';
import { emit } from '../../events';
import type { GameState } from '../../state';

const DX = [1, -1, 0, 0];
const DY = [0, 0, 1, -1];

/** Floods the room; returns how many cells became water. */
export function floodArena(state: GameState, e: Enemy): number {
  const g = state.grid;
  const w = g.width;
  const n = w * g.height;
  const seen = new Uint8Array(n);
  let ring: number[] = [];
  let floor = 0;
  let water = 0;
  for (let i = 0; i < n; i++) {
    const def = materialByCode[g.ground[i]!]!;
    if (def.water !== null) {
      water++;
      floor++;
      seen[i] = 1;
      ring.push(i);
    } else if (def.walk) floor++;
  }
  const target = floor * state.tuning.bosses.floodFraction;
  let minX = w;
  let minY = g.height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  while (water < target && ring.length > 0) {
    const next: number[] = [];
    for (const i of ring) {
      const x = i % w;
      const y = (i - x) / w;
      for (let k = 0; k < 4; k++) {
        const nx = x + DX[k]!;
        const ny = y + DY[k]!;
        if (nx < 0 || ny < 0 || nx >= w || ny >= g.height) continue;
        const j = ny * w + nx;
        if (seen[j] === 1) continue;
        seen[j] = 1;
        if (!materialByCode[g.ground[j]!]!.walk) continue;
        next.push(j);
      }
    }
    for (const j of next) {
      g.under[j] = g.ground[j]!;
      g.ground[j] = MAT.shallow_water;
      g.timer[j] = 0;
      g.fire[j] = 0;
      g.fuel[j] = 0;
      g.wet[j] = 0;
      const x = j % w;
      const y = (j - x) / w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    count += next.length;
    water += next.length;
    ring = next;
  }
  if (count === 0) return 0;
  wakeRegion(state, minX, minY, maxX, maxY);
  emit(state, { type: 'flood', id: e.id, count, minX, minY, maxX, maxY });
  return count;
}
