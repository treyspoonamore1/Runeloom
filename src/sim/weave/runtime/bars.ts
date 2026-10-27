/**
 * The second weave bar (playtest 8, docs/DESIGN.md §4): X swaps which bar's four slots are live,
 * like a weapon swap. The swap happens inside the sim on the press edge of Button.SwapBar, so
 * replays reproduce it. It cancels a cast from the bar being left and ends its channels, and the
 * new bar's slots don't act until tuning.player.barSwapLockout has passed. R (Twin Threads) is
 * on both bars and is never interrupted.
 */
import { DT } from '../../core/constants';
import { Button, wasPressed, type InputFrame } from '../../core/input';
import { emit } from '../../events';
import type { GameState } from '../../state';
import { TIME_EPSILON } from './procs';
import { cancelCast } from './castState';
import { BAR_SLOTS, barOf } from './slots';

/**
 * Swaps the live bar now: cancels a cast from the bar being left, resets its Channel timers (as
 * if released) and starts the swap lockout. Its Pulse and ICD timers stay frozen where they are.
 * Sends 'barSwap'.
 */
export function swapBar(state: GameState): void {
  const w = state.weaves;
  const from = w.activeBar === 1 ? 1 : 0;
  const p = state.player;
  if (p.castSlot >= 0 && barOf(p.castSlot) === from) cancelCast(state);
  for (const i of BAR_SLOTS[from]!) {
    const s = w.slots[i]!;
    if (s.program?.trigger.event === 'held') s.periodLeft = 0;
  }
  w.activeBar = 1 - from;
  w.swapLeft = state.tuning.player.barSwapLockout;
  if (w.swapLeft <= TIME_EPSILON) w.swapLeft = 0;
  emit(state, { type: 'barSwap', bar: w.activeBar });
}

/**
 * Start of the trigger phase: counts the swap lockout down, then swaps on the press edge of
 * Button.SwapBar unless the player is dead or frozen (`blocked`). A swap's lockout counts from
 * the next tick: a lockout of d seconds lets the new bar act on tick T + 60d.
 */
export function stepBarSwap(state: GameState, input: InputFrame, blocked: boolean): void {
  const w = state.weaves;
  if (w.swapLeft > 0) {
    w.swapLeft -= DT;
    if (w.swapLeft <= TIME_EPSILON) w.swapLeft = 0;
  }
  if (!blocked && wasPressed(state.prevButtons, input.buttons, Button.SwapBar)) swapBar(state);
}
