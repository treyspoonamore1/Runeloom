import {
  createGame,
  newGameHero,
  setupNewGameWeaves,
  type GameState,
  type HeroState,
  type RuneItem,
} from '../../../src/sim';
import { makeRune } from '../../../src/sim/items/items';
import type { RuneId } from '../../../data/runes';
import { place } from '../actors/helpers';

/** An open 40×30-tile room (interior cells 4..156 × 4..116). */
export const OPEN_ROOM = [
  '@id test/hero_open',
  '#'.repeat(40),
  ...Array.from({ length: 28 }, () => `#${'.'.repeat(38)}#`),
  '#'.repeat(40),
  '',
].join('\n');

/**
 * A new-game adventure (CONTENT §9.1 hero and weaves) in an open room, player at (80, 60), AI
 * frozen.
 */
export function adventure(seed = 1, hero: HeroState = newGameHero()): GameState {
  const state = createGame({ seed, roomText: OPEN_ROOM, mode: 'adventure', hero });
  setupNewGameWeaves(state);
  place(state, 80, 60);
  state.cheats.noAI = true;
  return state;
}

/** Gives the hero a rune item (pouch) and returns it. */
export function giveRune(state: GameState, rune: RuneId, level = 1): RuneItem {
  const r = makeRune(state.hero, rune, level);
  state.hero.runes.push(r);
  if (!state.hero.unlockedRunes.includes(rune)) state.hero.unlockedRunes.push(rune);
  return r;
}
