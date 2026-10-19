import type { InputFrame } from './core/input';
import { hashState } from './hashState';
import { createGame, type GameState } from './state';
import { step } from './step';
import type { Scenario } from './scenarios';
import type { Tuning } from '../../data/tuning';
import type { Cheats, GameMode } from './state';
import { applyLoadoutEdit, type LoadoutEdit, type LoadoutSpec } from './weave/runtime/loadout';
import { applyHeroEdit, type TimedHeroEdit } from './hero/edits';

export interface RunResult {
  state: GameState;
  hash: number;
}

/** A fresh game set up the way `scenario` expects (its room text, seed, mode and setup). */
export function createScenarioGame(
  scenario: Scenario,
  roomText: string,
  opts: { seed: number; tuning?: Tuning },
): GameState {
  const state = createGame({ seed: opts.seed, roomText, tuning: opts.tuning, mode: scenario.mode });
  scenario.setup?.(state);
  return state;
}

/** Runs a scenario headlessly for `ticks` ticks and returns the final state and hash. */
export function runScenario(
  scenario: Scenario,
  roomText: string,
  opts: { seed: number; ticks: number; tuning?: Tuning },
): RunResult {
  const state = createScenarioGame(scenario, roomText, opts);
  for (let i = 0; i < opts.ticks; i++) step(state, scenario.input(state.tick, state));
  return { state, hash: hashState(state) };
}

/**
 * Replays recorded input frames from a fresh game, starting from `loadout` and applying each
 * Loom edit and hero edit between ticks when `state.tick === edit.tick` (each list in recorded
 * order; at one tick a hero edit goes after the first `after` Loom edits). `createState`
 * replaces the fresh game (an adventure started from a save); `roomText` is then unused.
 */
export function runFrames(
  frames: readonly InputFrame[],
  roomText: string,
  opts: {
    seed: number;
    tuning?: Tuning;
    mode?: GameMode;
    cheats?: Cheats;
    loadout?: LoadoutSpec;
    loadoutEdits?: readonly LoadoutEdit[];
    heroEdits?: readonly TimedHeroEdit[];
    createState?: () => GameState;
  },
): RunResult {
  const state = opts.createState
    ? opts.createState()
    : createGame({
        seed: opts.seed,
        roomText,
        tuning: opts.tuning,
        mode: opts.mode,
        loadout: opts.loadout,
      });
  if (opts.cheats) state.cheats = { ...opts.cheats };
  const edits = opts.loadoutEdits ?? [];
  const heroEdits = opts.heroEdits ?? [];
  let next = 0;
  let nextHero = 0;
  const applyDue = () => {
    for (;;) {
      const le = edits[next];
      const he = heroEdits[nextHero];
      const leDue = le !== undefined && le.tick <= state.tick;
      const heDue = he !== undefined && he.tick <= state.tick;
      if (heDue && (!leDue || he.after <= next)) {
        applyHeroEdit(state, he.edit);
        nextHero++;
      } else if (leDue) applyLoadoutEdit(state, edits[next++]!);
      else return;
    }
  };
  for (const f of frames) {
    applyDue();
    step(state, f);
  }
  applyDue();
  return { state, hash: hashState(state) };
}
