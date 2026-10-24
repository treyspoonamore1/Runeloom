/** M7: every Hearth edit (meta/edits.ts), its effect and its refusals. */
import { describe, expect, it } from 'vitest';
import {
  buildings,
  embers,
  expeditionBoard,
  hearthRoom,
  mutations,
  spindlewrightPrices,
} from '../../../data/hearth';
import { maxRuneLevel } from '../../../data/progression';
import { riftAreaLevel } from '../../../data/rift';
import { createGame, newGameHero } from '../../../src/sim';
import { applyHeroEdit } from '../../../src/sim/hero/edits';
import { slotOfRune } from '../../../src/sim/hero/runes';
import { partTierFor } from '../../../src/sim/items/drops';
import { setSlotWeave } from '../../../src/sim/weave/runtime/loadout';
import { EXPEDITION_PARTS, expeditionRewardCounts } from '../../../src/sim/meta/expeditions';
import { expeditionSeconds, upgradeCost } from '../../../src/sim/meta/view';
import { giveRune } from '../hero/helpers';
import { build, hub, ok } from './helpers';

describe('the Hearth gate', () => {
  it('every edit but offline needs adventure mode, a lit Hearth and the hub', () => {
    const edit = { kind: 'hearthUpgrade', building: 'kindling_pit' } as const;
    expect(applyHeroEdit(hub({ lit: false }), edit)).toMatch(/not lit/);
    expect(applyHeroEdit(hub({ roomId: 'test/elsewhere' }), edit)).toBe('Only at the Hearth');
    const sandbox = createGame({
      seed: 1,
      roomText: `@id ${hearthRoom}\n####\n#..#\n####\n`,
      hero: newGameHero(),
    });
    expect(applyHeroEdit(sandbox, edit)).toMatch(/adventure/);
  });
});

describe('hearthUpgrade', () => {
  it('spends Embers, counts them as spent, raises the level and sends buildingUpgraded', () => {
    const s = hub();
    const h = s.hero.hearth;
    const cost = upgradeCost('kindling_pit', 0);
    ok(s, { kind: 'hearthUpgrade', building: 'kindling_pit' });
    expect(h.buildings.kindling_pit).toBe(1);
    expect(h.embers).toBe(embers.onLit - cost);
    expect(h.embersSpent).toBe(cost);
    expect(s.events).toContainEqual({ type: 'buildingUpgraded', building: 'kindling_pit', level: 1 });
  });

  it("the first visit's Embers buy any one first level, not two (M7 balance)", () => {
    const firsts = (Object.keys(buildings) as (keyof typeof buildings)[]).map((b) => upgradeCost(b, 0));
    const cheapest = [...firsts].sort((a, b) => a - b);
    expect(cheapest.at(-1)!).toBeLessThanOrEqual(embers.onLit);
    expect(cheapest[0]! + cheapest[1]!).toBeGreaterThan(embers.onLit);
  });

  it('is refused without the Embers and at max level', () => {
    const s = hub();
    s.hero.hearth.embers = 10;
    expect(applyHeroEdit(s, { kind: 'hearthUpgrade', building: 'rune_garden' })).toBe(
      `Needs ${upgradeCost('rune_garden', 0)} Embers (you have 10)`,
    );
    s.hero.hearth.embers = 1e9;
    build(s, { salvage_loom: buildings.salvage_loom.maxLevel });
    expect(applyHeroEdit(s, { kind: 'hearthUpgrade', building: 'salvage_loom' })).toMatch(/highest level/);
  });
});

describe('the Rune Garden', () => {
  it('plants a pouch rune, which then is not free to socket, and uproots it', () => {
    const s = hub();
    build(s, { rune_garden: 1 });
    giveRune(s, 'cast');
    const r = giveRune(s, 'strike', 3);
    ok(s, { kind: 'gardenPlant', uid: r.uid });
    expect(s.hero.hearth.garden).toEqual([r.uid]);
    expect(setSlotWeave(s, 2, 'Cast > Strike[]').applied).toBe(false);
    ok(s, { kind: 'gardenUproot', uid: r.uid });
    expect(s.hero.hearth.garden).toEqual([]);
    expect(setSlotWeave(s, 2, 'Cast > Strike[]').applied).toBe(true);
    expect(slotOfRune(s, r.uid)).toBe(2);
  });

  it('refuses socketed runes, unknown runes, full plots, an unbuilt garden and max-level runes', () => {
    const s = hub();
    const socketed = s.weaves.slots[0]!.runes![0]!;
    const r = giveRune(s, 'nova');
    expect(applyHeroEdit(s, { kind: 'gardenPlant', uid: r.uid })).toMatch(/Build the Rune Garden/);
    build(s, { rune_garden: 1 });
    expect(applyHeroEdit(s, { kind: 'gardenPlant', uid: socketed })).toMatch(/out of its weave/);
    expect(applyHeroEdit(s, { kind: 'gardenPlant', uid: 99999 })).toMatch(/don't have/);
    ok(s, { kind: 'gardenPlant', uid: r.uid });
    expect(applyHeroEdit(s, { kind: 'gardenPlant', uid: r.uid })).toMatch(/Already planted/);
    const r2 = giveRune(s, 'wide');
    expect(applyHeroEdit(s, { kind: 'gardenPlant', uid: r2.uid })).toMatch(/No free plot/);
    build(s, { rune_garden: 4 });
    const top = giveRune(s, 'split', maxRuneLevel);
    expect(applyHeroEdit(s, { kind: 'gardenPlant', uid: top.uid })).toMatch(/already level 20/);
    expect(applyHeroEdit(s, { kind: 'gardenUproot', uid: r2.uid })).toMatch(/isn't planted/);
  });
});

describe('expeditions', () => {
  it('send uses a free Weaver, a uid and the tier duration; collect rolls and grants the rewards', () => {
    const s = hub();
    build(s, { expedition_board: 1 });
    s.hero.riftTier = 9;
    const uid = s.hero.nextUid;
    ok(s, { kind: 'expeditionSend', tier: 9 });
    const d = expeditionBoard.baseSeconds + expeditionBoard.perTierSeconds * 9;
    expect(s.hero.hearth.expeditions).toEqual([{ uid, tier: 9, left: d, duration: d }]);
    expect(applyHeroEdit(s, { kind: 'expeditionSend', tier: 1 })).toMatch(/No free Weaver/);
    expect(applyHeroEdit(s, { kind: 'expeditionCollect', uid })).toMatch(/Not back yet/);
    ok(s, { kind: 'offline', seconds: d });
    expect(s.events).toContainEqual({ type: 'expeditionReturned', uid, tier: 9 });
    const parts = s.hero.parts.length;
    const embers = s.hero.hearth.embers;
    const sigils = s.hero.sigils.length;
    ok(s, { kind: 'expeditionCollect', uid });
    const n = expeditionRewardCounts(9);
    expect(s.hero.parts.length - parts).toBe(n.parts);
    for (const p of s.hero.parts.slice(parts)) {
      expect(EXPEDITION_PARTS).toContain(p.part);
      expect(p.tier).toBe(partTierFor(riftAreaLevel(9)));
    }
    const cur = Object.values(s.hero.currency).reduce((a, b) => a + (b ?? 0), 0);
    expect(cur).toBe(n.currency);
    expect(s.hero.hearth.embers - embers).toBe(n.embers);
    // M7 balance: its tier's sigil, or one tier higher (here at the tier cap, 10).
    expect(s.hero.sigils.length - sigils).toBe(n.sigils);
    for (const g of s.hero.sigils.slice(sigils)) expect([9, 10]).toContain(g.tier);
    expect(s.hero.hearth.expeditions).toEqual([]);
    expect(s.events).toContainEqual({
      type: 'expeditionCollected',
      uid,
      tier: 9,
      parts: n.parts,
      currency: n.currency,
      embers: n.embers,
      sigils: n.sigils,
    });
    expect(applyHeroEdit(s, { kind: 'expeditionCollect', uid })).toMatch(/No such/);
  });

  it('M7 balance: an expedition of the best tier counts as a completion of it; a lower one does not', () => {
    const s = hub();
    build(s, { expedition_board: 15 });
    s.hero.riftTier = 6;
    s.hero.riftBestClears = 2;
    ok(s, { kind: 'expeditionSend', tier: 6 });
    ok(s, { kind: 'expeditionSend', tier: 3 });
    ok(s, { kind: 'offline', seconds: 8 * 3600 });
    const [best, low] = s.hero.hearth.expeditions.map((e) => e.uid);
    ok(s, { kind: 'expeditionCollect', uid: low! });
    expect(s.hero.riftBestClears).toBe(2);
    expect([3, 4]).toContain(s.hero.sigils.at(-1)!.tier);
    ok(s, { kind: 'expeditionCollect', uid: best! });
    expect(s.hero.riftBestClears).toBe(3);
    expect([6, 7]).toContain(s.hero.sigils.at(-1)!.tier);
  });

  it('refuses tiers above the best completed (at least 1) and an unbuilt board', () => {
    const s = hub();
    expect(applyHeroEdit(s, { kind: 'expeditionSend', tier: 1 })).toMatch(/Build the Expedition Board/);
    build(s, { expedition_board: 6 });
    expect(applyHeroEdit(s, { kind: 'expeditionSend', tier: 2 })).toMatch(/tier 1 until/);
    expect(applyHeroEdit(s, { kind: 'expeditionSend', tier: 0 })).not.toBeNull();
    s.hero.riftTier = 3;
    expect(applyHeroEdit(s, { kind: 'expeditionSend', tier: 4 })).toMatch(/tiers 1 to 3/);
    ok(s, { kind: 'expeditionSend', tier: 3 });
    ok(s, { kind: 'expeditionSend', tier: 1 }); // level 6: two Weavers
    expect(applyHeroEdit(s, { kind: 'expeditionSend', tier: 1 })).toMatch(/No free Weaver/);
  });

  it('rewards are deterministic for the loot RNG', () => {
    const run = () => {
      const s = hub({ seed: 8 });
      build(s, { expedition_board: 1 });
      ok(s, { kind: 'expeditionSend', tier: 1 });
      ok(s, { kind: 'offline', seconds: expeditionSeconds(s.hero, 1) });
      ok(s, { kind: 'expeditionCollect', uid: s.hero.hearth.expeditions[0]!.uid });
      return JSON.stringify([s.hero.parts, s.hero.currency]);
    };
    expect(run()).toBe(run());
  });
});

describe('salvageSetting', () => {
  it('sets what the level allows and refuses more', () => {
    const s = hub();
    expect(applyHeroEdit(s, { kind: 'salvageSetting', setting: 'normal' })).toMatch(/Build the Salvage Loom/);
    build(s, { salvage_loom: 4 });
    ok(s, { kind: 'salvageSetting', setting: 'magic' });
    expect(s.hero.hearth.salvage).toBe('magic');
    expect(applyHeroEdit(s, { kind: 'salvageSetting', setting: 'rare' })).toMatch(/level 4 .* up to magic/);
    ok(s, { kind: 'salvageSetting', setting: 'off' });
    expect(s.hero.hearth.salvage).toBe('off');
  });
});

describe('spindlewrightBuy', () => {
  it('trades Thread Scrap for one currency, refused when short', () => {
    const s = hub();
    s.hero.threadScrap = spindlewrightPrices.chaos_skein + 1;
    ok(s, { kind: 'spindlewrightBuy', currency: 'chaos_skein' });
    expect(s.hero.threadScrap).toBe(1);
    expect(s.hero.currency.chaos_skein).toBe(1);
    expect(applyHeroEdit(s, { kind: 'spindlewrightBuy', currency: 'weavers_knot' })).toMatch(
      /costs 4 Thread Scrap/,
    );
  });
});

describe('mutationBuy', () => {
  it('spends Ash, counts purchases up to the max and refuses more or without Ash', () => {
    const s = hub();
    s.hero.hearth.ash = 12;
    for (let i = 0; i < 10; i++) ok(s, { kind: 'mutationBuy', mutation: 'bright_hearth' });
    expect(s.hero.hearth.mutations.bright_hearth).toBe(10);
    expect(s.hero.hearth.ash).toBe(2);
    expect(s.events).toContainEqual({ type: 'mutationBought', mutation: 'bright_hearth', count: 10 });
    expect(applyHeroEdit(s, { kind: 'mutationBuy', mutation: 'bright_hearth' })).toMatch(/10 times/);
    expect(applyHeroEdit(s, { kind: 'mutationBuy', mutation: 'twin_threads' })).toMatch(/costs 4 Ash/);
    ok(s, { kind: 'mutationBuy', mutation: 'shatterpoint' });
    expect(applyHeroEdit(s, { kind: 'mutationBuy', mutation: 'shatterpoint' })).toMatch(/already yours/);
    expect(s.hero.hearth.ash).toBe(2 - mutations.shatterpoint.ash);
  });
});
