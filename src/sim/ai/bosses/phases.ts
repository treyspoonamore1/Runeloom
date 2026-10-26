/**
 * Boss fight state shared by the bosses (BossState, actors/enemyState.ts):
 * - Phase thresholds: when life falls to a threshold the next phase becomes pending; the boss's
 *   AI starts that phase's transition attack once its current attack ends (summon_hulks, flood,
 *   call_storm) and the phase begins when it lands (hooks.ts → enterPhase, 'bossPhase').
 * - Superheat (Cinder Warden, phases 2–3): takes tuning.bosses.superheatDamageTaken × damage
 *   (actors/chemistry.ts enemyTakenMult). A new Freeze breaks it for superheatBreakSeconds,
 *   counted from the freeze ('superheatChanged'). While chillNeedsWater, frost hits add chill
 *   only while he stands in water (combat/ailments.ts addChill reads inWater).
 * - M8: the Old Bellwether and the Glasswater Coil (fenPassive.ts).
 * stepBossPassive runs every tick for every live boss, frozen or not (ai/passive.ts).
 */
import { bossFightOf } from '../../../../data/enemies';
import type { Enemy } from '../../actors/enemies';
import { isWaterAt } from '../../actors/locomotion';
import { isFrozen } from '../../combat/ailments';
import { DT } from '../../core/constants';
import { emit } from '../../events';
import type { GameState } from '../../state';
import { stepBrazierStorm } from './braziers';
import { stepFenBossPassive } from './fenPassive';

/** Life fractions at which phases 2, 3, … begin, per boss. */
export function phaseThresholds(state: GameState, e: Enemy): readonly number[] {
  const T = state.tuning.bosses;
  const fight = bossFightOf(e.kind);
  if (fight === 'tar_matriarch') return [T.matriarchSummonAt];
  if (fight === 'cinder_warden') return [T.wardenPhase2At, T.wardenPhase3At];
  if (fight === 'bellwether') return [T.bellwetherPhase2At];
  if (fight === 'glasswater_coil') return [T.coilPhase2At, T.coilPhase3At];
  return [];
}

export function stepBossPassive(state: GameState, e: Enemy): void {
  const b = e.boss!;
  b.inWater = isWaterAt(state, e.x, e.y);
  const frozen = isFrozen(e);
  if (frozen && !b.wasFrozen && b.superheated) {
    b.superheated = false;
    b.breakLeft = state.tuning.bosses.superheatBreakSeconds;
    emit(state, {
      type: 'superheatChanged',
      id: e.id,
      superheated: false,
      seconds: b.breakLeft,
      x: e.x,
      y: e.y,
    });
  }
  b.wasFrozen = frozen;
  if (b.breakLeft > 0) {
    b.breakLeft = b.breakLeft > DT + 1e-9 ? b.breakLeft - DT : 0;
    if (b.breakLeft === 0) setSuperheat(state, e, true);
  }
  if (b.pendingPhase === 0) {
    const th = phaseThresholds(state, e);
    const next = b.phase + 1;
    if (next - 2 < th.length && e.life <= e.maxLife * th[next - 2]!) b.pendingPhase = next;
  }
  if (!state.cheats.noAI && bossFightOf(e.kind) === 'cinder_warden') stepBrazierStorm(state, e);
  stepFenBossPassive(state, e); // M8: the Old Bellwether's toll clock, the Glasswater Coil's states and pulses.
}

export function setSuperheat(state: GameState, e: Enemy, on: boolean): void {
  const b = e.boss!;
  b.breakLeft = 0;
  if (b.superheated === on) return;
  b.superheated = on;
  emit(state, { type: 'superheatChanged', id: e.id, superheated: on, seconds: 0, x: e.x, y: e.y });
}

/** The boss starts phase `phase` ('bossPhase'). */
export function enterPhase(state: GameState, e: Enemy, phase: number): void {
  const b = e.boss!;
  b.phase = phase;
  if (b.pendingPhase <= phase) b.pendingPhase = 0;
  emit(state, { type: 'bossPhase', id: e.id, kind: e.kind, phase, x: e.x, y: e.y });
}
