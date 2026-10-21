/**
 * What the crafting bench shows (C): which items or runes a currency can be used on and why not,
 * and which affix lines a craft added. Pure: it tries each craft on a copy with a throwaway RNG
 * (the result's rolls never matter, only whether the craft applies), so the bench and the sim
 * can't disagree about what's allowed.
 */
import { currencies, currencyIds, type CurrencyId } from '../../../data/currency';
import { Rng } from '../../sim/core/rng';
import { craftItem, polishRune } from '../../sim/items/craft';
import { EQUIP_SLOTS, type HeroState, type Item, type RuneItem } from '../../sim/hero/types';

const probe = new Rng(1);

/** Why `currency` can't be used on the item, or null when it can. */
export function itemProblem(item: Item, currency: CurrencyId): string | null {
  return craftItem(probe, structuredClone(item), currency);
}

/** Why Rune Polish can't be used on the rune, or null when it can. */
export function runeProblem(rune: RuneItem): string | null {
  return polishRune({ ...rune });
}

export interface CraftTarget {
  kind: 'item' | 'rune';
  uid: number;
  /** Null when the selected currency applies. */
  problem: string | null;
  equipped: boolean;
}

/** Every owned item (equipped first) or rune, with whether the currency applies to it. */
export function targetsFor(hero: Readonly<HeroState>, currency: CurrencyId): CraftTarget[] {
  if (currencies[currency].target === 'rune')
    return [...hero.runes]
      .sort((a, b) => a.rune.localeCompare(b.rune) || b.level - a.level || a.uid - b.uid)
      .map((r) => ({ kind: 'rune', uid: r.uid, problem: runeProblem(r), equipped: false }));
  const worn = new Set(EQUIP_SLOTS.map((s) => hero.equipped[s]).filter((u) => u !== null));
  const items = [...hero.items].sort((a, b) => Number(worn.has(b.uid)) - Number(worn.has(a.uid)));
  return items.map((it) => ({
    kind: 'item',
    uid: it.uid,
    problem: itemProblem(it, currency),
    equipped: worn.has(it.uid),
  }));
}

/** Stack sizes in display order. */
export function wallet(hero: Readonly<HeroState>): { id: CurrencyId; count: number }[] {
  return currencyIds.map((id) => ({ id, count: hero.currency[id] ?? 0 }));
}

/** Lines in `after` that weren't in `before` (the affixes a craft added or rerolled). */
export function newLines(before: readonly string[], after: readonly string[]): Set<string> {
  const left = [...before];
  const out = new Set<string>();
  for (const l of after) {
    const i = left.indexOf(l);
    if (i >= 0) left.splice(i, 1);
    else out.add(l);
  }
  return out;
}
