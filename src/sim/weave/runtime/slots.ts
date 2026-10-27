/**
 * How many weave slots there are, which are open, and which are live (Twin Threads, M7, CONTENT
 * §11; the second weave bar, playtest 8). Kept apart from loadout.ts so the HUD, saves, runes and
 * bots can ask without the compiler.
 *
 * Slot indices: 0–3 are bar 1's LMB, RMB, Q, E; 4 is R, open only with the Twin Threads mutation
 * and live on both bars; 5–8 are bar 2's LMB, RMB, Q, E. Saves and replays from before the second
 * bar hold slots 0–4 at the same indices.
 */
import { hasMutation } from '../../meta/mutations';
import type { GameState } from '../../state';

/** Number of weave slots: bar 1 (4), R (Twin Threads), bar 2 (4). */
export const LOADOUT_SLOTS = 9;

/** Slots every character has on bar 1 (LMB, RMB, Q, E); slot BASE_SLOTS is R. */
export const BASE_SLOTS = 4;

/** Twin Threads' slot (R): live on both bars. */
export const TWIN_SLOT = 4;

/** Number of weave bars; X swaps which one is live. */
export const BAR_COUNT = 2;

/** Each bar's slots, in button order (LMB, RMB, Q, E). */
export const BAR_SLOTS: readonly (readonly number[])[] = [
  [0, 1, 2, 3],
  [5, 6, 7, 8],
];

/** Live slots per active bar: its four, then R (the order Cast buttons are tried in). */
const LIVE_SLOTS: readonly (readonly number[])[] = [
  [...BAR_SLOTS[0]!, TWIN_SLOT],
  [...BAR_SLOTS[1]!, TWIN_SLOT],
];
const TWIN_ONLY: readonly number[] = [TWIN_SLOT];

/** Why a weave can't go in a locked slot. */
export const LOCKED_SLOT_MESSAGE = 'The R weave slot opens with the Twin Threads mutation';

/** The bar a slot belongs to: 0 or 1, or -1 for R (on both bars) and for no slot. */
export function barOf(slot: number): number {
  if (slot >= 0 && slot < BASE_SLOTS) return 0;
  if (slot > TWIN_SLOT && slot < LOADOUT_SLOTS) return 1;
  return -1;
}

/**
 * True when slots `a` and `b` can't hold the same rune item: the same bar's slots, and R with
 * any slot (R is live on both bars). The two bars share the rune pouch, so a bar-1 slot and a
 * bar-2 slot can socket the same item. A negative slot (none) clashes with every slot.
 */
export function slotsClash(a: number, b: number): boolean {
  if (a === b) return false;
  if (a < 0 || b < 0) return true;
  const ba = barOf(a);
  const bb = barOf(b);
  return ba < 0 || bb < 0 || ba === bb;
}

/** True if `slot` can hold a weave: every slot but R always, R with Twin Threads. */
export function slotOpen(state: GameState, slot: number): boolean {
  if (!Number.isInteger(slot) || slot < 0 || slot >= LOADOUT_SLOTS) return false;
  return slot !== TWIN_SLOT || hasMutation(state.hero, 'twin_threads');
}

/** How many slots are open: both bars (8), plus R with Twin Threads (9). */
export function openSlotCount(state: GameState): number {
  return hasMutation(state.hero, 'twin_threads') ? LOADOUT_SLOTS : LOADOUT_SLOTS - 1;
}

/** The fields of the loadout the bar helpers read. */
interface BarState {
  activeBar: number;
  swapLeft: number;
}

/**
 * The live slots: the active bar's four and R, in button order. Only these level their runes
 * (hero/runes.ts grantRuneXp), and the HUD shows them as the live bar.
 */
export function liveSlots(w: BarState): readonly number[] {
  return LIVE_SLOTS[w.activeBar === 1 ? 1 : 0]!;
}

/**
 * The slots that act this tick (buttons, Pulse, event triggers, their timers): the live slots,
 * or only R while the swap lockout runs (the new bar isn't ready yet). Every other slot is frozen.
 */
export function actingSlots(w: BarState): readonly number[] {
  return w.swapLeft > 0 ? TWIN_ONLY : liveSlots(w);
}
