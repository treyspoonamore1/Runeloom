/**
 * Temporary shallow water (Hydromancer's dodge trail, CONTENT §7): dry ground becomes shallow
 * water for a while, remembering the ground in `under`, and the grid tick turns it back when its
 * material timer runs out (shallow water's `revertsToUnder`). Map water has timer 0 and stays.
 *
 * It is real water while it lasts: it wets, conducts Storm, steams under fire and freezes under
 * Frost. Known limit: water that freezes and thaws again (or melts back) stays as water.
 */
import { MAT, SURFACE, materialByCode, type MaterialId } from '../../../data/materials';
import type { GameState } from '../state';
import { gridTicks, setGround, u16 } from './cells';
import { rasterize } from './raster';

/** Lookup by material code: 1 where temporary water may cover the ground. */
function allowedTable(ids: readonly MaterialId[]): Uint8Array {
  const t = new Uint8Array(materialByCode.length);
  for (const id of ids) t[MAT[id]] = 1;
  return t;
}

let cached: { ids: readonly MaterialId[]; table: Uint8Array } | null = null;

/**
 * Covers the cells of `grounds` whose centers are within r of (x, y) with shallow water for
 * `seconds`. Existing temporary water gets its timer topped up; map water is left alone. Water
 * puts out fire (but not burning oil, which floats).
 */
export function placeTempWater(
  state: GameState,
  x: number,
  y: number,
  r: number,
  seconds: number,
  grounds: readonly MaterialId[],
): void {
  if (cached === null || cached.ids !== grounds) cached = { ids: grounds, table: allowedTable(grounds) };
  const allowed = cached.table;
  const g = state.grid;
  const ticks = u16(gridTicks(seconds));
  if (ticks <= 0) return;
  const list = rasterize(g, { kind: 'circle', x, y, r });
  const cells = list.cells.slice(0, list.len);
  for (const i of cells) {
    const code = g.ground[i]!;
    if (code === MAT.shallow_water) {
      if (g.timer[i]! > 0 && g.timer[i]! < ticks) g.timer[i] = ticks;
      continue;
    }
    if (allowed[code] !== 1) continue;
    if (g.fire[i]! > 0 && g.surface[i] !== SURFACE.oil) {
      g.fire[i] = 0;
      g.fuel[i] = 0;
    }
    g.under[i] = code;
    setGround(state, i, MAT.shallow_water);
    g.timer[i] = ticks;
  }
  g.version++;
}
