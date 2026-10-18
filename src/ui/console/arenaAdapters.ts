/**
 * Adapters between the console/HUD and the arena wave functions the AI agent adds in
 * src/sim/world/waves.ts (spawnWave, killAllEnemies, startArenaWave).
 *
 * They look the real functions up at build time (import.meta.glob finds waves.ts once it exists,
 * the sim barrel is checked too), so after the merge the real functions are used with no edit.
 * Until then each adapter has a small local fallback. Once waves.ts is merged you may replace
 * this whole file with direct imports; the three exported function names are all callers use.
 */
import * as simBarrel from '../../sim';
import type { GameState } from '../../sim';

type Fn = (...args: never[]) => unknown;

const modules = import.meta.glob('../../sim/world/waves.ts', { eager: true }) as Record<
  string,
  Record<string, unknown>
>;
const pool: Array<Record<string, unknown>> = [
  ...Object.values(modules),
  simBarrel as Record<string, unknown>,
];

function real(name: string): Fn | undefined {
  for (const m of pool) if (typeof m[name] === 'function') return m[name] as Fn;
  return undefined;
}

/** True when the sim has real arena waves (state.arena exists). */
export function hasArena(state: GameState): boolean {
  return (state as { arena?: unknown }).arena !== undefined;
}

/** Starts arena wave `n` now. Returns false if this build has no wave logic. */
export function startArenaWave(state: GameState, n: number): boolean {
  const fn = real('startArenaWave') as ((s: GameState, n: number) => unknown) | undefined;
  if (!fn) return false;
  fn(state, n);
  return true;
}

/** Kills every live enemy. Returns how many were alive. */
export function killAllEnemies(state: GameState): number {
  const before = state.enemies.length;
  const fn = real('killAllEnemies') as ((s: GameState) => unknown) | undefined;
  if (fn) {
    fn(state);
    return before;
  }
  // Fallback: remove them silently (no death events, no drops).
  state.enemies.length = 0;
  state.enemyHash.rebuild(state.enemies);
  return before;
}
