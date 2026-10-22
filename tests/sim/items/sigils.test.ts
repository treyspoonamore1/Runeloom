/** M6 Rift Sigils: modifier rolls, names and bonuses. */
import { describe, expect, it } from 'vitest';
import { riftMods } from '../../../data/rift';
import { Rng } from '../../../src/sim/core/rng';
import { createHero } from '../../../src/sim/hero/hero';
import { rollSigil, rollSigilMods, sigilBonus, sigilName } from '../../../src/sim/items/sigils';

describe('Rift Sigils', () => {
  it('roll 0–4 modifiers, at most 2 prefixes and 2 suffixes, no repeats', () => {
    const rng = new Rng(7);
    const counts = [0, 0, 0, 0, 0];
    for (let k = 0; k < 4000; k++) {
      const tier = 1 + (k % 16);
      const mods = rollSigilMods(rng, tier);
      counts[mods.length]!++;
      expect(new Set(mods).size).toBe(mods.length);
      expect(mods.filter((m) => riftMods[m].kind === 'prefix').length).toBeLessThanOrEqual(2);
      expect(mods.filter((m) => riftMods[m].kind === 'suffix').length).toBeLessThanOrEqual(2);
      // Prefixes come first.
      const firstSuffix = mods.findIndex((m) => riftMods[m].kind === 'suffix');
      if (firstSuffix >= 0)
        expect(mods.slice(firstSuffix).every((m) => riftMods[m].kind === 'suffix')).toBe(true);
    }
    expect(counts.every((c) => c > 0)).toBe(true);
  });

  it('roll more modifiers at higher tiers', () => {
    const avg = (tier: number) => {
      const rng = new Rng(tier);
      let n = 0;
      for (let k = 0; k < 2000; k++) n += rollSigilMods(rng, tier).length;
      return n / 2000;
    };
    expect(avg(16)).toBeGreaterThan(avg(8));
    expect(avg(8)).toBeGreaterThan(avg(1));
  });

  it('are deterministic per RNG state and clamp the tier', () => {
    const a = rollSigil(createHero(), new Rng(3), 20);
    const b = rollSigil(createHero(), new Rng(3), 20);
    expect(a).toEqual(b);
    expect(a.tier).toBe(16);
  });

  it('are named by their first prefix and suffix, and sum their bonuses', () => {
    expect(sigilName({ tier: 3, mods: ['brutal', 'hasty', 'drought'] })).toBe(
      'Brutal Rift Sigil of Drought (Tier 3)',
    );
    expect(sigilName({ tier: 1, mods: [] })).toBe('Rift Sigil (Tier 1)');
    const b = sigilBonus(['brutal', 'drought']);
    expect(b.quantity).toBeCloseTo(0.15);
    expect(b.rarity).toBeCloseTo(0.2);
  });
});
