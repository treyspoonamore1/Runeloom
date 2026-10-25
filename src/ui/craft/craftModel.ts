/**
 * What the crafting bench lists (C): every item or rune with whether the selected currency
 * applies and why not, the filters and search over that list, and whether "use again" can repeat
 * the last craft. Pure: reads the hero, never writes it.
 */
import { currencies, currencyIds, type CurrencyId } from '../../../data/currency';
import { getRune } from '../../../data/runes';
import { itemKinds, type ItemKind } from '../../../data/items';
import { EQUIP_SLOTS, type HeroState, type Item, type ItemRarity, type RuneItem } from '../../sim/hero/types';
import { kindOfBase } from '../../sim/items/items';
import { baseName, itemDescription } from '../inventory/adapter';
import { itemProblem, runeProblem, shortProblem } from './craftRules';

export type SlotFilter = 'all' | ItemKind;
export type RarityFilter = 'all' | ItemRarity;

export const slotFilters: readonly SlotFilter[] = ['all', ...itemKinds];
export const rarityFilters: readonly RarityFilter[] = ['all', 'normal', 'magic', 'rare', 'unique'];
export const slotLabel: Record<SlotFilter, string> = {
  all: 'All',
  spindle: 'Spindle',
  cloak: 'Cloak',
  hood: 'Hood',
  boots: 'Boots',
  charm: 'Charm',
};

export interface ListFilter {
  slot: SlotFilter;
  rarity: RarityFilter;
  search: string;
  /** Only what the selected currency can be used on. */
  usableOnly: boolean;
}

export const noFilter: ListFilter = { slot: 'all', rarity: 'all', search: '', usableOnly: false };

interface EntryBase {
  uid: number;
  name: string;
  /** Null when the currency applies; the sim's wording, for the bench and tooltips. */
  problem: string | null;
  /** The short form shown on a dimmed card. */
  reason: string | null;
}

export interface ItemEntry extends EntryBase {
  kind: 'item';
  item: Item;
  base: string;
  itemKind: ItemKind | null;
  equipped: boolean;
}

export interface RuneEntry extends EntryBase {
  kind: 'rune';
  rune: RuneItem;
}

export type Entry = ItemEntry | RuneEntry;

/** Every owned item, equipped ones first (then in acquisition order), with `currency` checked on each. */
export function itemEntries(hero: Readonly<HeroState>, currency: CurrencyId): ItemEntry[] {
  const worn = new Set(EQUIP_SLOTS.map((s) => hero.equipped[s]).filter((u) => u !== null));
  const entries = hero.items.map((item): ItemEntry => {
    const problem = itemProblem(item, currency);
    return {
      kind: 'item',
      uid: item.uid,
      item,
      name: itemDescription(item).name,
      base: baseName(item.base),
      itemKind: kindOfBase(item.base),
      equipped: worn.has(item.uid),
      problem,
      reason: problem && shortProblem(problem),
    };
  });
  return [...entries.filter((e) => e.equipped), ...entries.filter((e) => !e.equipped)];
}

/** Every owned rune, by name then highest level, with whether `currency` applies. */
export function runeEntries(hero: Readonly<HeroState>, currency: CurrencyId): RuneEntry[] {
  return [...hero.runes]
    .sort((a, b) => a.rune.localeCompare(b.rune) || b.level - a.level || a.uid - b.uid)
    .map((rune): RuneEntry => {
      const problem = runeTargetProblem(rune, currency);
      return {
        kind: 'rune',
        uid: rune.uid,
        rune,
        name: getRune(rune.rune)?.name ?? rune.rune,
        problem,
        reason: problem && shortProblem(problem),
      };
    });
}

function runeTargetProblem(rune: RuneItem, currency: CurrencyId): string | null {
  return currencies[currency].target === 'rune' ? runeProblem(rune) : `${currencies[currency].name} works on items`;
}

/** Why `currency` can't be used on the item or rune `uid` (null when it can), whichever it is. */
export function problemFor(hero: Readonly<HeroState>, currency: CurrencyId, uid: number): string | null {
  const it = hero.items.find((x) => x.uid === uid);
  if (it) return itemProblem(it, currency);
  const r = hero.runes.find((x) => x.uid === uid);
  return r ? runeTargetProblem(r, currency) : 'That is gone';
}

/** Applies the slot and rarity chips, the usable-only toggle and the name search. */
export function filterEntries<E extends Entry>(entries: readonly E[], f: ListFilter): E[] {
  const terms = f.search.toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter((e) => {
    if (e.kind === 'item') {
      if (f.slot !== 'all' && e.itemKind !== f.slot) return false;
      if (f.rarity !== 'all' && e.item.rarity !== f.rarity) return false;
    }
    if (f.usableOnly && e.problem !== null) return false;
    if (terms.length === 0) return true;
    const hay = `${e.name} ${e.kind === 'item' ? e.base : ''}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

/** True when any chip, search or toggle narrows the list. */
export const isFiltered = (f: ListFilter): boolean =>
  f.slot !== 'all' || f.rarity !== 'all' || f.search.trim() !== '' || f.usableOnly;

/** Stack sizes in display order. */
export function wallet(hero: Readonly<HeroState>): { id: CurrencyId; count: number }[] {
  return currencyIds.map((id) => ({ id, count: hero.currency[id] ?? 0 }));
}

/** The last craft: what was used on what, so "use again" can repeat it. */
export interface LastUse {
  currency: CurrencyId;
  uid: number;
}

/** Whether "use again" can repeat `last` now, and why not. */
export function repeatState(
  hero: Readonly<HeroState>,
  last: LastUse | null,
): { ok: boolean; why: string | null } {
  if (!last) return { ok: false, why: 'Nothing to repeat yet' };
  const name = currencies[last.currency].name;
  if (!hero.items.some((x) => x.uid === last.uid) && !hero.runes.some((x) => x.uid === last.uid))
    return { ok: false, why: 'That item is gone' };
  if ((hero.currency[last.currency] ?? 0) <= 0) return { ok: false, why: `You have no ${name} left` };
  const problem = problemFor(hero, last.currency, last.uid);
  return problem ? { ok: false, why: problem } : { ok: true, why: null };
}
