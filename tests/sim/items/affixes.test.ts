import { describe, expect, it } from 'vitest';
import { Rng, rollAffixSet, rollMagicAffixes, tiersAt, eligibleAffixes } from '../../../src/sim';
import { affixes, type AffixDef } from '../../../data/affixes';
import { itemKinds } from '../../../data/items';

const defs: Record<string, AffixDef> = affixes;

describe('affix rolls (DESIGN §8.2, CONTENT §3)', () => {
  it('tiers are gated by item level', () => {
    const fire = affixes.fire_damage;
    expect(tiersAt(fire, 1).map((t) => t.tier)).toEqual([3]);
    expect(tiersAt(fire, 5).map((t) => t.tier)).toEqual([2, 3]);
    expect(tiersAt(fire, 10).map((t) => t.tier)).toEqual([1, 2, 3]);
    const rng = new Rng(1);
    for (let i = 0; i < 400; i++) {
      for (const a of rollMagicAffixes(rng, 'spindle', 3)) expect(a.tier).toBe(3);
      for (const a of rollMagicAffixes(rng, 'cloak', 9)) {
        const def = defs[a.id]!;
        const tier = def.tiers.find((t) => t.tier === a.tier)!;
        expect(tier.itemLevel).toBeLessThanOrEqual(9);
        expect(a.value).toBeGreaterThanOrEqual(tier.min);
        expect(a.value).toBeLessThanOrEqual(tier.max);
        expect(Number.isInteger(a.value)).toBe(true);
      }
    }
  });

  it('+1 Capacity needs item level 15 and never rolls in the M4 region', () => {
    const rng = new Rng(2);
    for (let i = 0; i < 2000; i++)
      for (const a of rollMagicAffixes(rng, 'spindle', 10)) expect(a.id).not.toBe('capacity');
    expect(eligibleAffixes('spindle', 'suffix', 15, new Set()).map((a) => a.id)).toContain('capacity');
  });

  it('Magic items get a prefix, a suffix or both, from their kind’s pool', () => {
    const rng = new Rng(3);
    const shapes = new Set<string>();
    for (const kind of itemKinds)
      for (let i = 0; i < 300; i++) {
        const rolled = rollMagicAffixes(rng, kind, 8);
        expect(rolled.length).toBeGreaterThanOrEqual(1);
        const pre = rolled.filter((a) => defs[a.id]!.kind === 'prefix').length;
        const suf = rolled.filter((a) => defs[a.id]!.kind === 'suffix').length;
        expect(pre).toBeLessThanOrEqual(1);
        expect(suf).toBeLessThanOrEqual(1);
        shapes.add(`${pre}${suf}`);
        for (const a of rolled) expect(defs[a.id]!.kinds).toContain(kind);
      }
    expect(shapes).toEqual(new Set(['10', '01', '11']));
  });

  it('affixes in the same group never both roll', () => {
    const pool: AffixDef[] = [
      { ...affixes.fire_damage, id: 'a', group: 'shared' },
      { ...affixes.frost_damage, id: 'b', group: 'shared' },
      { ...affixes.storm_damage, id: 'c', group: 'other' },
    ];
    const rng = new Rng(4);
    for (let i = 0; i < 300; i++) {
      const rolled = rollAffixSet(rng, 'spindle', 9, 3, 0, pool);
      expect(rolled).toHaveLength(2);
      expect(rolled.map((r) => r.id)).toContain('c');
      // Real pools never repeat a group either, even with Rare counts.
      const real = rollAffixSet(rng, 'cloak', 10, 3, 3);
      const groups = real.map((r) => defs[r.id]!.group);
      expect(new Set(groups).size).toBe(groups.length);
    }
  });
});
