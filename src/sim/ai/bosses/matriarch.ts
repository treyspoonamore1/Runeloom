/**
 * Tar Matriarch (CONTENT §5, K5): a slow Tar Hulk elite. She leaves no oil trail of her own (standing
 * in her own burning oil melted her in about 10 s); her globs, her rush and her Hulks bring the oil.
 * Her oil is tar (grid.tar): fire on it is world-owned whoever lights it, so it hurts everyone.
 * Attacks, each on its EnemyAI.cooldowns slot:
 * - Slam (slot 0): when the player is within reach, a 6-cell circle around her for 30 with 4 cells
 *   of knockback, after a 1.0 s telegraph.
 * - Tar glob (slot 1): at a player she can see within range, a lobbed glob landing where they stood
 *   0.8 s earlier (the landing marker is the telegraph) for 15, leaving a 4-cell splat of tar.
 * - Tar rush (phase 2, slot 2): at a player she can see at least matriarchRushMinDistance away, a
 *   0.9 s line telegraph, then a run past where they stood (matriarchRushOvershoot, stopping at
 *   walls) for 25 on contact, smearing tar along the way.
 * - At half life she calls her tar crew (index.ts phase transition, hooks.ts) and phase 2 begins:
 *   she walks matriarchPhase2Speed × faster and her cooldowns shrink to matriarchPhase2Cooldown ×.
 * - Lit while Oiled she flares (flare.ts).
 */
import { attackByName, enemyDef } from '../../../../data/enemies';
import type { Enemy } from '../../actors/enemies';
import { dashLineLength, planDash } from '../../combat/dash';
import type { GameState } from '../../state';
import { toPlayer } from '../common';
import { bossAttack } from './attack';

/** Her walking speed as a fraction of her def's: faster in phase 2. */
export function matriarchPace(state: GameState, e: Enemy): number {
  return e.boss !== null && e.boss.phase >= 2 ? state.tuning.bosses.matriarchPhase2Speed : 1;
}

/** Picks and starts an attack; returns true if one started. */
export function stepMatriarch(state: GameState, e: Enemy): boolean {
  const cds = e.ai.cooldowns;
  const phase2 = e.boss!.phase >= 2;
  const cdMult = phase2 ? state.tuning.bosses.matriarchPhase2Cooldown : 1;
  const slam = enemyDef(e.kind).attack!;
  if (toPlayer.gap <= slam.range && cds[0]! <= 0 && bossAttack(state, e, slam, toPlayer.ux, toPlayer.uy)) {
    cds[0] = slam.cooldown * cdMult;
    return true;
  }
  if (phase2 && rush(state, e, cdMult)) return true;
  const glob = attackByName(e.kind, 'tar_glob')!;
  if (toPlayer.dist <= glob.range && cds[1]! <= 0 && e.ai.los) {
    const p = state.player;
    if (bossAttack(state, e, glob, toPlayer.ux, toPlayer.uy, { x: p.x, y: p.y })) {
      cds[1] = glob.cooldown * cdMult;
      return true;
    }
  }
  return false;
}

/** Phase 2: the tar rush at a player in sight and far enough away. */
function rush(state: GameState, e: Enemy, cdMult: number): boolean {
  const cds = e.ai.cooldowns;
  const T = state.tuning.bosses;
  const def = attackByName(e.kind, 'tar_rush');
  if (!def?.dash || cds[2]! > 0 || !e.ai.los || toPlayer.dist < T.matriarchRushMinDistance) return false;
  const ux = toPlayer.ux;
  const uy = toPlayer.uy;
  const len = planDash(state, e, def.dash, ux, uy, toPlayer.dist + T.matriarchRushOvershoot);
  if (len < T.matriarchRushMinLength) return false;
  if (!bossAttack(state, e, def, ux, uy, { length: dashLineLength(e, len) })) return false;
  cds[2] = def.cooldown * cdMult;
  return true;
}
