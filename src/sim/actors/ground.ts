/**
 * How the ground under a walking body changes its movement (DESIGN §6.2): the material's
 * moveMult (shallow water 0.8, mud 0.6) times oil's (0.85) when the cell has oil, and slippery
 * ice. Written into the body's TerrainState (moveMult, onIce) for render, and returned.
 */
import { SURFACE, materialByCode, oil } from '../../../data/materials';
import type { GameState } from '../state';
import type { TerrainState } from './terrainState';

export function readGround(state: GameState, x: number, y: number, ts: TerrainState): TerrainState {
  const g = state.grid;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= g.width || cy >= g.height) {
    ts.moveMult = 1;
    ts.onIce = false;
    return ts;
  }
  const i = cy * g.width + cx;
  const def = materialByCode[g.ground[i]!]!;
  ts.moveMult = g.surface[i] === SURFACE.oil ? def.moveMult * oil.moveMult : def.moveMult;
  ts.onIce = def.slippery;
  return ts;
}
