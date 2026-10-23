/** M6.5: the ladder bot's sigil choice and the XP curve above the region. */
import { describe, expect, it } from 'vitest';
import { xpCurve, xpToNext } from '../../../data/progression';
import { pickSigil } from '../../../src/sim/bots/riftLadder';

describe('rift ladder', () => {
  it('opens the highest tier the ladder allows, then the one with fewest prefixes', () => {
    const g = (uid: number, tier: number, mods: string[]) => ({ uid, tier, mods }) as never;
    const list = [g(1, 2, []), g(2, 4, ['brutal', 'drought']), g(3, 4, ['drought']), g(4, 6, [])];
    expect(pickSigil(list, 3)).toMatchObject({ uid: 3 });
    expect(pickSigil(list, 5)).toMatchObject({ uid: 4 });
    expect(pickSigil([], 5)).toBeNull();
  });

  it('XP to the next level is unchanged in the region and grows ×1.2 a level above it', () => {
    expect(xpToNext(12)).toBe(Math.round(68 * Math.pow(12, 1.6)));
    expect(xpToNext(13) / xpToNext(12)).toBeCloseTo(xpCurve.growth, 2);
    expect(xpToNext(30) / xpToNext(20)).toBeCloseTo(Math.pow(xpCurve.growth, 10), 2);
  });
});

describe('out-levelling XP (M6.5)', () => {
  it('pays full XP within 3 levels of the area, then ×0.75 per level, at least 5%', async () => {
    const { overLevelMult } = await import('../../../src/sim/hero/xp');
    expect(overLevelMult(12, 10)).toBe(1);
    expect(overLevelMult(13, 10)).toBe(1);
    expect(overLevelMult(14, 10)).toBeCloseTo(0.75);
    expect(overLevelMult(16, 10)).toBeCloseTo(0.75 ** 3);
    expect(overLevelMult(60, 10)).toBe(0.05);
    expect(overLevelMult(5, 20)).toBe(1);
  });
});
