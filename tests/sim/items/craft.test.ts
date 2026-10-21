import { describe, expect, it } from 'vitest';
import {
  Rng,
  craftItem,
  eligibleAffixes,
  polishRune,
  rollCurrency,
  rollExtraAffix,
  rollRareAffixes,
  rollRarity,
  rollUnique,
  tiersAt,
  uniquesAt,
  type GameState,
} from '../../../src/sim';
import { affixes, type AffixDef } from '../../../data/affixes';
import { currencies, currencyIds, rareAffixCount, type CurrencyId } from '../../../data/currency';
import { itemKinds, type ItemKind } from '../../../data/items';
import { uniques } from '../../../data/uniques';
import { createHero } from '../../../src/sim/hero/hero';
import { makeItem, makeRune } from '../../../src/sim/items/items';
import type { AffixRoll, Item } from '../../../src/sim/hero/types';

/** Rolls per statistical test (M5 acceptance: 100,000). */
const N = 100_000;
const defs: Record<string, AffixDef> = affixes;

/** Within 5 standard deviations of a binomial(n, p) mean. */
function expectRate(count: number, n: number, p: number): void {
  const sd = Math.sqrt(n * p * (1 - p));
  expect(Math.abs(count - n * p)).toBeLessThanOrEqual(5 * sd + 1e-9);
}

function item(base: string, rarity: Item['rarity'], level: number, list: AffixRoll[] = []): Item {
  const it = makeItem(createHero(), base, rarity, level, list);
  return it;
}

const KIND_BASE: Record<ItemKind, string> = {
  spindle: 'ashwood',
  cloak: 'travelers_cloak',
  hood: 'wool_hood',
  boots: 'leather_boots',
  charm: 'bone_charm',
};

function sideOf(a: AffixRoll): 'prefix' | 'suffix' {
  return defs[a.id]!.kind;
}

/** Every affix is in its kind's pool, its tier allowed at the item level, its value in range, groups distinct, sides within limits. */
function expectLegal(it: Item, kind: ItemKind, maxPerSide: number): void {
  const groups = new Set<string>();
  let pre = 0;
  let suf = 0;
  for (const a of it.affixes) {
    const def = defs[a.id]!;
    expect(def.kinds).toContain(kind);
    const tier = def.tiers.find((t) => t.tier === a.tier)!;
    expect(tier.itemLevel).toBeLessThanOrEqual(it.itemLevel);
    expect(a.value).toBeGreaterThanOrEqual(tier.min);
    expect(a.value).toBeLessThanOrEqual(tier.max);
    expect(groups.has(def.group)).toBe(false);
    groups.add(def.group);
    if (def.kind === 'prefix') pre++;
    else suf++;
  }
  expect(pre).toBeLessThanOrEqual(maxPerSide);
  expect(suf).toBeLessThanOrEqual(maxPerSide);
}

describe('crafting currencies: rules (DESIGN §8.5)', () => {
  const rng = new Rng(11);

  it('each item currency needs the right rarity and leaves the item unchanged when refused', () => {
    const cases: [CurrencyId, Item['rarity'][]][] = [
      ['weavers_knot', ['normal']],
      ['spool_of_change', ['magic']],
      ['loom_shuttle', ['normal']],
      ['chaos_skein', ['rare']],
      ['golden_needle', ['rare']],
      ['unpick', ['magic', 'rare']],
    ];
    for (const [cur, ok] of cases)
      for (const rarity of ['normal', 'magic', 'rare', 'unique'] as const) {
        const it = item(
          'wool_hood',
          rarity,
          9,
          rarity === 'normal' ? [] : [{ id: 'mana_flat', tier: 2, value: 10 }],
        );
        if (rarity === 'unique') it.unique = 'pyre_hood';
        const before = structuredClone(it);
        const err = craftItem(rng, it, cur);
        if (ok.includes(rarity)) expect(err, `${cur} on ${rarity}`).toBeNull();
        else {
          expect(err, `${cur} on ${rarity}`).not.toBeNull();
          expect(it).toEqual(before);
        }
      }
  });

  it("Weaver's Knot and Loom Shuttle change the rarity; a Rare gets a name that Chaos Skein keeps", () => {
    const a = item('bone_charm', 'normal', 7);
    expect(craftItem(rng, a, 'weavers_knot')).toBeNull();
    expect(a.rarity).toBe('magic');
    expect(a.affixes.length).toBeGreaterThanOrEqual(1);
    const b = item('bone_charm', 'normal', 7);
    expect(craftItem(rng, b, 'loom_shuttle')).toBeNull();
    expect(b.rarity).toBe('rare');
    expect(b.name).toMatch(/^\w+ \w+$/);
    const name = b.name;
    expect(craftItem(rng, b, 'chaos_skein')).toBeNull();
    expect(b.name).toBe(name);
    expect(b.rarity).toBe('rare');
  });

  it('Golden Needle refuses a full Rare; Unpick refuses an item with no affixes', () => {
    const full = item('ashwood', 'rare', 10);
    full.affixes = rollRareAffixes(new Rng(5), 'spindle', 10);
    while (full.affixes.length < 6) expect(craftItem(rng, full, 'golden_needle')).toBeNull();
    expect(craftItem(rng, full, 'golden_needle')).toMatch(/no room/);
    const bare = item('ashwood', 'magic', 10, []);
    expect(craftItem(rng, bare, 'unpick')).toMatch(/no affixes/);
  });

  it('Rune Polish adds 1% quality up to 20%', () => {
    const r = makeRune(createHero(), 'bolt');
    for (let i = 1; i <= 20; i++) {
      expect(polishRune(r)).toBeNull();
      expect(r.quality).toBe(i);
    }
    expect(polishRune(r)).toMatch(/20%/);
    expect(r.quality).toBe(20);
  });
});

describe(`crafting probabilities, ${N.toLocaleString('en')} rolls each (M5 acceptance)`, () => {
  it("Weaver's Knot: prefix 75%, suffix 75%, each affix by weight within its side", () => {
    const rng = new Rng(101);
    const kind: ItemKind = 'cloak';
    const level = 10;
    const counts = new Map<string, number>();
    let both = 0;
    for (let i = 0; i < N; i++) {
      const it = item(KIND_BASE[kind], 'normal', level);
      craftItem(rng, it, 'weavers_knot');
      if (it.affixes.length === 2) both++;
      for (const a of it.affixes) counts.set(a.id, (counts.get(a.id) ?? 0) + 1);
    }
    expectRate(both, N, 0.5);
    for (const side of ['prefix', 'suffix'] as const) {
      const pool = eligibleAffixes(kind, side, level, new Set());
      const total = pool.reduce((s, a) => s + a.weight, 0);
      for (const a of pool) expectRate(counts.get(a.id) ?? 0, N, 0.75 * (a.weight / total));
    }
  });

  it('tiers roll evenly among those the item level allows, values evenly within the tier', () => {
    const rng = new Rng(102);
    const tierCount = new Map<number, number>();
    const valueCount = new Map<number, number>();
    let rolls = 0;
    for (let i = 0; i < N; i++) {
      const it = item('travelers_cloak', 'normal', 6);
      craftItem(rng, it, 'weavers_knot');
      for (const a of it.affixes)
        if (a.id === 'fire_resist') {
          rolls++;
          tierCount.set(a.tier, (tierCount.get(a.tier) ?? 0) + 1);
          if (a.tier === 3) valueCount.set(a.value, (valueCount.get(a.value) ?? 0) + 1);
        }
    }
    // Resist tiers: T3 from item level 1, T2 from 4, T1 from 8 (data/affixes.ts).
    const allowed = tiersAt(affixes.fire_resist, 6);
    expect(allowed.map((t) => t.tier)).toEqual([2, 3]);
    for (const t of allowed) expectRate(tierCount.get(t.tier) ?? 0, rolls, 1 / allowed.length);
    const t3 = affixes.fire_resist.tiers.find((t) => t.tier === 3)!;
    const span = t3.max - t3.min + 1;
    const t3Rolls = tierCount.get(3) ?? 0;
    for (let v = t3.min; v <= t3.max; v++) expectRate(valueCount.get(v) ?? 0, t3Rolls, 1 / span);
  });

  it('Loom Shuttle: 4, 5 or 6 affixes by weight, never more than 3 per side, never a group twice', () => {
    const rng = new Rng(103);
    const byCount = new Map<number, number>();
    for (let i = 0; i < N; i++) {
      const it = item('ashwood', 'normal', 10);
      craftItem(rng, it, 'loom_shuttle');
      expectLegal(it, 'spindle', 3);
      byCount.set(it.affixes.length, (byCount.get(it.affixes.length) ?? 0) + 1);
    }
    const total = rareAffixCount.reduce((s, c) => s + c.weight, 0);
    for (const c of rareAffixCount) expectRate(byCount.get(c.count) ?? 0, N, c.weight / total);
  });

  it('Rares on every item kind stay legal; small pools give fewer affixes', () => {
    const rng = new Rng(104);
    for (const kind of itemKinds) {
      let most = 0;
      for (let i = 0; i < N / 5; i++) {
        const it = item(KIND_BASE[kind], 'normal', 10);
        craftItem(rng, it, i % 2 ? 'loom_shuttle' : 'weavers_knot');
        if (it.rarity === 'magic') craftItem(rng, it, 'spool_of_change');
        else craftItem(rng, it, 'chaos_skein');
        expectLegal(it, kind, it.rarity === 'rare' ? 3 : 1);
        most = Math.max(most, it.affixes.length);
      }
      const pre = Math.min(3, eligibleAffixes(kind, 'prefix', 10, new Set()).length);
      const suf = Math.min(3, eligibleAffixes(kind, 'suffix', 10, new Set()).length);
      expect(most, kind).toBe(Math.min(6, pre + suf));
    }
  });

  it('Golden Needle: a side evenly when both are open, the open side when one is full', () => {
    const rng = new Rng(105);
    let prefixes = 0;
    for (let i = 0; i < N; i++) {
      const it = item('ashwood', 'rare', 10, [{ id: 'cast_speed', tier: 1, value: 10 }]);
      craftItem(rng, it, 'golden_needle');
      expect(it.affixes.length).toBe(2);
      if (it.affixes.some((a) => sideOf(a) === 'prefix')) prefixes++;
    }
    expectRate(prefixes, N, 0.5);
    const fullPrefixes: AffixRoll[] = [
      { id: 'fire_damage', tier: 1, value: 20 },
      { id: 'frost_damage', tier: 1, value: 20 },
      { id: 'storm_damage', tier: 1, value: 20 },
    ];
    for (let i = 0; i < 2000; i++) {
      const it = item('ashwood', 'rare', 10, [...fullPrefixes]);
      craftItem(rng, it, 'golden_needle');
      expect(sideOf(it.affixes[3]!)).toBe('suffix');
    }
  });

  it('Unpick removes each affix with equal chance', () => {
    const rng = new Rng(106);
    const list: AffixRoll[] = [
      { id: 'fire_damage', tier: 1, value: 20 },
      { id: 'branch_damage', tier: 1, value: 20 },
      { id: 'cast_speed', tier: 1, value: 10 },
      { id: 'crit_chance', tier: 1, value: 3 },
    ];
    const removed = new Map<string, number>();
    for (let i = 0; i < N; i++) {
      const it = item(
        'ashwood',
        'rare',
        10,
        list.map((a) => ({ ...a })),
      );
      craftItem(rng, it, 'unpick');
      expect(it.affixes.length).toBe(3);
      const gone = list.find((a) => !it.affixes.some((b) => b.id === a.id))!;
      removed.set(gone.id, (removed.get(gone.id) ?? 0) + 1);
    }
    for (const a of list) expectRate(removed.get(a.id) ?? 0, N, 0.25);
  });

  it('affixes sharing a group never roll together on a Rare or from a Golden Needle', () => {
    const pool: AffixDef[] = [
      { ...affixes.fire_damage, id: 'a', group: 'shared' },
      { ...affixes.frost_damage, id: 'b', group: 'shared' },
      { ...affixes.storm_damage, id: 'c', group: 'shared' },
      { ...affixes.branch_damage, id: 'd', group: 'other' },
      { ...affixes.cast_speed, id: 'e', group: 'speed' },
      { ...affixes.crit_chance, id: 'f', group: 'speed' },
    ];
    const rng = new Rng(107);
    const seen = new Map<string, number>();
    for (let i = 0; i < N; i++) {
      const rolled = rollRareAffixes(rng, 'spindle', 10, pool);
      const extra = rollExtraAffix(rng, 'spindle', 10, 'rare', rolled, pool);
      const all = extra ? [...rolled, extra] : rolled;
      const shared = all.filter((a) => a.id === 'a' || a.id === 'b' || a.id === 'c').length;
      const speed = all.filter((a) => a.id === 'e' || a.id === 'f').length;
      expect(shared).toBeLessThanOrEqual(1);
      expect(speed).toBeLessThanOrEqual(1);
      // Two groups per side at most, so a Rare from this pool tops out at 3 affixes.
      expect(all.length).toBeLessThanOrEqual(3);
      for (const a of all) seen.set(a.id, (seen.get(a.id) ?? 0) + 1);
    }
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) expect(seen.get(id) ?? 0).toBeGreaterThan(0);
  });

  it('currency drops follow their drop weights', () => {
    const rng = new Rng(108);
    const counts = new Map<CurrencyId, number>();
    for (let i = 0; i < N; i++) {
      const c = rollCurrency(rng);
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const total = currencyIds.reduce((s, id) => s + currencies[id].dropWeight, 0);
    for (const id of currencyIds) expectRate(counts.get(id) ?? 0, N, currencies[id].dropWeight / total);
  });

  it('item rarity drops follow their weights', () => {
    const rng = new Rng(109);
    const w = { normal: 35, magic: 52, rare: 13 };
    const counts = { normal: 0, magic: 0, rare: 0 };
    for (let i = 0; i < N; i++) counts[rollRarity(rng, w)]++;
    for (const r of ['normal', 'magic', 'rare'] as const) expectRate(counts[r], N, w[r] / 100);
  });

  it('unique drops follow their weights among the uniques the item level allows', () => {
    const fake = { lootRng: new Rng(110), hero: createHero() } as unknown as GameState;
    expect(uniquesAt(3).map((u) => u.id)).toEqual(['the_first_thread']);
    const allowed = uniquesAt(8);
    expect(allowed.length).toBe(Object.keys(uniques).length);
    const counts = new Map<string, number>();
    for (let i = 0; i < N; i++) {
      const u = rollUnique(fake, 8)!;
      expect(u.rarity).toBe('unique');
      counts.set(u.unique!, (counts.get(u.unique!) ?? 0) + 1);
    }
    const total = allowed.reduce((s, u) => s + u.dropWeight, 0);
    for (const u of allowed) expectRate(counts.get(u.id) ?? 0, N, u.dropWeight / total);
  });
});
