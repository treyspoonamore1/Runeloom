import type { InputFrame } from './core/input';
import { hashState } from './hashState';
import { createGame, type GameState } from './state';
import { step } from './step';
import type { Scenario } from './scenarios';
import type { Tuning } from '../../data/tuning';

export interface RunResult {
  state: GameState;
  hash: number;
}

/** Runs a scenario headlessly for `ticks` ticks and returns the final state and hash. */
export function runScenario(
  scenario: Scenario,
  roomText: string,
  opts: { seed: number; ticks: number; tuning?: Tuning },
): RunResult {
  const state = createGame({ seed: opts.seed, roomText, tuning: opts.tuning });
  for (let i = 0; i < opts.ticks; i++) step(state, scenario.input(state.tick, state));
  return { state, hash: hashState(state) };
}

/** Replays recorded input frames from a fresh game. */
export function runFrames(
  frames: readonly InputFrame[],
  roomText: string,
  opts: { seed: number; tuning?: Tuning },
): RunResult {
  const state = createGame({ seed: opts.seed, roomText, tuning: opts.tuning });
  for (const f of frames) step(state, f);
  return { state, hash: hashState(state) };
}
