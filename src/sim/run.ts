import type { InputFrame } from './core/input';
import { hashState } from './hashState';
import { createGame, type GameState } from './state';
import { step } from './step';
import type { Scenario } from './scenarios';
import type { Tuning } from '../../data/tuning';
import type { Cheats, GameMode } from './state';
import { applyLoadoutEdit, type LoadoutEdit, type LoadoutSpec } from './weave/runtime/loadout';
import { createAdventure } from './world/adventure';
import type { RoomSource, WorldState } from './world/worldState';
import type { HeroState } from './hero/types';

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
 * Loom edit between ticks when `state.tick === edit.tick` (edits in recorded order).
 * Adventure mode needs `rooms` (every room text by id): the game starts with createAdventure in
 * `roomId` (default: the start room), from `hero` and `world` when given.
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
    rooms?: RoomSource;
    roomId?: string;
    hero?: HeroState;
    world?: WorldState;
  },
): RunResult {
  const state =
    opts.mode === 'adventure' && opts.rooms
      ? createAdventure({
          seed: opts.seed,
          rooms: opts.rooms,
          startRoomId: opts.roomId,
          tuning: opts.tuning,
          loadout: opts.loadout,
          hero: opts.hero && structuredClone(opts.hero),
          world: opts.world && structuredClone(opts.world),
        })
      : createGame({
          seed: opts.seed,
          roomText,
          tuning: opts.tuning,
          mode: opts.mode,
          loadout: opts.loadout,
        });
  if (opts.cheats) state.cheats = { ...opts.cheats };
  const edits = opts.loadoutEdits ?? [];
  let next = 0;
  for (const f of frames) {
    while (next < edits.length && edits[next]!.tick <= state.tick) applyLoadoutEdit(state, edits[next++]!);
    step(state, f);
  }
  while (next < edits.length && edits[next]!.tick <= state.tick) applyLoadoutEdit(state, edits[next++]!);
  return { state, hash: hashState(state) };
}
