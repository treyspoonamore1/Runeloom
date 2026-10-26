/**
 * The Fen bosses' per-tick bookkeeping (M8), from ai/passive.ts and phases.ts, frozen or not:
 * - Old Bellwether, phase 2: the self-toll clock (bellwether.ts starts the toll when it is due).
 * - Glasswater Coil: ice breaking while freezing can't hold it (before the swimmer step), the Iced
 *   hold, the spit volley, the pulses and the pylon storm (not with AI off), and its state.
 */
import { bossFightOf } from '../../../../data/enemies';
import type { Enemy } from '../../actors/enemies';
import { DT } from '../../core/constants';
import type { GameState } from '../../state';
import { stepCoilCharge } from './coilPulse';
import { stepVolley } from './coilSpit';
import { stepCoilIce, stepCoilIced, updateCoilMode } from './coilState';

/** Before rule 31's swimmer step (ai/passive.ts). */
export function stepFenBossBeforeSwim(state: GameState, e: Enemy): void {
  if (e.boss?.fen && bossFightOf(e.kind) === 'glasswater_coil') stepCoilIce(state, e);
}

/** After it (phases.ts stepBossPassive). */
export function stepFenBossPassive(state: GameState, e: Enemy): void {
  const f = e.boss?.fen;
  if (!f) return;
  const fight = bossFightOf(e.kind);
  if (fight === 'bellwether') {
    if (e.boss!.phase >= 2 && e.ai.mode !== 'idle' && f.tollLeft > 0) f.tollLeft = Math.max(0, f.tollLeft - DT);
    return;
  }
  if (fight !== 'glasswater_coil') return;
  stepCoilIced(state, e);
  stepVolley(state, e);
  if (!state.cheats.noAI) stepCoilCharge(state, e);
  updateCoilMode(state, e);
}
