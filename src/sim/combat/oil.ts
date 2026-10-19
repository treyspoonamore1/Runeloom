/**
 * Oil that enemies put on the ground (M4): the Tar Matriarch's glob splats and Tar Hulk
 * trails. Oil goes on walkable and water cells (it floats, DESIGN §6.2); oil spilled
 * into fire catches at once, like a barrel's spill (grid/tick.ts explode).
 */
import { SURFACE, materialByCode, oil } from '../../../data/materials';
import { markActive } from '../grid/active';
import { gridTicks } from '../grid/cells';
import { rasterize } from '../grid/raster';
import type { GameState } from '../state';

/** Oil on every walkable or water cell whose center is within `r` of (x, y). Returns cells oiled. */
export function spillOil(state: GameState, x: number, y: number, r: number): number {
  const g = state.grid;
  const list = rasterize(g, { kind: 'circle', x, y, r });
  const intensity = state.tuning.grid.fireIntensity.oil;
  let n = 0;
  for (let k = 0; k < list.len; k++) {
    const j = list.cells[k]!;
    if (g.surface[j] === SURFACE.oil) continue;
    const def = materialByCode[g.ground[j]!]!;
    if (!def.walk && def.water === null) continue;
    g.surface[j] = SURFACE.oil;
    if (g.fire[j]! > 0) {
      g.fire[j] = intensity;
      g.fuel[j] = gridTicks(oil.burnSeconds);
    }
    markActive(g.active, j);
    n++;
  }
  if (n > 0) g.version++;
  return n;
}
