/**
 * The loot filter (M5): an ordered list of rules, the first match deciding whether a drop is
 * shown, highlighted or hidden. Pure, so the renderer, the HUD and the bag use the same answer,
 * and M7's Salvage Loom (DESIGN §11) can salvage by it in the sim.
 *
 * In M5 the filter changes only what is shown: hidden drops aren't drawn or announced but are
 * still picked up, so a filter never loses anything.
 */
import { currencyIds, type CurrencyId } from '../../../data/currency';
import { itemKinds, type ItemKind } from '../../../data/items';
import type { Item, ItemRarity } from '../hero/types';
import type { LootContent } from './loot';
import { kindOfBase } from './items';

export type LootAction = 'show' | 'highlight' | 'hide';
export type LootWhat = 'any' | 'item' | 'rune' | 'part' | 'currency' | 'scrap' | 'sigil';

export const lootActions: readonly LootAction[] = ['show', 'highlight', 'hide'];
export const lootWhats: readonly LootWhat[] = ['any', 'item', 'rune', 'part', 'currency', 'scrap', 'sigil'];
export const rarityOrder: readonly ItemRarity[] = ['normal', 'magic', 'rare', 'unique'];

export interface LootRule {
  what: LootWhat;
  /** Items: the rarity at most this (so "hide items up to Magic"). Missing: any rarity. */
  maxRarity?: ItemRarity;
  /** Items: only this kind (spindle, cloak, …). Missing: any kind. */
  itemKind?: ItemKind;
  /** Currency: only this currency. Missing: any. */
  currency?: CurrencyId;
  action: LootAction;
}

export interface LootFilter {
  rules: LootRule[];
}

/** Shows everything. */
export const EMPTY_FILTER: LootFilter = { rules: [] };

function itemMatches(rule: LootRule, item: Item): boolean {
  if (rule.maxRarity !== undefined && rarityOrder.indexOf(item.rarity) > rarityOrder.indexOf(rule.maxRarity))
    return false;
  if (rule.itemKind !== undefined && kindOfBase(item.base) !== rule.itemKind) return false;
  return true;
}

export function ruleMatches(rule: LootRule, c: LootContent): boolean {
  if (rule.what !== 'any' && rule.what !== c.kind) return false;
  if (c.kind === 'item') return itemMatches(rule, c.item);
  if (c.kind === 'currency') return rule.currency === undefined || rule.currency === c.currency;
  return true;
}

/** What the filter does with a drop: the first matching rule's action, else 'show'. */
export function lootAction(filter: Readonly<LootFilter>, c: LootContent): LootAction {
  for (const r of filter.rules) if (ruleMatches(r, c)) return r.action;
  return 'show';
}

/** A filter from untrusted data (storage, an import): drops anything malformed. */
export function parseLootFilter(v: unknown): LootFilter {
  const rules: LootRule[] = [];
  const list = typeof v === 'object' && v !== null ? (v as { rules?: unknown }).rules : undefined;
  if (!Array.isArray(list)) return { rules };
  for (const x of list) {
    if (typeof x !== 'object' || x === null) continue;
    const o = x as Record<string, unknown>;
    if (!lootWhats.includes(o.what as LootWhat) || !lootActions.includes(o.action as LootAction)) continue;
    const r: LootRule = { what: o.what as LootWhat, action: o.action as LootAction };
    if (rarityOrder.includes(o.maxRarity as ItemRarity)) r.maxRarity = o.maxRarity as ItemRarity;
    if (itemKinds.includes(o.itemKind as ItemKind)) r.itemKind = o.itemKind as ItemKind;
    if (currencyIds.includes(o.currency as CurrencyId)) r.currency = o.currency as CurrencyId;
    rules.push(r);
  }
  return { rules };
}

/** Ready-made filters for the editor. */
export const lootFilterPresets: readonly { name: string; filter: LootFilter }[] = [
  { name: 'Show everything', filter: { rules: [] } },
  {
    name: 'Highlight Rares and uniques',
    filter: {
      rules: [
        { what: 'item', maxRarity: 'magic', action: 'show' },
        { what: 'item', action: 'highlight' },
      ],
    },
  },
  {
    name: 'Hide plain gear',
    filter: {
      rules: [
        { what: 'item', itemKind: 'spindle', action: 'show' },
        { what: 'item', maxRarity: 'normal', action: 'hide' },
        { what: 'item', maxRarity: 'magic', action: 'show' },
        { what: 'item', action: 'highlight' },
        { what: 'currency', currency: 'golden_needle', action: 'highlight' },
      ],
    },
  },
  {
    name: 'Only what matters',
    filter: {
      rules: [
        { what: 'item', maxRarity: 'magic', action: 'hide' },
        { what: 'item', action: 'highlight' },
        { what: 'scrap', action: 'hide' },
        { what: 'currency', currency: 'golden_needle', action: 'highlight' },
        { what: 'currency', currency: 'chaos_skein', action: 'highlight' },
      ],
    },
  },
];
