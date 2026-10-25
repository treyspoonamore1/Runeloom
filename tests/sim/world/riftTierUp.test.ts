/** M7 balance: the boss's next-tier sigil chance and the per-tier monster scaling in rifts. */
import { describe, expect, it } from 'vitest';
import { riftBossTierUpChance, riftDrops, riftTierScaling } from '../../../data/rift';
import { rulesOf, tierScaling } from '../../../src/sim/world/rift/rules';

describe('next-tier sigil chance (riftDrops.bossTierUp)', () => {
  const b = riftDrops.bossTierUp;

  it('falls with the tier down to its floor, and each best-tier completion adds perClear', () => {
    expect(riftBossTierUpChance(1)).toBeCloseTo(b.base);
    expect(riftBossTierUpChance(3)).toBeCloseTo(Math.max(b.min, b.base - 2 * b.perTier));
    expect(riftBossTierUpChance(16)).toBeCloseTo(Math.max(b.min, b.base - 15 * b.perTier));
    expect(riftBossTierUpChance(16)).toBeGreaterThanOrEqual(b.min);
    expect(riftBossTierUpChance(5, 4)).toBeCloseTo(riftBossTierUpChance(5) + 4 * b.perClear);
    expect(riftBossTierUpChance(5, -3)).toBeCloseTo(riftBossTierUpChance(5));
    expect(riftBossTierUpChance(5, 10_000)).toBe(1);
  });

  it('keeps the early tiers quicker than the late ones', () => {
    for (let t = 1; t < 16; t++)
      expect(riftBossTierUpChance(t)).toBeGreaterThanOrEqual(riftBossTierUpChance(t + 1));
  });
});

describe('rift tier scaling (riftTierScaling)', () => {
  it('multiplies monster life and damage per tier above 1, compounding', () => {
    expect(tierScaling(1)).toEqual({ life: 1, damage: 1 });
    const t5 = tierScaling(5);
    expect(t5.life).toBeCloseTo(Math.pow(1 + riftTierScaling.lifeMorePerTier, 4));
    expect(t5.damage).toBeCloseTo(Math.pow(1 + riftTierScaling.damageMorePerTier, 4));
    const r = rulesOf(['hardened', 'brutal'], 5);
    expect(r.tierLifeMult).toBeCloseTo(t5.life);
    expect(r.tierDamageMult).toBeCloseTo(t5.damage);
    // Prefixes stay their own sums: Hardened's +40% multiplies with the tier's growth.
    expect(r.monsterLifeMore).toBeCloseTo(0.4);
    expect(rulesOf([]).tierLifeMult).toBe(1);
  });
});
