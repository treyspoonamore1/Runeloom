/**
 * Channel's walking slow (CONTENT §1.1, M5): kept apart from triggers.ts so actors/player.ts can
 * use it without importing the whole spell runtime (that import loop broke module mocks).
 */
import { Button, isHeld } from '../../core/input';
import type { GameState } from '../../state';
import { actingSlots } from './slots';

/**
 * Weave slot buttons in slot order (runtime/slots.ts): bar 1's LMB, RMB, Q, E, then R for Twin
 * Threads, then bar 2's LMB, RMB, Q, E (the same four buttons); loadout.ts re-exports it.
 */
export const SLOT_BUTTONS: readonly number[] = [
  Button.Cast1,
  Button.Cast2,
  Button.Cast3,
  Button.Cast4,
  Button.Cast5,
  Button.Cast1,
  Button.Cast2,
  Button.Cast3,
  Button.Cast4,
];

/**
 * Multiplier on walking speed from held Channel slots that act now (the live bar and R; 1 − their
 * trigger's moveSlow; the strongest one if several are held), or 1.
 */
export function channelMoveMult(state: GameState, buttons: number): number {
  let m = 1;
  for (const slot of actingSlots(state.weaves)) {
    const tr = state.weaves.slots[slot]?.program?.trigger;
    if (tr?.event !== 'held' || !isHeld(buttons, SLOT_BUTTONS[slot]!)) continue;
    const k = 1 - (tr.moveSlow ?? 0);
    if (k < m) m = k;
  }
  return m;
}
