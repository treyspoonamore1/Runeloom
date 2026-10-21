import { describe, expect, it } from 'vitest';
import {
  lootAction,
  lootFilterPresets,
  parseLootFilter,
  type LootFilter,
} from '../../../src/sim/items/lootFilter';
import type { LootContent } from '../../../src/sim/items/loot';
import type { ItemRarity } from '../../../src/sim/hero/types';

const item = (rarity: ItemRarity, base = 'travelers_cloak'): LootContent => ({
  kind: 'item',
  item: { uid: 1, base, rarity, itemLevel: 5, affixes: [], fused: [] },
});
const rune: LootContent = { kind: 'rune', rune: { uid: 2, rune: 'bolt', level: 1, xp: 0, quality: 0 } };
const scrap: LootContent = { kind: 'scrap', amount: 2 };
const needle: LootContent = { kind: 'currency', currency: 'golden_needle', amount: 1 };
const knot: LootContent = { kind: 'currency', currency: 'weavers_knot', amount: 1 };

describe('loot filter (M5)', () => {
  it('no rules: everything shows', () => {
    for (const c of [item('normal'), item('unique'), rune, scrap, needle])
      expect(lootAction({ rules: [] }, c)).toBe('show');
  });

  it('the first matching rule decides; rarity is "up to"', () => {
    const f: LootFilter = {
      rules: [
        { what: 'item', maxRarity: 'magic', action: 'hide' },
        { what: 'item', action: 'highlight' },
      ],
    };
    expect(lootAction(f, item('normal'))).toBe('hide');
    expect(lootAction(f, item('magic'))).toBe('hide');
    expect(lootAction(f, item('rare'))).toBe('highlight');
    expect(lootAction(f, item('unique'))).toBe('highlight');
    expect(lootAction(f, rune)).toBe('show');
  });

  it('item slot and currency id narrow a rule', () => {
    const f: LootFilter = {
      rules: [
        { what: 'item', itemKind: 'spindle', action: 'highlight' },
        { what: 'currency', currency: 'golden_needle', action: 'highlight' },
        { what: 'currency', action: 'hide' },
        { what: 'any', action: 'hide' },
      ],
    };
    expect(lootAction(f, item('normal', 'twig'))).toBe('highlight');
    expect(lootAction(f, item('normal', 'wool_hood'))).toBe('hide');
    expect(lootAction(f, needle)).toBe('highlight');
    expect(lootAction(f, knot)).toBe('hide');
    expect(lootAction(f, scrap)).toBe('hide');
  });

  it('parsing keeps good rules, drops malformed ones and unknown fields', () => {
    const f = parseLootFilter({
      rules: [
        { what: 'item', maxRarity: 'rare', itemKind: 'boots', action: 'hide', extra: 1 },
        { what: 'gold', action: 'hide' },
        { what: 'rune', action: 'explode' },
        null,
        { what: 'currency', currency: 'nope', action: 'highlight' },
      ],
    });
    expect(f.rules).toEqual([
      { what: 'item', maxRarity: 'rare', itemKind: 'boots', action: 'hide' },
      { what: 'currency', action: 'highlight' },
    ]);
    expect(parseLootFilter('junk')).toEqual({ rules: [] });
    expect(parseLootFilter(null)).toEqual({ rules: [] });
  });

  it('every preset survives parsing unchanged', () => {
    for (const p of lootFilterPresets)
      expect(parseLootFilter(JSON.parse(JSON.stringify(p.filter)))).toEqual(p.filter);
  });
});
