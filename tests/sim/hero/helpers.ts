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
import { refreshHero } from '../../../src/sim/hero/hero';
import type { FusePart } from '../../../src/sim/hero/types';
import { passiveNodes, PASSIVE_START, type PassiveId } from '../../../data/passives';
import { passiveNeighbors } from '../../../src/sim/hero/passives';

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

/**
 * Allocates `ids` on the state's hero plus the shortest connecting path for each (no point
 * checks: tests set what they need), then refreshes HeroMods.
 */
export function allocate(state: GameState, ...ids: PassiveId[]): void {
  for (const id of ids) for (const n of pathFromAllocated(state.hero, id)) state.hero.passives.push(n);
  refreshHero(state);
}

/** Only `ids` (no path), then refreshes. */
export function allocateExactly(state: GameState, ...ids: PassiveId[]): void {
  state.hero.passives = [...ids];
  refreshHero(state);
}

function pathFromAllocated(hero: HeroState, id: PassiveId): PassiveId[] {
  const set = new Set<string>([PASSIVE_START, ...hero.passives]);
  if (set.has(id)) return [];
  const prev = new Map<PassiveId, PassiveId | null>();
  const q: PassiveId[] = [];
  for (const a of set) {
    prev.set(a as PassiveId, null);
    q.push(a as PassiveId);
  }
  for (let k = 0; k < q.length; k++)
    for (const n of passiveNeighbors[q[k]!]) {
      if (prev.has(n)) continue;
      prev.set(n, q[k]!);
      q.push(n);
    }
  const path: PassiveId[] = [];
  for (let at: PassiveId | null = id; at !== null && !set.has(at); at = prev.get(at) ?? null) path.push(at);
  if (!passiveNodes[id]) throw new Error(id);
  return path.reverse();
}

/** Equips a Twig spindle with `parts` fused (one socket each, as many as given) and refreshes. */
export function fuse(state: GameState, ...parts: [string, 1 | 2 | 3][]): void {
  const hero = state.hero;
  const fused: FusePart[] = parts.map(([part, tier]) => ({ uid: hero.nextUid++, part, tier }));
  const uid = hero.nextUid++;
  hero.items.push({ uid, base: 'twig', rarity: 'normal', itemLevel: 1, affixes: [], fused });
  hero.equipped.spindle = uid;
  refreshHero(state);
}
