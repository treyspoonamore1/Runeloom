/**
 * Cinder Warden (DESIGN §10.3, CONTENT §5, K10). Attacks, each on its EnemyAI.cooldowns slot:
 * - Fire breath (phases 2–3, slot 2): a 60° cone of 12 cells for 18 Fire + Ignite after 0.6 s,
 *   when the player is within its range; the fire steams on water.
 * - Fire slam (slot 0): when the player is within reach, a 6-cell circle for 40 Fire after
 *   0.8 s, leaving placed fire.
 * - Charge (slot 1): at a player he can see at least wardenChargeMinDistance away, a 1.0 s line
 *   telegraph, then a straight run past where they stood (wardenChargeOvershoot, stopping at
 *   walls) for 30 on contact, leaving placed fire that lights the grass ring.
 * Phase transitions (index.ts): flood at 66% (Superheated from then on), the brazier storm at 33%.
 */
import { attackByName, enemyDef } from '../../../../data/enemies';
import type { Enemy } from '../../actors/enemies';
import { dashLineLength, planDash } from '../../combat/dash';
import type { GameState } from '../../state';
import { toPlayer } from '../common';
import { bossAttack } from './attack';

/** Picks and starts an attack; returns true if one started. */
export function stepWarden(state: GameState, e: Enemy): boolean {
  const cds = e.ai.cooldowns;
  const ux = toPlayer.ux;
  const uy = toPlayer.uy;
  const breath = attackByName(e.kind, 'fire_breath')!;
  if (
    e.boss!.phase >= 2 &&
    toPlayer.gap <= breath.range &&
    cds[2]! <= 0 &&
    bossAttack(state, e, breath, ux, uy)
  ) {
    cds[2] = breath.cooldown;
    return true;
  }
  const slam = enemyDef(e.kind).attack!;
  if (toPlayer.gap <= slam.range && cds[0]! <= 0 && bossAttack(state, e, slam, ux, uy)) {
    cds[0] = slam.cooldown;
    return true;
  }
  const charge = attackByName(e.kind, 'charge')!;
  const T = state.tuning.bosses;
  if (cds[1]! <= 0 && e.ai.los && toPlayer.dist >= T.wardenChargeMinDistance && charge.dash) {
    const len = planDash(state, e, charge.dash, ux, uy, toPlayer.dist + T.wardenChargeOvershoot);
    if (
      len >= T.wardenChargeMinLength &&
      bossAttack(state, e, charge, ux, uy, { length: dashLineLength(e, len) })
    ) {
      cds[1] = charge.cooldown;
      return true;
    }
  }
  return false;
}
