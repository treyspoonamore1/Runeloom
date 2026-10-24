/**
 * How many weave slots there are and which are open (Twin Threads, M7, CONTENT §11): every
 * loadout has LOADOUT_SLOTS slots; the fifth (R) is locked unless the hero owns the mutation.
 * Kept apart from loadout.ts so the HUD, saves and bots can ask without the compiler.
 */
import { hasMutation } from '../../meta/mutations';
import type { GameState } from '../../state';

/** Number of weave slots (LMB, RMB, Q, E, R); the last opens with Twin Threads. */
export const LOADOUT_SLOTS = 5;

/** Slots every character has (LMB, RMB, Q, E); slots from here on are Twin Threads'. */
export const BASE_SLOTS = 4;

/** Why a weave can't go in a locked slot. */
export const LOCKED_SLOT_MESSAGE = 'The fifth weave slot (R) opens with the Twin Threads mutation';

/** True if `slot` can hold a weave: the four base slots always, the fifth with Twin Threads. */
export function slotOpen(state: GameState, slot: number): boolean {
  return slot < BASE_SLOTS || (slot < LOADOUT_SLOTS && hasMutation(state.hero, 'twin_threads'));
}

/** How many slots are open, counted from slot 0 (4, or 5 with Twin Threads). */
export function openSlotCount(state: GameState): number {
  return hasMutation(state.hero, 'twin_threads') ? LOADOUT_SLOTS : BASE_SLOTS;
}
