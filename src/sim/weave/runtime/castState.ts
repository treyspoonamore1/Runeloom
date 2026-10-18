/** The player's Cast-trigger wind-up state (PlayerState.cast*), shared by casting and loadout edits. */
import { emit } from '../../events';
import type { GameState } from '../../state';

/** What the cast events call a slot's spell: its weave's root form id ('bolt', 'strike', …), or '' if empty. */
export function slotSpellName(state: GameState, slot: number): string {
  return state.weaves.slots[slot]?.program?.root.form ?? '';
}

export function endCast(state: GameState): void {
  const p = state.player;
  p.castSlot = -1;
  p.castSpell = null;
  p.castLeft = 0;
  p.castTime = 0;
  p.castReleased = false;
}

/** Stops the current cast. Sends 'castCancel' if it hadn't released yet. */
export function cancelCast(state: GameState): void {
  const p = state.player;
  if (p.castSlot < 0) return;
  if (!p.castReleased) emit(state, { type: 'castCancel', slot: p.castSlot, spell: slotSpellName(state, p.castSlot) });
  endCast(state);
}
