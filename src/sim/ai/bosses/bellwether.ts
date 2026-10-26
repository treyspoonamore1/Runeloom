/**
 * The Old Bellwether (CONTENT §5, §13.2, F5): a colossal brass turtle, shelled (80% less damage)
 * until charge of another team or the world rings it open (actors/fenShells.ts, shared with the
 * Bellshell: stunned 1.5 s, open 5 s at 25% more damage taken, then 8 s before it can ring again;
 * never while rolling). Attacks, each on its EnemyAI.cooldowns slot:
 * - Snap (slot 0): a player within reach, a 9-cell 70° cone for 110 after 0.8 s.
 * - Toll ring (slot 1): a player within bellwetherRingRange, the shell glows 1.2 s with a ring
 *   marker out to 18 cells, then a ring wave expands to 18 cells over 0.4 s for 90
 *   (combat/enemyWave.ts): dodge through it or stand outside.
 * - Shell roll (slot 2): a player it sees at least bellwetherRollMinDistance away, a 0.9 s line,
 *   then a roll at 40 cells/s past where they stood (at most 36 cells, 50% farther on ice) for 120
 *   on contact; a roll planned into a wall stuns it 1 s where it ends.
 * - Phase 2 (at half life, the toll_foundry transition: it calls a sparkfly_cloud, hooks.ts):
 *   every bellwetherTollEvery s it self-tolls, a 1.2 s violet glow and then its own enemy charge
 *   in the water and metal under it (rules 11–13), which never rings it. It does that only on
 *   conducting ground: on the stone center it first walks back to the nearest metal or water.
 */
import { attackByName, enemyDef } from '../../../../data/enemies';
import { materialByCode } from '../../../../data/materials';
import { circleOverlapsSolid } from '../../actors/collision';
import type { Enemy } from '../../actors/enemies';
import { cellOf } from '../../actors/swim';
import { dashLineLength } from '../../combat/dash';
import type { GameState } from '../../state';
import { planCharge } from '../charger';
import { faceVelocity, moveAlong, setMode, toPlayer } from '../common';
import { bossAttack } from './attack';

/** Farthest it looks for conducting ground to self-toll on, cells. */
const TOLL_SEARCH = 24;

/** True if the cell under its center carries charge (metal, water, a brazier). */
export function onConductor(state: GameState, e: Enemy): boolean {
  const i = cellOf(state, e.x, e.y);
  return i >= 0 && materialByCode[state.grid.ground[i]!]!.conducts !== 'none';
}

/** Picks and starts an attack, or walks to conducting ground to self-toll; true if it did either. */
export function stepBellwether(state: GameState, e: Enemy): boolean {
  const cds = e.ai.cooldowns;
  const T = state.tuning.bosses;
  const f = e.boss!.fen!;
  const ux = toPlayer.ux;
  const uy = toPlayer.uy;
  if (e.boss!.phase >= 2 && f.tollLeft <= 0) {
    const toll = attackByName(e.kind, 'self_toll')!;
    if (onConductor(state, e)) {
      if (bossAttack(state, e, toll, ux, uy)) {
        f.tollLeft = T.bellwetherTollEvery;
        return true;
      }
    } else if (walkToConductor(state, e)) return true;
  }
  const snap = enemyDef(e.kind).attack!;
  if (toPlayer.gap <= snap.range && cds[0]! <= 0 && bossAttack(state, e, snap, ux, uy)) {
    cds[0] = snap.cooldown;
    return true;
  }
  const ring = attackByName(e.kind, 'toll_ring')!;
  if (toPlayer.dist <= T.bellwetherRingRange && cds[1]! <= 0 && bossAttack(state, e, ring, ux, uy)) {
    cds[1] = ring.cooldown;
    return true;
  }
  return roll(state, e);
}

/** The shell roll at a player in sight and far enough away. */
function roll(state: GameState, e: Enemy): boolean {
  const cds = e.ai.cooldowns;
  const T = state.tuning.bosses;
  const def = attackByName(e.kind, 'shell_roll');
  if (!def?.dash || !def.roll || cds[2]! > 0 || !e.ai.los || toPlayer.dist < T.bellwetherRollMinDistance)
    return false;
  const ux = toPlayer.ux;
  const uy = toPlayer.uy;
  const plan = planCharge(state, e, def.dash, def.roll, ux, uy, toPlayer.dist + T.bellwetherRollOvershoot);
  if (plan.length < T.bellwetherRollMinLength) return false;
  const wall = plan.wall;
  if (!bossAttack(state, e, def, ux, uy, { length: dashLineLength(e, plan.length) })) return false;
  e.boss!.fen!.rollWall = wall;
  cds[2] = def.cooldown;
  return true;
}

/** Walks toward the nearest conducting cell its body fits on within TOLL_SEARCH cells; false if none. */
function walkToConductor(state: GameState, e: Enemy): boolean {
  const g = state.grid;
  const cx = Math.floor(e.x);
  const cy = Math.floor(e.y);
  let best = TOLL_SEARCH * TOLL_SEARCH + 1;
  let bx = 0;
  let by = 0;
  for (let y = Math.max(0, cy - TOLL_SEARCH); y <= Math.min(g.height - 1, cy + TOLL_SEARCH); y++)
    for (let x = Math.max(0, cx - TOLL_SEARCH); x <= Math.min(g.width - 1, cx + TOLL_SEARCH); x++) {
      const i = y * g.width + x;
      if (materialByCode[g.ground[i]!]!.conducts === 'none' || state.room.solid[i] === 1) continue;
      const dx = x + 0.5 - e.x;
      const dy = y + 0.5 - e.y;
      const d2 = dx * dx + dy * dy;
      // Somewhere its shell fits (not jammed against a pylon).
      if (d2 < best && !circleOverlapsSolid(state.room, x + 0.5, y + 0.5, e.radius)) {
        best = d2;
        bx = dx;
        by = dy;
      }
    }
  if (best > TOLL_SEARCH * TOLL_SEARCH) return false;
  const d = Math.sqrt(best);
  moveAlong(e, bx / d, by / d, 1);
  setMode(e, 'to_ring');
  faceVelocity(e);
  return true;
}
