/**
 * Borrowed shallow water from sources other than Tide (DESIGN §6.5): Hydromancer's dodge trail
 * (CONTENT §7) and enemy puddles (Spark Heron and Glasswater Coil spit, CONTENT §5). Dry ground
 * becomes shallow water for a while, remembering the ground in `under`, and the cell is
 * `borrowed` (M8): when its timer ends it returns to `under` whatever it became meanwhile
 * (rule 27), so water that froze, or froze and thawed, goes back too. Map water is never touched.
 *
 * It is real water while it lasts: it wets, conducts Storm, steams under fire and freezes under
 * Frost (as borrowed ice, rule 27).
 */
import { MAT, SURFACE, materialByCode, type MaterialId } from '../../../data/materials';
import { hydromancerGrounds } from '../../../data/passives';
import type { GameState } from '../state';
import { borrowCell, gridTicks, u16 } from './cells';
import { rasterize } from './raster';

/** Lookup by material code: 1 where temporary water may cover the ground. */
function allowedTable(ids: readonly MaterialId[]): Uint8Array {
  const t = new Uint8Array(materialByCode.length);
  for (const id of ids) t[MAT[id]] = 1;
  return t;
}

let cached: { ids: readonly MaterialId[]; table: Uint8Array } | null = null;

/**
 * Covers the cells of `grounds` whose centers are within r of (x, y) with borrowed shallow water
 * for `seconds`. Borrowed water already there gets its timer topped up; map water is left alone.
 * Water puts out fire (but not burning oil, which floats). Returns the cells changed or topped up.
 */
export function placeTempWater(
  state: GameState,
  x: number,
  y: number,
  r: number,
  seconds: number,
  grounds: readonly MaterialId[],
): number {
  if (cached === null || cached.ids !== grounds) cached = { ids: grounds, table: allowedTable(grounds) };
  const allowed = cached.table;
  const g = state.grid;
  const ticks = u16(gridTicks(seconds));
  if (ticks <= 0) return 0;
  const list = rasterize(g, { kind: 'circle', x, y, r });
  const cells = list.cells.slice(0, list.len);
  let n = 0;
  for (const i of cells) {
    const code = g.ground[i]!;
    if (code === MAT.shallow_water || code === MAT.deep_water) {
      if (g.borrowed[i] === 1 && g.timer[i]! < ticks) {
        g.timer[i] = ticks;
        n++;
      }
      continue;
    }
    if (allowed[code] !== 1) continue;
    if (g.fire[i]! > 0 && g.surface[i] !== SURFACE.oil) {
      g.fire[i] = 0;
      g.fuel[i] = 0;
    }
    borrowCell(state, i, MAT.shallow_water, ticks);
    n++;
  }
  g.version++;
  return n;
}

/**
 * An enemy puddle (M8: Spark Heron spit, Glasswater Coil glass spit): borrowed shallow water of
 * radius r for `seconds` on dry ground (the Hydromancer grounds: stone, dirt, grass, ash, mud).
 * Returns the cells changed.
 */
export function placeBorrowedWater(
  state: GameState,
  x: number,
  y: number,
  r: number,
  seconds: number,
): number {
  return placeTempWater(state, x, y, r, seconds, hydromancerGrounds);
}
