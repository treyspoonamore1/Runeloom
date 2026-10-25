import { describe, expect, it } from 'vitest';
import { affixes } from '../../../data/affixes';
import { affixParts, affixText, itemLines, rangeText, tierRange } from '../../../src/ui/items/affixText';
import { makeItem } from '../../../src/sim/items/items';
import { describeItem } from '../../../src/sim/items/describe';
import { createHero } from '../../../src/sim/hero/hero';

describe('affix text with tier and range', () => {
  it('writes the stat line, tier and the tier range from data/affixes.ts', () => {
    const roll = { id: 'fire_damage', tier: 6, value: 8 };
    expect(affixText(roll)).toBe('8% increased Fire damage (T6: 6–10)');
    expect(affixText(roll, 'tier')).toBe('8% increased Fire damage (T6)');
    expect(affixText(roll, 'plain')).toBe('8% increased Fire damage');
  });

  it('reads every tier of every affix from the data', () => {
    for (const def of Object.values(affixes))
      for (const t of def.tiers) {
        const r = tierRange(def.id, t.tier)!;
        expect(r).toMatchObject({ tier: t.tier, min: t.min, max: t.max, itemLevel: t.itemLevel });
        expect(affixText({ id: def.id, tier: t.tier, value: t.min })).toContain(
          `(T${t.tier}: ${rangeText(t)})`,
        );
      }
  });

  it('T1 is the best tier: its range sits above the others', () => {
    const t1 = tierRange('life_flat', 1)!;
    const t3 = tierRange('life_flat', 3)!;
    expect(t1.min).toBeGreaterThan(t3.max);
  });

  it('shows a one-value range as a single number', () => {
    expect(rangeText({ min: 5, max: 5 })).toBe('5');
    expect(rangeText({ min: 20, max: 29 })).toBe('20–29');
  });

  it('places the roll inside its range (0 lowest, 1 highest), and clamps strays', () => {
    const r = tierRange('life_flat', 3)!;
    expect(affixParts({ id: 'life_flat', tier: 3, value: r.min })!.roll).toBe(0);
    expect(affixParts({ id: 'life_flat', tier: 3, value: r.max })!.roll).toBe(1);
    expect(affixParts({ id: 'life_flat', tier: 3, value: r.max + 50 })!.roll).toBe(1);
  });

  it('falls back to the tier alone when the tier is not in the data, and to the id for unknown affixes', () => {
    const p = affixParts({ id: 'life_flat', tier: 99, value: 10 })!;
    expect(p.range).toBeNull();
    expect(p.roll).toBeNull();
    expect(p.label).toBe('T99');
    expect(affixText({ id: 'life_flat', tier: 99, value: 10 })).toBe('+10 to maximum life (T99)');
    expect(affixText({ id: 'nope', tier: 1, value: 1 })).toBe('nope');
    expect(affixParts({ id: 'nope', tier: 1, value: 1 })).toBeNull();
  });

  it('types the lines of describeItem: implicits, affixes with parts, fused lines', () => {
    const hero = createHero();
    const sp = makeItem(hero, 'ashwood', 'magic', 8, [
      { id: 'fire_damage', tier: 5, value: 12 },
      { id: 'cast_speed', tier: 6, value: 6 },
    ]);
    const lines = itemLines(sp, describeItem(sp).lines);
    const kinds = lines.map((l) => l.kind);
    expect(kinds.filter((k) => k === 'affix')).toHaveLength(2);
    expect(kinds.indexOf('affix')).toBeGreaterThanOrEqual(kinds.filter((k) => k === 'implicit').length);
    const aff = lines.filter((l) => l.kind === 'affix');
    expect(aff[0]!.affix).toMatchObject({ tier: 5, text: aff[0]!.text });
    expect(aff[0]!.affix!.label).toMatch(/^T5: \d+–\d+$/);
    expect(kinds[kinds.length - 1]).toBe('fused');
  });

  it('returns plain lines when the affixes are not the data/affixes.ts ones (fixture items)', () => {
    const hero = createHero();
    const it = makeItem(hero, 'twig', 'normal', 1, []);
    it.affixes.push({ id: 'life', tier: 2, value: 18 });
    expect(itemLines(it, ['Capacity 10', '+18 Maximum life']).every((l) => l.kind === 'plain')).toBe(true);
  });
});
