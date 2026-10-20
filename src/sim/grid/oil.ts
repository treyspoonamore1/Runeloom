/**
 * Spilling oil onto the grid (DESIGN §6.2 surface layer): an oil barrel's explosion and Tar
 * Gland's patches (hero/effectsCombat.ts). Oil covers walkable cells and water; oil spilled
 * into a fire catches at once.
 */
import { materialByCode, oil, OWNER, SURFACE } from '../../../data/materials';
import type { GameState } from '../state';
import { markActive } from './active';
import { gridTicks } from './cells';
import { rasterize } from './raster';

/**
 * Covers every walkable or water cell whose center is within r of (x, y) with oil; returns the
 * cells oiled. `skipOiled` (enemy trails and splats, combat/oil.ts): cells already oiled are left
 * as they are, so a trail over burning oil doesn't refill its fuel. `tar` (the Tar Matriarch's
 * splats): the oil is tar (grid.tar), and fire on it is world-owned; other oil spilled over tar
 * replaces it.
 */
export function spillOil(
  state: GameState,
  x: number,
  y: number,
  r: number,
  opts: { skipOiled?: boolean; tar?: boolean } = {},
): number {
  const g = state.grid;
  const t = state.tuning.grid;
  const spill = rasterize(g, { kind: 'circle', x, y, r });
  const tar = opts.tar === true ? 1 : 0;
  let n = 0;
  for (let k = 0; k < spill.len; k++) {
    const j = spill.cells[k]!;
    if (opts.skipOiled && g.surface[j] === SURFACE.oil) continue;
    const def = materialByCode[g.ground[j]!]!;
    if (!def.walk && def.water === null) continue;
    g.surface[j] = SURFACE.oil;
    g.tar[j] = tar;
    if (g.fire[j]! > 0) {
      // Oil spilled into a fire catches at once (burning oil keeps the invariant: oil + fire = oil burning).
      g.fire[j] = t.fireIntensity.oil;
      g.fuel[j] = gridTicks(oil.burnSeconds);
      if (tar === 1) g.owner[j] = OWNER.world;
    }
    markActive(g.active, j);
    n++;
  }
  g.version++;
  return n;
}
