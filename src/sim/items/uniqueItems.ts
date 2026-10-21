/**
 * Unique items (CONTENT §8, M5): making them and picking one to drop. What they do is in
 * hero/uniques.ts.
 */
import { uniques, type UniqueDef, type UniqueId } from '../../../data/uniques';
import type { GameState } from '../state';
import type { HeroState, Item } from '../hero/types';
import { makeItem } from './items';

/** A unique item; its item level is at least the unique's own. */
export function makeUnique(hero: HeroState, id: UniqueId, itemLevel = 1): Item {
  const def: UniqueDef = uniques[id];
  const item = makeItem(hero, def.base, 'unique', Math.max(itemLevel, def.itemLevel));
  item.unique = id;
  return item;
}

/** Uniques that can drop at an item level. */
export function uniquesAt(itemLevel: number): UniqueDef[] {
  return Object.values(uniques).filter((u: UniqueDef) => u.itemLevel <= itemLevel);
}

/** A unique the area level allows, picked by dropWeight with the loot RNG, or null if none can drop. */
export function rollUnique(state: GameState, itemLevel: number): Item | null {
  const list = uniquesAt(itemLevel);
  if (list.length === 0) return null;
  let total = 0;
  for (const u of list) total += u.dropWeight;
  let r = state.lootRng.float() * total;
  let pick = list[list.length - 1]!;
  for (const u of list) {
    r -= u.dropWeight;
    if (r < 0) {
      pick = u;
      break;
    }
  }
  return makeUnique(state.hero, pick.id as UniqueId, itemLevel);
}
