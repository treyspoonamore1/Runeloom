/**
 * The Glasswater Coil (DESIGN §10.5, CONTENT §5, F10): a huge electric eel that swims any water
 * (actors/swim.ts, its route in coilRoute.ts), always Wet, with the boss chill rule. Its states
 * (Submerged, Surfaced, Exposed, Stranded, Iced, Overloaded) and what they do to the damage it
 * takes are coilState.ts; its pulses and the pylon storm are coilPulse.ts. Attacks, each on its
 * EnemyAI.cooldowns slot:
 * - Lunge (slot 0): from water, at a player it sees within coilLungeReach cells of its water
 *   (phases 2–3: coilLungeReachDeep), a 1.0 s ripple line, then a dash at 44 cells/s through the
 *   water toward them, up to 22 cells, stopping at the water's edge, 150 on contact.
 * - Glass spit (slot 1): at a player it sees farther than coilSpitBeyond cells from its water, a
 *   0.6 s mouth glow and aim line, then a glass bolt for 70 Storm that leaves a puddle where it
 *   lands (coilSpit.ts). Phases 2–3: volleys of 3, 0.3 s apart.
 * - Tail thrash (slot 3): its only attack while Stranded, a 7-cell circle for 100 after 0.7 s.
 * - Iced, it does nothing; Overloaded, it is stunned (it doesn't think).
 * Phase transitions (index.ts): coil_dive at 66% (it dives deeper), call_pylons at 33%.
 */
import { attackByName, enemyDef } from '../../../../data/enemies';
import type { Enemy } from '../../actors/enemies';
import { dashLineLength, planDash } from '../../combat/dash';
import type { GameState } from '../../state';
import { setMode, toPlayer } from '../common';
import { bossAttack } from './attack';
import { stepCoilSwim } from './coilRoute';

/** Shortest lunge worth making, cells. */
const MIN_LUNGE = 2;

/**
 * Stranded or Iced: it can't swim or start a phase. Stranded, it thrashes at a player in reach
 * (its crawl back to water is actors/strand.ts). Returns true if it was helpless this tick.
 */
export function coilHelpless(state: GameState, e: Enemy): boolean {
  const s = e.special;
  if (s.trapped) {
    e.vx = e.vy = 0;
    setMode(e, 'iced');
    return true;
  }
  if (!s.stranded) return false;
  setMode(e, 'stranded');
  const thrash = attackByName(e.kind, 'tail_thrash')!;
  const cds = e.ai.cooldowns;
  if (e.boss!.gap <= 0 && toPlayer.gap <= thrash.range && cds[3]! <= 0)
    if (bossAttack(state, e, thrash, toPlayer.ux, toPlayer.uy)) cds[3] = thrash.cooldown;
  return true;
}

/** Picks and starts a lunge or a spit; returns true if one started. */
export function stepCoil(state: GameState, e: Enemy): boolean {
  const cds = e.ai.cooldowns;
  const T = state.tuning.bosses;
  const f = e.boss!.fen!;
  const deep = e.boss!.phase >= 2;
  const ux = toPlayer.ux;
  const uy = toPlayer.uy;
  if (!e.ai.los) return false;
  const lunge = enemyDef(e.kind).attack!;
  const dash = lunge.dash!;
  const reach = deep ? T.coilLungeReachDeep : T.coilLungeReach;
  const lungeDist = dash.maxLength + e.radius + state.tuning.player.radius + dash.reach;
  if (cds[0]! <= 0 && f.waterGap <= reach && toPlayer.dist <= lungeDist + reach) {
    const len = planDash(state, e, dash, ux, uy, toPlayer.dist);
    if (len >= MIN_LUNGE && bossAttack(state, e, lunge, ux, uy, { length: dashLineLength(e, len) })) {
      cds[0] = lunge.cooldown;
      return true;
    }
  }
  const spit = attackByName(e.kind, 'glass_spit')!;
  if (cds[1]! <= 0 && f.waterGap > T.coilSpitBeyond && toPlayer.dist <= spit.range) {
    if (bossAttack(state, e, spit, ux, uy)) {
      cds[1] = spit.cooldown;
      return true;
    }
  }
  return false;
}

/** Swims (patrol or chase) when it isn't attacking. */
export function moveCoil(state: GameState, e: Enemy): void {
  setMode(e, stepCoilSwim(state, e));
  e.facingX = toPlayer.ux;
  e.facingY = toPlayer.uy;
}
