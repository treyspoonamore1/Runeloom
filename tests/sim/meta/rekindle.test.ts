/** M7 acceptance: Rekindle resets exactly what DESIGN §11 and DECISIONS 2026-10-24 list, and nothing else. */
import { describe, expect, it } from 'vitest';
import { BUILDING_IDS, mutationEffects, rekindle } from '../../../data/hearth';
import { makeSave, type GameState } from '../../../src/sim';
import { applyHeroEdit } from '../../../src/sim/hero/edits';
import { makeSigil } from '../../../src/sim/items/sigils';
import { makeItem, makePart } from '../../../src/sim/items/items';
import { ashForRekindle, maxRiftTier } from '../../../src/sim/meta/view';
import { expeditionRewardCounts } from '../../../src/sim/meta/expeditions';
import { riftBossTierUpChance, riftDrops } from '../../../data/rift';
import { freeRunes } from '../../../src/sim/hero/runes';
import { build, hub, ok, plant } from './helpers';

/** A Hearth well into a cycle: buildings, garden, expeditions, sigils, a tier 9 best, gear and currency. */
function deepCycle(): GameState {
  const state = hub({ seed: 4 });
  const hero = state.hero;
  const h = hero.hearth;
  build(state, { kindling_pit: 9, rune_garden: 8, expedition_board: 6, salvage_loom: 5 });
  h.embers = 1234;
  h.embersSpent = 20000;
  h.scrapCarry = 0.625;
  h.salvage = 'magic';
  h.ash = 2;
  h.mutations = { bright_hearth: 2, deeper_weave: 1 };
  h.playSeconds = 9000;
  h.clock = 17;
  plant(state, ['bolt', 'nova'], 7);
  h.expeditions.push({ uid: hero.nextUid++, tier: 4, left: 120, duration: 1080, cycle: 0 });
  hero.riftTier = 9;
  hero.riftBestClears = 4;
  hero.sigils.push(makeSigil(hero, 9, ['hardened']), makeSigil(hero, 10, []));
  hero.items.push(makeItem(hero, 'travelers_cloak', 'rare', 20));
  hero.parts.push(makePart(hero, 'kiln_chitin', 3));
  hero.threadScrap = 77;
  hero.currency = { chaos_skein: 3 };
  hero.level = 30;
  return state;
}

describe('Rekindle (M7 acceptance)', () => {
  it('resets exactly the list and nothing else', () => {
    const state = deepCycle();
    const ash = ashForRekindle(state.hero);
    expect(ash).toBe(9 - rekindle.unlockTier + 1 + Math.floor(Math.sqrt(20000 / rekindle.emberDivisor)));
    const before = makeSave(state);
    const planted = [...state.hero.hearth.garden];
    ok(state, { kind: 'rekindle' });
    const after = makeSave(state);

    const expected = structuredClone(before);
    const h = expected.hero.hearth;
    h.embers = 0;
    h.embersSpent = 0;
    for (const b of BUILDING_IDS) h.buildings[b] = 0;
    h.scrapCarry = 0;
    h.garden = [];
    h.salvage = 'off';
    expected.hero.riftTier = 0;
    expected.hero.riftBestClears = 0;
    expected.hero.sigils = [];
    h.ash = before.hero.hearth.ash + ash;
    h.rekindles = before.hero.hearth.rekindles + 1;
    h.bestEverTier = 9; // M7 re-climb: kept, and at least the ladder Rekindle resets
    expect(after).toEqual(expected);

    // The garden's runes are back in the pouch, levels kept, free to socket.
    const free = freeRunes(state).map((r) => r.uid);
    for (const u of planted) {
      expect(free).toContain(u);
      expect(state.hero.runes.find((r) => r.uid === u)!.level).toBe(7);
    }
    expect(maxRiftTier(state.hero)).toBe(rekindle.baseMaxTier + rekindle.maxTierPerRekindle);
    expect(state.events).toContainEqual({ type: 'rekindled', ash, rekindles: 1, maxTier: 12 });
  });

  it('each Rekindle raises the cap by 2, up to tier 16', () => {
    const state = deepCycle();
    const caps: number[] = [];
    for (let i = 0; i < 4; i++) {
      state.hero.riftTier = 8;
      ok(state, { kind: 'rekindle' });
      caps.push(maxRiftTier(state.hero));
    }
    expect(caps).toEqual([12, 14, 16, 16]);
    expect(state.hero.hearth.rekindles).toBe(4);
  });

  it('Sigil Cache: five plain tier 3 sigils that the ladder opens', () => {
    const state = deepCycle();
    state.hero.hearth.mutations.sigil_cache = 1;
    const uid = state.hero.nextUid;
    ok(state, { kind: 'rekindle' });
    const { tier, count } = mutationEffects.sigilCache;
    expect(state.hero.sigils).toEqual(
      Array.from({ length: count }, (_, i) => ({ uid: uid + i, tier, mods: [] })),
    );
    expect(state.hero.riftTier).toBe(tier - 1);
  });

  it('is refused below tier 8, with a rift open, outside the hub and unlit', () => {
    const low = deepCycle();
    low.hero.riftTier = 7;
    expect(applyHeroEdit(low, { kind: 'rekindle' })).toMatch(/tier 8/);
    const rift = deepCycle();
    rift.world.rift = {
      spec: { index: 0, seed: 1, tier: 9, mods: [], home: { roomId: 'x', key: 'y' } },
      bossDead: false,
    };
    expect(applyHeroEdit(rift, { kind: 'rekindle' })).toMatch(/rift/);
    const away = hub({ roomId: 'emberwood/e1_glade' });
    away.hero.riftTier = 9;
    expect(applyHeroEdit(away, { kind: 'rekindle' })).toMatch(/Only at the Hearth/);
    const dark = hub({ lit: false });
    dark.hero.riftTier = 9;
    expect(applyHeroEdit(dark, { kind: 'rekindle' })).toMatch(/not lit/);
    for (const s of [low, rift, away, dark]) expect(s.hero.hearth.rekindles).toBe(0);
  });

  it('keeps the best tier ever, so the next cycle re-climbs fast below it', () => {
    const state = deepCycle();
    state.hero.hearth.bestEverTier = 12; // an earlier cycle went higher
    ok(state, { kind: 'rekindle' });
    expect(state.hero.hearth.bestEverTier).toBe(12);
    expect(riftBossTierUpChance(5, 0, state.hero.hearth.bestEverTier)).toBe(riftDrops.reclimbTierUp);
  });

  it('expeditions sent before a Rekindle return without a sigil or a best-tier completion', () => {
    const state = deepCycle();
    const h = state.hero.hearth;
    h.expeditions = [];
    build(state, { expedition_board: 15 });
    ok(state, { kind: 'expeditionSend', tier: 9 });
    ok(state, { kind: 'expeditionSend', tier: 9 });
    ok(state, { kind: 'rekindle' });
    expect(h.expeditions.map((e) => e.cycle)).toEqual([0, 0]);
    ok(state, { kind: 'offline', seconds: 8 * 3600 });
    state.hero.riftTier = 9; // even at the new cycle's best tier, no completion is counted
    const clears = state.hero.riftBestClears;
    const [a, b] = h.expeditions.map((e) => e.uid);
    ok(state, { kind: 'expeditionCollect', uid: a! });
    ok(state, { kind: 'expeditionCollect', uid: b! });
    expect(state.hero.sigils).toEqual([]);
    expect(state.hero.riftBestClears).toBe(clears);
    const got = state.events.filter((e) => e.type === 'expeditionCollected');
    expect(got.map((e) => e.type === 'expeditionCollected' && [e.sigils, e.beforeRekindle])).toEqual([
      [0, true],
      [0, true],
    ]);
    // The Board's preview says the same: everything but the sigil.
    expect(expeditionRewardCounts(9, false)).toEqual({ ...expeditionRewardCounts(9), sigils: 0 });
  });
});
