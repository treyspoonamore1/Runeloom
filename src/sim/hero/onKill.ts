/**
 * What a kill gives the character: XP for the hero and socketed runes, and loot drops.
 * Called from killEnemy (combat/hits.ts) for every enemy death except console kills.
 *
 * CONTRACT (M4): owned by the hero/items agent (XP: src/sim/hero, drops: src/sim/items). Only
 * adventure mode pays out; sandbox, arena and lab kills give nothing, so their hashes don't change.
 */
import type { Enemy } from '../actors/enemies';
import type { DeathCause } from '../events';
import type { GameState } from '../state';

export function onEnemyKilled(state: GameState, e: Enemy, killerId: number, cause: DeathCause): void {
  if (state.mode !== 'adventure') return;
  void e;
  void killerId;
  void cause;
}
