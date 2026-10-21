/**
 * The crafting bench (DESIGN §8.5, M5): applying one currency to one item or rune. `craftItem` and
 * `polishRune` are pure apart from the RNG they get, so tests can roll them 100,000 times;
 * `applyCraft` is the HeroEdit: it checks the stack, uses GameState.craftRng and spends one
 * currency only when the craft applies.
 */
import { currencies, isCurrencyId, maxRuneQuality, type CurrencyId } from '../../../data/currency';
import type { Rng } from '../core/rng';
import type { GameState } from '../state';
import type { Item, RuneItem } from '../hero/types';
import { rollMagicAffixes } from './affixRoll';
import { findItem, kindOfBase } from './items';
import { rollExtraAffix, rollRareAffixes, rollRareName, sortAffixes } from './rare';

const RARITY_NAME = { normal: 'Normal', magic: 'Magic', rare: 'Rare', unique: 'Unique' } as const;

/**
 * Applies an item currency to `item` in place, or returns why it can't (the item is unchanged).
 * Rune Polish isn't an item currency (see polishRune).
 */
export function craftItem(rng: Rng, item: Item, currency: CurrencyId): string | null {
  const kind = kindOfBase(item.base);
  if (!kind) return 'Unknown item';
  if (item.rarity === 'unique') return "Uniques can't be changed";
  const need = (r: Item['rarity']) =>
    `Needs a ${RARITY_NAME[r]} item; this one is ${RARITY_NAME[item.rarity]}`;
  switch (currency) {
    case 'weavers_knot':
      if (item.rarity !== 'normal') return need('normal');
      item.rarity = 'magic';
      item.affixes = sortAffixes(rollMagicAffixes(rng, kind, item.itemLevel));
      return null;
    case 'spool_of_change':
      if (item.rarity !== 'magic') return need('magic');
      item.affixes = sortAffixes(rollMagicAffixes(rng, kind, item.itemLevel));
      return null;
    case 'loom_shuttle':
      if (item.rarity !== 'normal') return need('normal');
      item.rarity = 'rare';
      item.name = rollRareName(rng, kind);
      item.affixes = rollRareAffixes(rng, kind, item.itemLevel);
      return null;
    case 'chaos_skein':
      if (item.rarity !== 'rare') return need('rare');
      item.affixes = rollRareAffixes(rng, kind, item.itemLevel);
      return null;
    case 'golden_needle': {
      if (item.rarity !== 'rare') return need('rare');
      const a = rollExtraAffix(rng, kind, item.itemLevel, 'rare', item.affixes);
      if (!a) return 'It has no room for another affix';
      item.affixes = sortAffixes([...item.affixes, a]);
      return null;
    }
    case 'unpick': {
      if (item.rarity !== 'magic' && item.rarity !== 'rare') return 'Needs a Magic or Rare item';
      if (item.affixes.length === 0) return 'It has no affixes to remove';
      const i = rng.int(item.affixes.length);
      item.affixes = item.affixes.filter((_, j) => j !== i);
      return null;
    }
    case 'rune_polish':
      return 'Rune Polish works on runes';
  }
}

/** Rune Polish: +1% quality, up to maxRuneQuality. */
export function polishRune(rune: RuneItem): string | null {
  if (rune.quality >= maxRuneQuality) return `Quality is already ${maxRuneQuality}%`;
  rune.quality += 1;
  return null;
}

/** How many of a currency the hero holds. */
export function currencyCount(state: GameState, currency: CurrencyId): number {
  return state.hero.currency[currency] ?? 0;
}

export function addCurrency(state: GameState, currency: CurrencyId, n: number): void {
  const next = (state.hero.currency[currency] ?? 0) + n;
  if (next > 0) state.hero.currency[currency] = next;
  else delete state.hero.currency[currency];
}

/** The 'craft' HeroEdit: one currency on the item or rune with `uid`. The caller refreshes the hero. */
export function applyCraft(state: GameState, currency: string, uid: number): string | null {
  if (!isCurrencyId(currency)) return 'Unknown currency';
  const def = currencies[currency];
  if (currencyCount(state, currency) <= 0) return `You have no ${def.name}`;
  let err: string | null;
  if (def.target === 'rune') {
    const rune = state.hero.runes.find((r) => r.uid === uid);
    if (!rune) return "You don't have that rune";
    err = polishRune(rune);
  } else {
    const item = findItem(state.hero, uid);
    if (!item) return "You don't have that item";
    err = craftItem(state.craftRng, item, currency);
  }
  if (err === null) addCurrency(state, currency, -1);
  return err;
}
