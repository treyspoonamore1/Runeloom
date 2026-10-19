/**
 * Tar Matriarch (CONTENT §5, K5): a slow Tar Hulk elite that leaves an oil trail (ai/passive.ts).
 * - Slam (EnemyAI.cooldowns[0]): when the player is within reach, a 6-cell circle around her for
 *   30 with 4 cells of knockback, after a 1.0 s telegraph.
 * - Tar glob (cooldowns[1]): at a player she can see within range, a lobbed glob landing where
 *   they stood 0.8 s earlier (the landing marker is the telegraph) for 15, leaving a 4-cell oil
 *   splat.
 * - At half life she summons 2 Tar Hulks (index.ts phase transition, hooks.ts).
 */
import { attackByName, enemyDef } from '../../../../data/enemies';
import type { Enemy } from '../../actors/enemies';
import type { GameState } from '../../state';
import { toPlayer } from '../common';
import { bossAttack } from './attack';

/** Picks and starts an attack; returns true if one started. */
export function stepMatriarch(state: GameState, e: Enemy): boolean {
  const cds = e.ai.cooldowns;
  const slam = enemyDef(e.kind).attack!;
  if (toPlayer.gap <= slam.range && cds[0]! <= 0 && bossAttack(state, e, slam, toPlayer.ux, toPlayer.uy)) {
    cds[0] = slam.cooldown;
    return true;
  }
  const glob = attackByName(e.kind, 'tar_glob')!;
  if (toPlayer.dist <= glob.range && cds[1]! <= 0 && e.ai.los) {
    const p = state.player;
    if (bossAttack(state, e, glob, toPlayer.ux, toPlayer.uy, { x: p.x, y: p.y })) {
      cds[1] = glob.cooldown;
      return true;
    }
  }
  return false;
}
