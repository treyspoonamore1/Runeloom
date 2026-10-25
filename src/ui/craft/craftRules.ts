/**
 * What the crafting bench says about each currency, and which uses it allows or confirms. Pure:
 * whether a craft applies comes from trying it on a copy with a throwaway RNG (the rolls never
 * matter), so the bench and the sim can't disagree. Hover text only repeats what the data
 * tables hold (data/currency.ts, data/affixes.ts, data/hearth.ts): no odds are invented here.
 */
import { affixCounts, magicBothChance } from '../../../data/affixes';
import { currencies, currencyIds, maxRuneQuality, rareAffixCount, type CurrencyId } from '../../../data/currency';
import { spindlewrightPrices } from '../../../data/hearth';
import { Rng } from '../../sim/core/rng';
import type { Item, ItemRarity, RuneItem } from '../../sim/hero/types';
import { craftItem, polishRune } from '../../sim/items/craft';

const probe = new Rng(1);

/** Why `currency` can't be used on the item, or null when it can (the sim's own wording). */
export function itemProblem(item: Item, currency: CurrencyId): string | null {
  return craftItem(probe, structuredClone(item), currency);
}

/** Why Rune Polish can't be used on the rune, or null when it can. */
export function runeProblem(rune: RuneItem): string | null {
  return polishRune({ ...rune });
}

/** The short form for a dimmed card: "Needs a Normal item" (the sim adds "; this one is Magic"). */
export function shortProblem(problem: string): string {
  return problem.split(';')[0]!;
}

/** The one-line rule under each currency in the wallet. */
export const shortRule: Record<CurrencyId, string> = {
  weavers_knot: 'Normal → Magic',
  spool_of_change: 'Reroll a Magic item',
  loom_shuttle: 'Normal → Rare',
  chaos_skein: 'Reroll a Rare item',
  golden_needle: 'Add an affix to a Rare',
  unpick: 'Remove one affix',
  rune_polish: `+1% rune quality (max ${maxRuneQuality}%)`,
};

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

/** The hover text of a currency: its rule, then what the data says about rolls and drops. */
export function currencyTip(id: CurrencyId): { name: string; lines: string[] } {
  const def = currencies[id];
  const lines = [def.text];
  if (id === 'weavers_knot' || id === 'spool_of_change')
    lines.push(
      `Rolls up to ${affixCounts.magic.prefixes} prefix and ${affixCounts.magic.suffixes} suffix: both ${pct(magicBothChance)} of the time, otherwise one of them`,
    );
  if (id === 'loom_shuttle' || id === 'chaos_skein') {
    const total = rareAffixCount.reduce((n, c) => n + c.weight, 0);
    lines.push(
      `Rolls ${rareAffixCount.map((c) => `${c.count} (${pct(c.weight / total)})`).join(', ')} affixes, fewer when the item's pool is small`,
    );
  }
  if (id === 'golden_needle')
    lines.push(
      `A Rare holds up to ${affixCounts.rare.prefixes} prefixes and ${affixCounts.rare.suffixes} suffixes; fails when none is free`,
    );
  if (id === 'unpick') lines.push('The affix it removes is chosen at random');
  if (def.target === 'item') lines.push('Item level decides which tiers can roll. Uniques can’t be changed');
  lines.push('Only used up when the craft works');
  const total = currencyIds.reduce((n, c) => n + currencies[c].dropWeight, 0);
  lines.push(`Makes up ${pct(def.dropWeight / total)} of currency drops`);
  lines.push(`Spindlewright price: ${spindlewrightPrices[id]} Thread Scrap`);
  return { name: def.name, lines };
}

/**
 * Whether a craft asks first. Rare and unique targets ask the first time per item (`seen`);
 * Chaos Skein asks every time on a Rare (it throws away every affix). Null when it doesn't.
 */
export function confirmReason(rarity: ItemRarity, currency: CurrencyId, seen: boolean): string | null {
  if (rarity === 'rare' && currency === 'chaos_skein')
    return 'Chaos Skein rerolls every affix on this Rare. The old ones are lost.';
  if ((rarity === 'rare' || rarity === 'unique') && !seen)
    return `This is a ${rarity === 'rare' ? 'Rare' : 'Unique'} item. A craft can't be undone.`;
  return null;
}
