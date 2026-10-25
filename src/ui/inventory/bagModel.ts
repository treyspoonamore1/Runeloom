/**
 * The bag's sorting and filtering (M7.5): pure, so it is unit-tested without a DOM. The screen
 * keeps the player's choice in `bagPrefs.ts`.
 */
import { itemKinds, type ItemKind } from '../../../data/items';
import type { EquipSlot, Item, ItemRarity } from '../../sim/hero/types';

export const SORT_KEYS = ['slot', 'rarity', 'level', 'newest'] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export const SORT_LABELS: Record<SortKey, string> = {
  slot: 'Slot',
  rarity: 'Rarity',
  level: 'Item level',
  newest: 'Newest',
};

export const RARITIES: readonly ItemRarity[] = ['normal', 'magic', 'rare', 'unique'];
export type SlotFilter = 'all' | ItemKind;
export type RarityFilter = 'all' | ItemRarity;

export interface BagPrefs {
  sort: SortKey;
  slot: SlotFilter;
  rarity: RarityFilter;
  /** Only items that would improve on what you wear (upgrade.ts). */
  upgradesOnly: boolean;
}

export const DEFAULT_PREFS: Readonly<BagPrefs> = {
  sort: 'slot',
  slot: 'all',
  rarity: 'all',
  upgradesOnly: false,
};

const KIND_BY_SLOT: Record<EquipSlot, ItemKind> = {
  spindle: 'spindle',
  cloak: 'cloak',
  hood: 'hood',
  boots: 'boots',
  charm1: 'charm',
  charm2: 'charm',
};

/** The kind of item that goes in these slots (charms: either charm slot), or null for none. */
export function kindOfSlots(slots: readonly EquipSlot[]): ItemKind | null {
  return slots.length ? KIND_BY_SLOT[slots[0]!] : null;
}

/** Reads saved preferences, keeping what is valid and defaulting the rest (storage can hold anything). */
export function parsePrefs(raw: unknown): BagPrefs {
  const out: BagPrefs = { ...DEFAULT_PREFS };
  if (typeof raw !== 'object' || raw === null) return out;
  const o = raw as Record<string, unknown>;
  if (SORT_KEYS.includes(o.sort as SortKey)) out.sort = o.sort as SortKey;
  if (o.slot === 'all' || itemKinds.includes(o.slot as ItemKind)) out.slot = o.slot as SlotFilter;
  if (o.rarity === 'all' || RARITIES.includes(o.rarity as ItemRarity)) out.rarity = o.rarity as RarityFilter;
  if (typeof o.upgradesOnly === 'boolean') out.upgradesOnly = o.upgradesOnly;
  return out;
}

/** What the sort and the filters need to know about an item. */
export interface BagContext {
  kindOf(it: Item): ItemKind | null;
  /** True when equipping the item would improve on what you wear. */
  isUpgrade(it: Item): boolean;
}

const rarityRank = (r: ItemRarity): number => RARITIES.indexOf(r);
const kindRank = (k: ItemKind | null): number => (k === null ? itemKinds.length : itemKinds.indexOf(k));

/**
 * The items in the order of `sort`: by slot kind (spindle, cloak, hood, boots, charm; best first
 * inside a kind), by rarity, by item level (highest first), or newest first. Ties fall back on the
 * next sort keys and finally the uid, so the order never jumps around.
 */
export function sortItems(items: readonly Item[], sort: SortKey, ctx: Pick<BagContext, 'kindOf'>): Item[] {
  const byRarity = (a: Item, b: Item) => rarityRank(b.rarity) - rarityRank(a.rarity);
  const byLevel = (a: Item, b: Item) => b.itemLevel - a.itemLevel;
  const byNewest = (a: Item, b: Item) => b.uid - a.uid;
  const bySlot = (a: Item, b: Item) => kindRank(ctx.kindOf(a)) - kindRank(ctx.kindOf(b));
  const chain: Record<SortKey, Array<(a: Item, b: Item) => number>> = {
    slot: [bySlot, byRarity, byLevel, byNewest],
    rarity: [byRarity, byLevel, bySlot, byNewest],
    level: [byLevel, byRarity, bySlot, byNewest],
    newest: [byNewest],
  };
  return [...items].sort((a, b) => {
    for (const cmp of chain[sort]) {
      const d = cmp(a, b);
      if (d !== 0) return d;
    }
    return 0;
  });
}

export function filterItems(items: readonly Item[], prefs: BagPrefs, ctx: BagContext): Item[] {
  return items.filter(
    (it) =>
      (prefs.slot === 'all' || ctx.kindOf(it) === prefs.slot) &&
      (prefs.rarity === 'all' || it.rarity === prefs.rarity) &&
      (!prefs.upgradesOnly || ctx.isUpgrade(it)),
  );
}

/** The bag as shown: filtered, then sorted. */
export function viewItems(items: readonly Item[], prefs: BagPrefs, ctx: BagContext): Item[] {
  return sortItems(filterItems(items, prefs, ctx), prefs.sort, ctx);
}

/** Whether any filter is on (the empty state offers to clear them). */
export function filtersActive(p: BagPrefs): boolean {
  return p.slot !== 'all' || p.rarity !== 'all' || p.upgradesOnly;
}

/**
 * Where the arrow keys move inside a grid of `n` tiles in `cols` columns: one tile left or right,
 * one row up or down, Home and End to the ends. Stays put at an edge; null for other keys.
 */
export function nextIndex(i: number, n: number, cols: number, key: string): number | null {
  if (n === 0) return null;
  const c = Math.max(1, cols);
  const clamp = (x: number) => Math.min(n - 1, Math.max(0, x));
  switch (key) {
    case 'ArrowLeft':
      return clamp(i - 1);
    case 'ArrowRight':
      return clamp(i + 1);
    case 'ArrowUp':
      return i - c >= 0 ? i - c : i;
    case 'ArrowDown':
      return i + c <= n - 1 ? i + c : i;
    case 'Home':
      return 0;
    case 'End':
      return n - 1;
    default:
      return null;
  }
}
