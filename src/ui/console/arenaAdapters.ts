/**
 * Arena helpers for the console and HUD, wrapping src/sim/world/waves.ts with the return values
 * the callers want.
 */
import { killAllEnemies as killAll, startArenaWave as startWave, type GameState } from '../../sim';

/** True when the game runs arena waves. */
export function hasArena(state: GameState): boolean {
  return state.mode === 'arena';
}

/** Starts arena wave `n` now. Returns false outside arena mode. */
export function startArenaWave(state: GameState, n: number): boolean {
  if (!hasArena(state)) return false;
  startWave(state, n);
  return true;
}

/** Kills every live enemy (with death events). Returns how many were alive. */
export function killAllEnemies(state: GameState): number {
  const before = state.enemies.length;
  killAll(state);
  return before;
}
