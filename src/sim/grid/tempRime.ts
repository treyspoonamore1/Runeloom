/**
 * Rimewalkers' dodge trail (CONTENT §8, M5): Frost on the trail's disc (water freezes to ice, deep
 * water to ice bridge, fire goes out, rule 7–10), then dry ground becomes rime for a while. Rime
 * is slippery, remembers the ground in `under` and turns back when its material timer runs out
 * (`revertsToUnder`), like Hydromancer's water (grid/tempWater.ts).
 */
import { MAT, OWNER, materialByCode, type MaterialId } from '../../../data/materials';
import { PLAYER_ID } from '../actors/enemies';
import type { GameState } from '../state';
import { gridTicks, setGround, u16 } from './cells';
import { applyElement } from './paint';
import { rasterize } from './raster';

let cached: { ids: readonly MaterialId[]; table: Uint8Array } | null = null;

function allowedTable(ids: readonly MaterialId[]): Uint8Array {
  if (cached !== null && cached.ids === ids) return cached.table;
  const t = new Uint8Array(materialByCode.length);
  for (const id of ids) t[MAT[id]] = 1;
  cached = { ids, table: t };
  return t;
}

/** Freezes the disc of radius r at (x, y) and covers its `grounds` cells with rime for `seconds`. */
export function placeRime(
  state: GameState,
  x: number,
  y: number,
  r: number,
  seconds: number,
  grounds: readonly MaterialId[],
): void {
  applyElement(state, {
    element: 'frost',
    shape: { kind: 'circle', x, y, r },
    owner: OWNER.player,
    sourceId: PLAYER_ID,
    hitDamage: 0,
    durationMult: 1,
  });
  const allowed = allowedTable(grounds);
  const g = state.grid;
  const ticks = u16(gridTicks(seconds));
  if (ticks <= 0) return;
  const list = rasterize(g, { kind: 'circle', x, y, r });
  const cells = list.cells.slice(0, list.len);
  for (const i of cells) {
    const code = g.ground[i]!;
    if (code === MAT.rime) {
      if (g.timer[i]! < ticks) g.timer[i] = ticks;
      continue;
    }
    if (allowed[code] !== 1) continue;
    g.under[i] = code;
    setGround(state, i, MAT.rime);
    g.timer[i] = ticks;
  }
  g.version++;
}
