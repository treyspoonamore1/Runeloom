import type { InputFrame } from './core/input';
import type { GameState } from './state';
import { GRID_EVERY } from './core/constants';
import { stepPlayer } from './actors/player';

/**
 * Advances the simulation by one fixed 60 Hz tick. The only way sim state changes.
 * Replays, bots, tests and the app loop all call this.
 */
export function step(state: GameState, input: InputFrame): void {
  state.tick++;
  stepPlayer(state, input);
  if (state.tick % GRID_EVERY === 0) {
    // Chemistry grid tick (M3).
  }
  state.prevButtons = input.buttons;
}
