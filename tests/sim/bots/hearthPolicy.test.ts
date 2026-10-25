/** M7 balance: the progression sim's model player at the Hearth (bots/hearthPolicy.ts), pure decisions. */
import { describe, expect, it } from 'vitest';
import { buildings, rekindle, spindlewrightPrices, type BuildingId } from '../../../data/hearth';
import { maxRuneLevel } from '../../../data/progression';
import { createHero, newGameHero } from '../../../src/sim';
import {
  craftWants,
  gardenPicks,
  mutationOrder,
  nextMutation,
  nextPurchase,
  nextUpgrade,
  salvagePlan,
  scrapReserve,
  shouldRekindle,
  upgradeWeights,
} from '../../../src/sim/bots/hearthPolicy';
import type { HeroState, ItemRarity } from '../../../src/sim/hero/types';
import { makeItem, makeRune } from '../../../src/sim/items/items';
import { upgradeCost } from '../../../src/sim/meta/view';

/** A hero wearing one item of `rarity` in every slot (6 affixes on Rares). */
function geared(rarity: ItemRarity, rareAffixes = 6): HeroState {
  const hero = createHero();
  const bases = {
    spindle: 'ashwood',
    cloak: 'travelers_cloak',
    hood: 'wool_hood',
    boots: 'leather_boots',
    charm1: 'bone_charm',
    charm2: 'bone_charm',
  } as const;
  for (const [slot, base] of Object.entries(bases)) {
    const n = rarity === 'rare' ? rareAffixes : rarity === 'magic' ? 2 : 0;
    const affixes = Array.from({ length: n }, () => ({ id: 'life_flat', tier: 1, value: 10 }));
    const it = makeItem(hero, base, rarity, 10, affixes);
    hero.items.push(it);
    hero.equipped[slot as keyof typeof bases] = it.uid;
  }
  return hero;
}

describe('building upgrades', () => {
  it('raises the building with the cheapest weighted cost, skipping maxed ones', () => {
    const hero = createHero();
    const weighted = (b: BuildingId) => upgradeCost(b, 0) * upgradeWeights[b];
    const first = (Object.keys(buildings) as BuildingId[]).sort((a, b) => weighted(a) - weighted(b))[0];
    expect(nextUpgrade(hero)).toBe(first);
    hero.hearth.buildings.kindling_pit = buildings.kindling_pit.maxLevel;
    expect(nextUpgrade(hero)).not.toBe('kindling_pit');
    for (const b of Object.keys(buildings) as BuildingId[]) hero.hearth.buildings[b] = buildings[b].maxLevel;
    expect(nextUpgrade(hero)).toBeNull();
  });

  it('follows the weights: an expensive building waits while a cheaper one levels', () => {
    const hero = createHero();
    const w = { kindling_pit: 1, rune_garden: 100, expedition_board: 100, salvage_loom: 100 };
    for (let i = 0; i < 5; i++) {
      expect(nextUpgrade(hero, w)).toBe('kindling_pit');
      hero.hearth.buildings.kindling_pit++;
    }
  });
});

describe('Salvage Loom setting', () => {
  it('salvages one rarity below the worst equipped item, capped by the level', () => {
    const rare = geared('rare');
    expect(salvagePlan(rare)).toBe('off'); // not built
    rare.hearth.buildings.salvage_loom = 1;
    expect(salvagePlan(rare)).toBe('normal');
    rare.hearth.buildings.salvage_loom = 10;
    expect(salvagePlan(rare)).toBe('magic'); // never Rares
    const magic = geared('magic');
    magic.hearth.buildings.salvage_loom = 10;
    expect(salvagePlan(magic)).toBe('normal');
    const normal = newGameHero(); // a Normal spindle, empty slots
    normal.hearth.buildings.salvage_loom = 10;
    expect(salvagePlan(normal)).toBe('off');
  });
});

describe('Spindlewright purchases', () => {
  it('buys only what the crafting plan would spend, keeping a Scrap reserve', () => {
    const full = geared('rare', 6);
    full.threadScrap = 1000;
    expect(craftWants(full, 'golden_needle', 20)).toBe(false);
    expect(nextPurchase(full, 20)).toBeNull();
    expect(nextPurchase(full, 5)).toBe('rune_polish');
    const open = geared('rare', 4);
    open.threadScrap = spindlewrightPrices.golden_needle + scrapReserve;
    expect(nextPurchase(open, 20)).toBe('golden_needle');
    open.threadScrap -= 1;
    expect(nextPurchase(open, 20)).toBe(null);
    open.currency.golden_needle = 1; // already holds one: buys no second
    open.threadScrap = 1000;
    expect(craftWants(open, 'golden_needle', 20)).toBe(false);
    const three = geared('rare', 3);
    expect(craftWants(three, 'chaos_skein', null)).toBe(true);
    const fresh = newGameHero(); // a Normal spindle: Loom Shuttle
    expect(craftWants(fresh, 'loom_shuttle', null)).toBe(true);
    expect(craftWants(fresh, 'spool_of_change', null)).toBe(false);
  });
});

describe('Rune Garden', () => {
  it('plants unsocketed runes below the cap: ids the weaves use first, then the highest level', () => {
    const hero = createHero();
    const socketed = makeRune(hero, 'bolt', 12);
    const spareBolt = makeRune(hero, 'bolt', 3);
    const highOther = makeRune(hero, 'wide', 9);
    const lowOther = makeRune(hero, 'pierce', 2);
    const maxed = makeRune(hero, 'bolt', maxRuneLevel);
    hero.runes.push(socketed, spareBolt, highOther, lowOther, maxed);
    const s = new Set([socketed.uid]);
    expect(gardenPicks(hero, s, 2)).toEqual([spareBolt.uid, highOther.uid]);
    expect(gardenPicks(hero, s, 6)).toEqual([spareBolt.uid, highOther.uid, lowOther.uid]);
    expect(gardenPicks(hero, s, 0)).toEqual([]);
  });
});

describe('Rekindle and Mutations', () => {
  it('Rekindles at the tier cap, or once unlocked after enough failures or rifts without a new best', () => {
    const hero = createHero();
    const climb = (failuresInARow: number, riftsSinceBest = 0) => ({ failuresInARow, riftsSinceBest });
    const never = { stallFailures: null, stallRifts: null };
    hero.riftTier = rekindle.unlockTier - 1;
    expect(shouldRekindle(hero, climb(99, 99))).toBe(false);
    hero.riftTier = rekindle.unlockTier;
    expect(shouldRekindle(hero, climb(0))).toBe(false);
    expect(shouldRekindle(hero, climb(3), { stallFailures: 3, stallRifts: null })).toBe(true);
    expect(shouldRekindle(hero, climb(3), never)).toBe(false);
    expect(shouldRekindle(hero, climb(0, 9), { stallFailures: null, stallRifts: 10 })).toBe(false);
    expect(shouldRekindle(hero, climb(0, 10), { stallFailures: null, stallRifts: 10 })).toBe(true);
    hero.riftTier = rekindle.baseMaxTier;
    expect(shouldRekindle(hero, climb(0), never)).toBe(true);
  });

  it('saves for the mutations in order, Bright Hearth as often as listed', () => {
    const hero = createHero();
    expect(nextMutation(hero)).toBe(mutationOrder[0]);
    for (let i = 0; i < 200; i++) {
      const m = nextMutation(hero);
      if (m === null) break;
      hero.hearth.mutations[m] = (hero.hearth.mutations[m] ?? 0) + 1;
    }
    for (const id of new Set(mutationOrder))
      expect(hero.hearth.mutations[id]).toBe(mutationOrder.filter((x) => x === id).length);
  });
});
