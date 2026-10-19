/** Dev console helpers (CLAUDE.md debug features: `give`, `level`). They change state outside `step`. */
import type { RuneId } from '../../../data/runes';
import type { GameState } from '../state';
import { makeRune } from '../items/items';
import { refreshHero } from './hero';
import { unlockRune } from './unlock';

/** Adds `count` rune items of `rune` at `level` to the pouch and unlocks the rune. */
export function giveRunes(state: GameState, rune: RuneId, count = 1, level = 1): void {
  for (let i = 0; i < count; i++) state.hero.runes.push(makeRune(state.hero, rune, level));
  unlockRune(state, rune);
}

/** Sets the character level (XP toward the next level 0), refreshes the hero and fully heals. */
export function setHeroLevel(state: GameState, level: number): void {
  state.hero.level = Math.max(1, Math.floor(level));
  state.hero.xp = 0;
  refreshHero(state);
  const p = state.player;
  if (!p.dead) {
    p.life = p.maxLife;
    p.mana = p.maxMana;
  }
}
