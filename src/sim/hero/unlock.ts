/** Unlocking runes (CONTENT §9.1): random rune drops come only from unlocked runes. */
import type { RuneId } from '../../../data/runes';
import { emit } from '../events';
import type { GameState } from '../state';

/** Unlocks a rune (kept sorted) and sends 'runeUnlocked'. Returns false if it already was. */
export function unlockRune(state: GameState, rune: RuneId): boolean {
  const list = state.hero.unlockedRunes;
  if (list.includes(rune)) return false;
  list.push(rune);
  list.sort();
  emit(state, { type: 'runeUnlocked', rune });
  return true;
}
