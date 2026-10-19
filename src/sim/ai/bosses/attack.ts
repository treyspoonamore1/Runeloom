import type { AttackDef } from '../../../../data/enemies';
import type { Enemy } from '../../actors/enemies';
import { startEnemyAttack, type AttackAim } from '../../combat/enemyAttacks';
import type { GameState } from '../../state';
import { setMode, stop } from '../common';

/**
 * Starts a boss attack toward the unit direction (targeted: at `aim`), stops, and restarts the
 * attack gap. Returns false if it couldn't start.
 */
export function bossAttack(
  state: GameState,
  e: Enemy,
  def: AttackDef,
  dirX: number,
  dirY: number,
  aim?: AttackAim,
): boolean {
  if (!startEnemyAttack(state, e, dirX, dirY, def, aim)) return false;
  stop(e);
  setMode(e, 'windup');
  e.boss!.gap = state.tuning.bosses.attackGap;
  return true;
}
