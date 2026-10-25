import { beforeEach, describe, expect, it } from 'vitest';
import { cloneTuning } from '../../../data/tuning';
import { inventoryUi } from '../../../data/ui';
import { newGameHero } from '../../../src/sim';
import { heroModsOf } from '../../../src/sim/hero/hero';
import { makeItem } from '../../../src/sim/items/items';
import type { AffixRoll, EquipSlot, HeroState, Item, ItemRarity } from '../../../src/sim/hero/types';
import { statRows } from '../../../src/ui/inventory/stats';
import {
  bestSlot,
  evaluateItem,
  resetUpgradeCache,
  scoreRows,
  upgradeInfo,
  type UpgradeCtx,
} from '../../../src/ui/inventory/upgrade';

const tuning = cloneTuning();
const a = (id: string, value: number, tier = 3): AffixRoll => ({ id, tier, value });
let hero: HeroState;
let calls = 0;
const ctx = (): UpgradeCtx => ({
  hero,
  tuning,
  modsFor: (h) => {
    calls++;
    return heroModsOf(h);
  },
});

function give(base: string, affixes: AffixRoll[], rarity: ItemRarity = 'magic'): Item {
  const it = makeItem(hero, base, rarity, 8, affixes);
  hero.items.push(it);
  return it;
}
const wear = (slot: EquipSlot, it: Item) => void (hero.equipped[slot] = it.uid);

beforeEach(() => {
  hero = newGameHero();
  calls = 0;
  resetUpgradeCache();
});

describe('upgrade score', () => {
  it('weights the sheet rows: 10 life is 1 point, 1% of a resistance 0.3, a Capacity 6', () => {
    const rows = [
      { key: 'life', group: 'Vitals', label: 'L', value: 100, text: '100', higherIsBetter: true },
      { key: 'fireRes', group: 'Defense', label: 'F', value: 0.1, text: '10%', higherIsBetter: true },
      { key: 'capacity', group: 'Weaving', label: 'C', value: 2, text: '2', higherIsBetter: true },
      { key: 'unweighted', group: 'Defense', label: 'U', value: 99, text: '99', higherIsBetter: true },
    ] as const;
    expect(scoreRows(rows)).toBeCloseTo(100 * 0.1 + 10 * 0.3 + 2 * 6, 9);
  });

  it('keeps every weighted key a real sheet row', () => {
    const keys = new Set(statRows(hero, heroModsOf(hero), tuning, true).map((r) => r.key));
    for (const k of [
      ...Object.keys(inventoryUi.upgrade.perUnit),
      ...Object.keys(inventoryUi.upgrade.perPoint),
    ])
      expect(keys.has(k), k).toBe(true);
  });
});

describe('upgrade verdicts', () => {
  it('a cloak with life in the empty cloak slot is an upgrade worth its life', () => {
    const cloak = give('travelers_cloak', [a('life_flat', 20)]);
    const info = evaluateItem(ctx(), cloak, ['cloak']);
    expect(info).toMatchObject({ slot: 'cloak', verdict: 'up' });
    expect(info.gain).toBeCloseTo(2, 6);
  });

  it('an item with no stats changes nothing', () => {
    const plain = give('travelers_cloak', [], 'normal');
    expect(evaluateItem(ctx(), plain, ['cloak'])).toMatchObject({ verdict: 'same', gain: 0 });
  });

  it('strictly worse is a down arrow; better is up', () => {
    wear('cloak', give('travelers_cloak', [a('life_flat', 30), a('fire_resist', 12)]));
    const worse = give('travelers_cloak', [a('life_flat', 10), a('fire_resist', 6)]);
    const better = give('travelers_cloak', [a('life_flat', 40), a('fire_resist', 12)]);
    expect(evaluateItem(ctx(), worse, ['cloak']).verdict).toBe('down');
    expect(evaluateItem(ctx(), better, ['cloak']).verdict).toBe('up');
  });

  it('a trade of a little for a little is neither', () => {
    wear('cloak', give('travelers_cloak', [a('life_flat', 20), a('fire_resist', 10)]));
    const trade = give('travelers_cloak', [a('life_flat', 25), a('fire_resist', 8)]);
    const info = evaluateItem(ctx(), trade, ['cloak']);
    expect(info.verdict).toBe('same');
    expect(Math.abs(info.gain)).toBeLessThan(inventoryUi.upgrade.minGain + 5);
  });

  it('counts a big trade by its score: +60 life for -3% resistance is an upgrade', () => {
    wear('cloak', give('travelers_cloak', [a('life_flat', 20), a('fire_resist', 10)]));
    const trade = give('travelers_cloak', [a('life_flat', 80), a('fire_resist', 7)]);
    expect(evaluateItem(ctx(), trade, ['cloak']).verdict).toBe('up');
  });

  it('counts resistance only up to the cap', () => {
    const cap = tuning.combat.resistCap * 100;
    wear('cloak', give('travelers_cloak', [a('fire_resist', cap)]));
    const over = give('travelers_cloak', [a('fire_resist', cap + 40)]);
    expect(evaluateItem(ctx(), over, ['cloak'])).toMatchObject({ verdict: 'same', gain: 0 });
    const under = give('travelers_cloak', [a('fire_resist', cap - 20)]);
    expect(evaluateItem(ctx(), under, ['cloak']).verdict).toBe('down');
  });

  it('a spindle with more Capacity is an upgrade; the worn one is the baseline', () => {
    const ash = give('ashwood', [], 'normal');
    const info = evaluateItem(ctx(), ash, ['spindle']);
    expect(info.slot).toBe('spindle');
    expect(info.gain).toBeGreaterThan(0);
  });

  it('an item already worn has no slot to go to', () => {
    const worn = hero.items.find((i) => i.uid === hero.equipped.spindle)!;
    expect(evaluateItem(ctx(), worn, ['spindle'])).toEqual({ slot: null, gain: 0, verdict: 'same' });
  });

  it('never changes the hero', () => {
    wear('cloak', give('travelers_cloak', [a('life_flat', 30)]));
    const cand = give('travelers_cloak', [a('life_flat', 50)]);
    const before = JSON.stringify(hero);
    evaluateItem(ctx(), cand, ['cloak']);
    expect(JSON.stringify(hero)).toBe(before);
  });
});

describe('charms: the empty or the weaker slot', () => {
  const charms: EquipSlot[] = ['charm1', 'charm2'];

  it('goes to an empty charm slot first', () => {
    wear('charm1', give('bone_charm', [a('life_flat', 50)]));
    const c = give('bone_charm', [a('life_flat', 5)]);
    expect(bestSlot(ctx(), c, charms)).toBe('charm2');
    expect(evaluateItem(ctx(), c, charms)).toMatchObject({ slot: 'charm2', verdict: 'up' });
  });

  it('with both worn, it compares against the weaker charm', () => {
    wear('charm1', give('bone_charm', [a('life_flat', 5)]));
    wear('charm2', give('bone_charm', [a('life_flat', 30)]));
    const c = give('bone_charm', [a('life_flat', 20)]);
    const info = evaluateItem(ctx(), c, charms);
    expect(info).toMatchObject({ slot: 'charm1', verdict: 'up' });
    expect(info.gain).toBeCloseTo(1.5, 6);
    expect(bestSlot(ctx(), c, charms)).toBe('charm1');
    // Mirror: the weak one is in charm2 now.
    hero.equipped.charm1 = hero.equipped.charm2;
    hero.equipped.charm2 = hero.items.find((i) => i.affixes[0]?.value === 5)!.uid;
    expect(bestSlot(ctx(), c, charms)).toBe('charm2');
  });

  it('two better charms are no upgrade when the new one is worse than both', () => {
    wear('charm1', give('bone_charm', [a('life_flat', 30)]));
    wear('charm2', give('bone_charm', [a('life_flat', 40)]));
    const c = give('bone_charm', [a('life_flat', 10)]);
    expect(evaluateItem(ctx(), c, charms)).toMatchObject({ slot: 'charm1', verdict: 'down' });
  });

  it('a single-slot kind needs no search', () => {
    const c = give('travelers_cloak', [a('life_flat', 5)]);
    calls = 0;
    expect(bestSlot(ctx(), c, ['cloak'])).toBe('cloak');
    expect(bestSlot(ctx(), c, [])).toBeNull();
    expect(calls).toBe(0);
  });
});

describe('the cache', () => {
  it('answers once per item for a hero revision, and again for the next', () => {
    const c1 = give('travelers_cloak', [a('life_flat', 20)]);
    const c2 = give('wool_hood', [a('life_flat', 10)]);
    const x = upgradeInfo(1, ctx(), c1, ['cloak']);
    upgradeInfo(1, ctx(), c2, ['hood']);
    const n = calls;
    expect(upgradeInfo(1, ctx(), c1, ['cloak'])).toBe(x);
    upgradeInfo(1, ctx(), c2, ['hood']);
    expect(calls).toBe(n);
    upgradeInfo(2, ctx(), c1, ['cloak']);
    expect(calls).toBeGreaterThan(n);
  });

  it('does not serve an answer for another hero or a changed bag', () => {
    const c1 = give('travelers_cloak', [a('life_flat', 20)]);
    const x = upgradeInfo(1, ctx(), c1, ['cloak']);
    give('wool_hood', []);
    expect(upgradeInfo(1, ctx(), c1, ['cloak'])).not.toBe(x);
    const y = upgradeInfo(1, ctx(), c1, ['cloak']);
    hero = structuredClone(hero);
    expect(
      upgradeInfo(
        1,
        ctx(),
        hero.items.find((i) => i.uid === c1.uid)!,
        ['cloak'],
      ),
    ).not.toBe(y);
  });
});
