/**
 * Hooks for code that writes grid typed arrays directly (the Chemistry Lab runner restoring a
 * station from a pristine createGrid()). After such a write, call `wakeRegion` over the written
 * rectangle: it re-syncs the walk masks and re-activates every busy cell, so the grid tick picks
 * the region up again. All per-cell rule state lives in the Grid typed arrays; the active set is
 * the only derived per-cell structure, and a quiet cell left in it is dropped on the next tick.
 */
import { materialByCode } from '../../../data/materials';
import type { GameState } from '../state';
import { markActive } from './active';
import { busy } from './tick';

/** Clamped inclusive cell rectangle; calls fn for each cell index. */
function forRect(state: GameState, x0: number, y0: number, x1: number, y1: number, fn: (i: number) => void) {
  const g = state.grid;
  const ax = Math.max(0, Math.min(x0, x1));
  const ay = Math.max(0, Math.min(y0, y1));
  const bx = Math.min(g.width - 1, Math.max(x0, x1));
  const by = Math.min(g.height - 1, Math.max(y0, y1));
  for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) fn(y * g.width + x);
}

/**
 * Sets room.solid / room.shotSolid in the inclusive cell rectangle from each cell's current
 * material (data/materials.ts walk, blocksShots); bumps grid.walkVersion if any changed, so the
 * AI flow field rebuilds.
 */
export function syncWalkability(state: GameState, x0: number, y0: number, x1: number, y1: number): void {
  const room = state.room;
  const g = state.grid;
  let changed = false;
  forRect(state, x0, y0, x1, y1, (i) => {
    const def = materialByCode[g.ground[i]!]!;
    const solid = def.walk ? 0 : 1;
    const shot = def.blocksShots ? 1 : 0;
    if (room.solid[i] !== solid || room.shotSolid[i] !== shot) {
      room.solid[i] = solid;
      room.shotSolid[i] = shot;
      changed = true;
    }
  });
  if (changed) g.walkVersion++;
}

/**
 * After writing grid arrays directly in the inclusive cell rectangle: syncs walkability and puts
 * every busy cell (fire, charge, smoke/steam, wet, thaw/crack timers) back in the active set.
 * Bumps grid.version.
 */
export function wakeRegion(state: GameState, x0: number, y0: number, x1: number, y1: number): void {
  syncWalkability(state, x0, y0, x1, y1);
  const g = state.grid;
  forRect(state, x0, y0, x1, y1, (i) => {
    if (busy(g, i)) markActive(g.active, i);
  });
  g.version++;
}

/** wakeRegion over the whole grid (e.g. after replacing state.grid wholesale). */
export function wakeAll(state: GameState): void {
  wakeRegion(state, 0, 0, state.grid.width - 1, state.grid.height - 1);
}
