import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFS,
  filterItems,
  filtersActive,
  kindOfSlots,
  nextIndex,
  parsePrefs,
  sortItems,
  viewItems,
  type BagContext,
} from '../../../src/ui/inventory/bagModel';
import { bagPrefs, clearFilters, loadPrefs, setPrefs } from '../../../src/ui/inventory/bagPrefs';
import type { Item, ItemRarity } from '../../../src/sim/hero/types';
import type { ItemKind } from '../../../data/items';

const KIND: Record<string, ItemKind> = {
  twig: 'spindle',
  ashwood: 'spindle',
  travelers_cloak: 'cloak',
  wool_hood: 'hood',
  leather_boots: 'boots',
  bone_charm: 'charm',
};
const mk = (uid: number, base: string, rarity: ItemRarity, itemLevel: number): Item => ({
  uid,
  base,
  rarity,
  itemLevel,
  affixes: [],
  fused: [],
});
const items = [
  mk(1, 'bone_charm', 'magic', 5),
  mk(2, 'twig', 'normal', 1),
  mk(3, 'wool_hood', 'rare', 9),
  mk(4, 'travelers_cloak', 'magic', 12),
  mk(5, 'bone_charm', 'rare', 5),
  mk(6, 'ashwood', 'magic', 7),
  mk(7, 'leather_boots', 'unique', 3),
];
const ups = new Set([4, 5]);
const ctx: BagContext = { kindOf: (it) => KIND[it.base] ?? null, isUpgrade: (it) => ups.has(it.uid) };
const uids = (l: Item[]) => l.map((i) => i.uid);

describe('bag sorting', () => {
  it('slot: spindle, cloak, hood, boots, charm; best rarity then level first inside a kind', () => {
    expect(uids(sortItems(items, 'slot', ctx))).toEqual([6, 2, 4, 3, 7, 5, 1]);
  });

  it('rarity: unique, rare, magic, normal; higher item level first', () => {
    expect(uids(sortItems(items, 'rarity', ctx))).toEqual([7, 3, 5, 4, 6, 1, 2]);
  });

  it('item level: highest first, ties by rarity', () => {
    expect(uids(sortItems(items, 'level', ctx))).toEqual([4, 3, 6, 5, 1, 7, 2]);
  });

  it('newest: the highest uid first', () => {
    expect(uids(sortItems(items, 'newest', ctx))).toEqual([7, 6, 5, 4, 3, 2, 1]);
  });

  it('does not reorder or change its input, and puts unknown kinds last', () => {
    const copy = [...items];
    sortItems(items, 'rarity', ctx);
    expect(items).toEqual(copy);
    const odd = mk(8, 'mystery', 'unique', 99);
    expect(sortItems([odd, ...items], 'slot', ctx).at(-1)!.uid).toBe(8);
  });
});

describe('bag filters', () => {
  it('filters by slot kind, rarity and upgrades only, together', () => {
    const p = { ...DEFAULT_PREFS };
    expect(filterItems(items, p, ctx)).toHaveLength(7);
    expect(uids(filterItems(items, { ...p, slot: 'charm' }, ctx))).toEqual([1, 5]);
    expect(uids(filterItems(items, { ...p, rarity: 'magic' }, ctx))).toEqual([1, 4, 6]);
    expect(uids(filterItems(items, { ...p, upgradesOnly: true }, ctx))).toEqual([4, 5]);
    expect(
      uids(filterItems(items, { ...p, slot: 'charm', rarity: 'rare', upgradesOnly: true }, ctx)),
    ).toEqual([5]);
    expect(filterItems(items, { ...p, slot: 'boots', rarity: 'normal' }, ctx)).toEqual([]);
  });

  it('viewItems filters, then sorts', () => {
    expect(uids(viewItems(items, { ...DEFAULT_PREFS, rarity: 'magic', sort: 'level' }, ctx))).toEqual([
      4, 6, 1,
    ]);
  });

  it('knows when a filter is on', () => {
    expect(filtersActive(DEFAULT_PREFS)).toBe(false);
    expect(filtersActive({ ...DEFAULT_PREFS, sort: 'newest' })).toBe(false);
    expect(filtersActive({ ...DEFAULT_PREFS, upgradesOnly: true })).toBe(true);
    expect(filtersActive({ ...DEFAULT_PREFS, slot: 'hood' })).toBe(true);
  });

  it('maps equipment slots to item kinds', () => {
    expect(kindOfSlots(['charm1', 'charm2'])).toBe('charm');
    expect(kindOfSlots(['spindle'])).toBe('spindle');
    expect(kindOfSlots([])).toBeNull();
  });
});

describe('remembered preferences', () => {
  it('keeps valid values and defaults the rest', () => {
    expect(parsePrefs({ sort: 'rarity', slot: 'boots', rarity: 'rare', upgradesOnly: true })).toEqual({
      sort: 'rarity',
      slot: 'boots',
      rarity: 'rare',
      upgradesOnly: true,
    });
    expect(parsePrefs({ sort: 'bogus', slot: 'hat', rarity: 7, upgradesOnly: 'yes' })).toEqual(DEFAULT_PREFS);
    for (const junk of [null, 5, 'x', [], undefined]) expect(parsePrefs(junk)).toEqual(DEFAULT_PREFS);
  });
});

describe('prefs in browser storage', () => {
  const g = globalThis as { localStorage?: unknown };
  afterEach(() => {
    delete g.localStorage;
    setPrefs({ ...DEFAULT_PREFS });
  });
  const fake = (init?: string) => {
    const data = new Map<string, string>(init === undefined ? [] : [['runeloom.inventory.v1', init]]);
    g.localStorage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
    return data;
  };

  it('works without storage (no localStorage at all) and when storage throws', () => {
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
    g.localStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
    setPrefs({ sort: 'newest' });
    expect(bagPrefs.value.sort).toBe('newest');
  });

  it('saves a change and loads it back; bad JSON gives the defaults', () => {
    const data = fake();
    setPrefs({ sort: 'level', slot: 'hood', upgradesOnly: true });
    expect(JSON.parse(data.get('runeloom.inventory.v1')!)).toEqual({
      sort: 'level',
      slot: 'hood',
      rarity: 'all',
      upgradesOnly: true,
    });
    expect(loadPrefs()).toEqual(bagPrefs.value);
    fake('{not json');
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });

  it('clearFilters resets the filters and keeps the sort', () => {
    fake();
    setPrefs({ sort: 'rarity', slot: 'cloak', rarity: 'rare', upgradesOnly: true });
    clearFilters();
    expect(bagPrefs.value).toEqual({ ...DEFAULT_PREFS, sort: 'rarity' });
  });
});

describe('arrow keys in the grid', () => {
  // 7 tiles in 3 columns:  0 1 2 / 3 4 5 / 6
  it('moves one tile or one row, and stays at the edges', () => {
    expect(nextIndex(4, 7, 3, 'ArrowLeft')).toBe(3);
    expect(nextIndex(4, 7, 3, 'ArrowRight')).toBe(5);
    expect(nextIndex(4, 7, 3, 'ArrowUp')).toBe(1);
    expect(nextIndex(4, 7, 3, 'ArrowDown')).toBe(4); // no tile below 4
    expect(nextIndex(3, 7, 3, 'ArrowDown')).toBe(6);
    expect(nextIndex(0, 7, 3, 'ArrowLeft')).toBe(0);
    expect(nextIndex(6, 7, 3, 'ArrowRight')).toBe(6);
    expect(nextIndex(1, 7, 3, 'ArrowUp')).toBe(1);
  });

  it('Home and End jump to the ends; other keys and an empty grid do nothing', () => {
    expect(nextIndex(4, 7, 3, 'Home')).toBe(0);
    expect(nextIndex(2, 7, 3, 'End')).toBe(6);
    expect(nextIndex(2, 7, 3, 'a')).toBeNull();
    expect(nextIndex(0, 0, 3, 'ArrowRight')).toBeNull();
    expect(nextIndex(1, 3, 0, 'ArrowDown')).toBe(2); // zero columns count as one
  });
});
