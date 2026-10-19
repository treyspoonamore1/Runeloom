/**
 * Oil that enemies put on the ground (M4): the Tar Matriarch's glob splats and Tar Hulk
 * trails. One implementation with barrels and Tar Gland (grid/oil.ts): oil goes on walkable and
 * water cells (it floats, DESIGN §6.2) and catches at once in fire; cells already oiled are left
 * alone.
 */
import { spillOil as spillOilOnGrid } from '../grid/oil';
import type { GameState } from '../state';

/** Oil on every walkable or water cell whose center is within `r` of (x, y). Returns cells oiled. */
export function spillOil(state: GameState, x: number, y: number, r: number): number {
  return spillOilOnGrid(state, x, y, r, { skipOiled: true });
}
