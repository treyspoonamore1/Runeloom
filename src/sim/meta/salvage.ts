/**
 * The Salvage Loom (DESIGN §11, M7): gear picked up (or brought back by an expedition) at or
 * below the chosen rarity, and at most what the Loom's level allows (view.ts salvageCap), turns
 * into Thread Scrap at once instead of going into the bag. Never uniques. Thread Scrap =
 * round(scrapValues.item[rarity] × salvageMult(level)). Called by items/loot.ts grantContent.
 */
import { scrapValues } from '../../../data/loot';
import { emit } from '../events';
import type { Item } from '../hero/types';
import type { GameState } from '../state';
import type { SalvageSetting } from './types';
import { salvageCap, salvageMult } from './view';

/** Salvage settings from least to most. */
export const SALVAGE_ORDER: readonly SalvageSetting[] = ['off', 'normal', 'magic', 'rare'];

/** The rarity the Loom salvages up to now: the setting, capped by its level ('off' when unlit). */
export function salvageReach(state: GameState): SalvageSetting {
  const h = state.hero.hearth;
  if (!h.lit || state.mode !== 'adventure') return 'off';
  const cap = salvageCap(h.buildings.salvage_loom);
  return SALVAGE_ORDER[Math.min(SALVAGE_ORDER.indexOf(h.salvage), SALVAGE_ORDER.indexOf(cap))]!;
}

/** Whether the Loom takes this item now. */
export function salvagesItem(state: GameState, item: Readonly<Item>): boolean {
  if (item.rarity === 'unique') return false;
  const reach = SALVAGE_ORDER.indexOf(salvageReach(state));
  return reach > 0 && SALVAGE_ORDER.indexOf(item.rarity) <= reach;
}

/** Thread Scrap the Loom gives for an item at its current level. */
export function salvageScrap(state: GameState, item: Readonly<Item>): number {
  return Math.round(scrapValues.item[item.rarity] * salvageMult(state.hero.hearth.buildings.salvage_loom));
}

/**
 * Salvages `item` if the Loom takes it: Thread Scrap to the hero and 'autoSalvaged' at (x, y).
 * Returns true when it did (the item must not go into the bag).
 */
export function autoSalvage(state: GameState, item: Item, x: number, y: number): boolean {
  if (!salvagesItem(state, item)) return false;
  const scrap = salvageScrap(state, item);
  state.hero.threadScrap += scrap;
  emit(state, { type: 'autoSalvaged', base: item.base, rarity: item.rarity, scrap, x, y });
  return true;
}
