/** The `rifttier:N` door link and the conditional `@note` that goes with it (M8, CONTENT §6.2). */
import type { GameState } from '../state';
import { emit } from '../events';
import { bestTierEver } from '../meta/view';
import { riftGate } from '../../../data/riftGate';

/** `rifttier:N` (M8): best tier ever >= N, and no @exit of this room points at a missing room. */
export function riftTierLinkMet(state: GameState, tier: number): boolean {
  if (bestTierEver(state.hero) < tier) return false;
  return state.room.header.exits.every((e) => state.rooms[e.room] !== undefined);
}

/**
 * Conditional `@note` text (M8): `?rifttier:6 text` shows only when that link condition holds now,
 * `!rifttier:6 text` only when it doesn't; plain text always shows. Returns the text to show, or null.
 */
export function noteText(state: GameState, text: string): string | null {
  const m = /^([?!])rifttier:(\d+) (.*)$/.exec(text);
  if (!m) return text;
  return riftTierLinkMet(state, Number(m[2])) === (m[1] === '?') ? m[3]! : null;
}

/** Sends 'stormDoorWoke' once per save when the best tier ever reaches the storm door's tier. */
export function stepStormDoorHint(state: GameState): void {
  const w = state.world;
  if (w.stormDoorHinted || state.mode !== 'adventure') return;
  if (bestTierEver(state.hero) < riftGate.stormDoorTier) return;
  w.stormDoorHinted = true;
  emit(state, { type: 'stormDoorWoke' });
}
