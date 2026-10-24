/**
 * Channel's walking slow (CONTENT §1.1, M5): kept apart from triggers.ts so actors/player.ts can
 * use it without importing the whole spell runtime (that import loop broke module mocks).
 */
import { Button, isHeld } from '../../core/input';
import type { GameState } from '../../state';

/** Weave slot buttons in slot order (LMB, RMB, Q, E, and R for Twin Threads); loadout.ts re-exports it. */
export const SLOT_BUTTONS: readonly number[] = [
  Button.Cast1,
  Button.Cast2,
  Button.Cast3,
  Button.Cast4,
  Button.Cast5,
];

/**
 * Multiplier on walking speed from held Channel slots (1 − their trigger's moveSlow; the
 * strongest one if several are held), or 1.
 */
export function channelMoveMult(state: GameState, buttons: number): number {
  let m = 1;
  state.weaves.slots.forEach((s, slot) => {
    const tr = s.program?.trigger;
    if (tr?.event !== 'held' || !isHeld(buttons, SLOT_BUTTONS[slot]!)) return;
    const k = 1 - (tr.moveSlow ?? 0);
    if (k < m) m = k;
  });
  return m;
}
