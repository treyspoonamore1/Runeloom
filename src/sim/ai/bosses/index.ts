/**
 * Boss AI (DESIGN §10.3, §10.5, CONTENT §5): the Tar Matriarch, the Cinder Warden, and M8's Old
 * Bellwether (bellwether.ts) and Glasswater Coil (coil.ts). Shared loop:
 * - Attack phases freeze the boss in place (a charge runs along its dash instead).
 * - 'idle' until the player is within aggroRange with line of sight, or it is hurt; then it sends
 *   'bossAwake' and never leashes.
 * - A pending phase (phases.ts) starts its transition attack as soon as the boss is free.
 * - Otherwise the boss's own picker (PICKERS) chooses an attack whose EnemyAI.cooldowns slot is
 *   ready, at most one every tuning.bosses.attackGap s of free time, and walks toward the player
 *   in between (the Coil swims: patrols or chases through its water, coilRoute.ts; Stranded or
 *   Iced it does only what coil.ts coilHelpless allows).
 */
import { attackByName, enemyDef, type BehaviorDef } from '../../../../data/enemies';
import type { Enemy } from '../../actors/enemies';
import { actionSpeed } from '../../combat/ailments';
import { DT } from '../../core/constants';
import { emit } from '../../events';
import type { GameState } from '../../state';
import {
  aggro,
  deaggro,
  dashVelocity,
  faceVelocity,
  measurePlayer,
  refreshSight,
  setMode,
  sightDue,
  steerTo,
  stop,
  toPlayer,
} from '../common';
import { bossAttack } from './attack';
import { matriarchPace, stepMatriarch } from './matriarch';
import { stepWarden } from './warden';
import { stepBellwether } from './bellwether';
import { coilHelpless, moveCoil, stepCoil } from './coil';

type Boss = Extract<BehaviorDef, { kind: 'boss' }>;

/** The transition attack that starts each phase, by boss. */
const PHASE_ATTACKS: Record<Boss['boss'], readonly string[]> = {
  tar_matriarch: ['summon_hulks'],
  cinder_warden: ['flood', 'call_storm'],
  bellwether: ['toll_foundry'],
  glasswater_coil: ['coil_dive', 'call_pylons'],
};

/** Each boss's attack picker: starts an attack (or, the Bellwether, walks to its ring) and returns true. */
const PICKERS: Record<Boss['boss'], (state: GameState, e: Enemy) => boolean> = {
  tar_matriarch: stepMatriarch,
  cinder_warden: stepWarden,
  bellwether: stepBellwether,
  glasswater_coil: stepCoil,
};

export function stepBossAI(state: GameState, e: Enemy, b: Boss): void {
  const ai = e.ai;
  const dt = DT * actionSpeed(state, e);
  ai.timer += dt;
  const cds = ai.cooldowns;
  for (let k = 0; k < cds.length; k++) if (cds[k]! > 0) cds[k] = cds[k]! > dt ? cds[k]! - dt : 0;

  const phase = e.attack.phase;
  if (phase !== 'none') {
    if (phase === 'active' && e.special.dashSpeed > 0) dashVelocity(e);
    else stop(e);
    setMode(e, phase === 'windup' ? 'windup' : phase === 'active' ? 'attack' : 'recover');
    return;
  }
  if (state.player.dead) {
    if (ai.mode !== 'idle') deaggro(e);
    return;
  }
  measurePlayer(state, e);
  if (ai.mode === 'idle') {
    const alert = e.life < e.maxLife || state.mode === 'arena';
    if (!alert && toPlayer.dist > enemyDef(e.kind).aggroRange) return;
    if (sightDue(state, e)) refreshSight(state, e);
    if (!alert && !ai.los) return;
    aggro(state, e);
    emit(state, { type: 'bossAwake', id: e.id, kind: e.kind, name: enemyDef(e.kind).name, x: e.x, y: e.y });
  } else if (sightDue(state, e)) refreshSight(state, e);

  const boss = e.boss!;
  if (boss.gap > 0) boss.gap = boss.gap > dt ? boss.gap - dt : 0;
  // M8: the Coil Stranded or Iced only thrashes (coil.ts); its crawl is rule 31's (actors/strand.ts).
  if (b.boss === 'glasswater_coil' && coilHelpless(state, e)) return;
  if (boss.pendingPhase > 0) {
    const name = PHASE_ATTACKS[b.boss][boss.pendingPhase - 2];
    const def = name === undefined ? null : attackByName(e.kind, name);
    if (def && bossAttack(state, e, def, toPlayer.ux, toPlayer.uy)) return;
  }
  if (boss.gap <= 0 && PICKERS[b.boss](state, e)) return;
  if (b.boss === 'glasswater_coil') return moveCoil(state, e);
  // Walk at the player; in reach, plant and face them instead of shoving.
  if (toPlayer.gap <= 0) {
    stop(e);
    e.facingX = toPlayer.ux;
    e.facingY = toPlayer.uy;
    setMode(e, 'hold');
    return;
  }
  steerTo(state, e, state.player.x, state.player.y, b.boss === 'tar_matriarch' ? matriarchPace(state, e) : 1);
  setMode(e, 'chase');
  faceVelocity(e);
}
