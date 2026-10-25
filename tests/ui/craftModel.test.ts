import { beforeEach, describe, expect, it } from 'vitest';
import { currencies, currencyIds } from '../../data/currency';
import { Rng } from '../../src/sim/core/rng';
import { craftItem } from '../../src/sim/items/craft';
import {
  filterEntries,
  isFiltered,
  itemEntries,
  noFilter,
  problemFor,
  repeatState,
  runeEntries,
  wallet,
} from '../../src/ui/craft/craftModel';
import { confirmReason, currencyTip, itemProblem, shortProblem, shortRule } from '../../src/ui/craft/craftRules';
import { give, giveCurrency, giveRune, newGame, resetBenchState } from './craftFixture';

beforeEach(resetBenchState);

const life = { id: 'life_flat', tier: 5, value: 20 };
const resist = { id: 'fire_resist', tier: 5, value: 12 };

function gear() {
  const hero = newGame().state.hero;
  const normal = give(hero, 'wool_hood', 'normal');
  const magic = give(hero, 'bone_charm', 'magic', 6, [life]);
  const rare = give(hero, 'travelers_cloak', 'rare', 9, [life, resist], { name: 'Cinder Shroud' });
  const unique = give(hero, 'wool_hood', 'unique', 6, [], { unique: 'pyre_hood' });
  return { hero, normal, magic, rare, unique };
}

describe('which items a currency can take', () => {
  it('agrees with the sim on every currency and rarity', () => {
    const { hero } = gear();
    for (const id of currencyIds) {
      if (currencies[id].target === 'rune') continue;
      for (const item of hero.items) {
        const sim = craftItem(new Rng(5), structuredClone(item), id);
        expect(itemProblem(item, id), `${id} on ${item.rarity}`).toBe(sim);
      }
    }
  });

  it('says why in a few words: "Needs a Normal item"', () => {
    const { hero, magic, unique } = gear();
    expect(shortProblem(itemProblem(magic, 'weavers_knot')!)).toBe('Needs a Normal item');
    expect(problemFor(hero, 'chaos_skein', unique.uid)).toBe("Uniques can't be changed");
    expect(itemProblem(magic, 'chaos_skein')).toMatch(/^Needs a Rare item; this one is Magic/);
  });

  it('lists equipped items first and marks what a currency applies to', () => {
    const { hero, normal, rare } = gear();
    const entries = itemEntries(hero, 'weavers_knot');
    expect(entries[0]!.equipped).toBe(true);
    expect(entries.filter((e) => e.equipped).map((e) => e.item.base)).toEqual(['twig']);
    const by = (uid: number) => entries.find((e) => e.uid === uid)!;
    expect(by(normal.uid).problem).toBeNull();
    expect(by(rare.uid).reason).toBe('Needs a Normal item');
  });

  it('a Rune Polish item list explains that it works on runes, and runes refuse item currencies', () => {
    const { hero, normal } = gear();
    expect(itemEntries(hero, 'rune_polish').find((e) => e.uid === normal.uid)!.reason).toBe('Rune Polish works on runes');
    giveRune(hero, 'fire', 0);
    giveRune(hero, 'bolt', 20);
    const polish = runeEntries(hero, 'rune_polish');
    expect(polish.find((e) => e.rune.quality === 20)!.reason).toBe('Quality is already 20%');
    expect(polish.find((e) => e.rune.quality === 0 && e.rune.rune === 'fire')!.problem).toBeNull();
    expect(runeEntries(hero, 'weavers_knot').every((e) => e.reason === "Weaver's Knot works on items")).toBe(true);
  });
});

describe('filters and search', () => {
  it('filters by slot kind and by rarity', () => {
    const { hero, rare } = gear();
    const entries = itemEntries(hero, 'chaos_skein');
    expect(filterEntries(entries, { ...noFilter, slot: 'hood' }).map((e) => e.item.rarity).sort()).toEqual(['normal', 'unique']);
    expect(filterEntries(entries, { ...noFilter, rarity: 'rare' }).map((e) => e.uid)).toEqual([rare.uid]);
    expect(filterEntries(entries, { ...noFilter, slot: 'hood', rarity: 'rare' })).toEqual([]);
  });

  it('searches names and base names, every word, any case', () => {
    const { hero, rare } = gear();
    const entries = itemEntries(hero, 'chaos_skein');
    expect(filterEntries(entries, { ...noFilter, search: 'cinder' }).map((e) => e.uid)).toEqual([rare.uid]);
    expect(filterEntries(entries, { ...noFilter, search: "TRAVELER'S cloak" }).map((e) => e.uid)).toEqual([rare.uid]);
    expect(filterEntries(entries, { ...noFilter, search: 'cinder charm' })).toEqual([]);
    expect(filterEntries(entries, { ...noFilter, search: '  ' })).toHaveLength(entries.length);
  });

  it('"only what it can use" keeps the items the currency applies to', () => {
    const { hero, rare } = gear();
    const entries = itemEntries(hero, 'chaos_skein');
    expect(filterEntries(entries, { ...noFilter, usableOnly: true }).map((e) => e.uid)).toEqual([rare.uid]);
  });

  it('searches runes by name and knows when a filter is on', () => {
    const { hero } = gear();
    giveRune(hero, 'fire');
    giveRune(hero, 'bolt');
    const runes = runeEntries(hero, 'rune_polish');
    const found = filterEntries(runes, { ...noFilter, search: 'fir' }).map((e) => e.rune.rune);
    expect(found.length).toBeGreaterThan(0);
    expect(new Set(found)).toEqual(new Set(['fire']));
    expect(isFiltered(noFilter)).toBe(false);
    expect(isFiltered({ ...noFilter, search: 'x' })).toBe(true);
    expect(isFiltered({ ...noFilter, usableOnly: true })).toBe(true);
  });
});

describe('use again', () => {
  it('needs a last craft, the item, a stack and a currency that still applies', () => {
    const { hero, normal, rare } = gear();
    giveCurrency(hero, { chaos_skein: 1 });
    expect(repeatState(hero, null)).toEqual({ ok: false, why: 'Nothing to repeat yet' });
    expect(repeatState(hero, { currency: 'chaos_skein', uid: rare.uid })).toEqual({ ok: true, why: null });
    expect(repeatState(hero, { currency: 'chaos_skein', uid: 99999 }).why).toBe('That item is gone');
    expect(repeatState(hero, { currency: 'weavers_knot', uid: normal.uid }).why).toBe("You have no Weaver's Knot left");
    expect(repeatState(hero, { currency: 'chaos_skein', uid: normal.uid }).why).toMatch(/^Needs a Rare item/);
    giveCurrency(hero, {});
    expect(repeatState(hero, { currency: 'chaos_skein', uid: rare.uid }).ok).toBe(false);
  });
});

describe('wallet and currency text', () => {
  it('lists every currency in order with its count (0 for none)', () => {
    const hero = newGame().state.hero;
    giveCurrency(hero, { unpick: 2 });
    const w = wallet(hero);
    expect(w.map((x) => x.id)).toEqual([...currencyIds]);
    expect(w.find((x) => x.id === 'unpick')!.count).toBe(2);
    expect(w.find((x) => x.id === 'chaos_skein')!.count).toBe(0);
  });

  it('has a one-line rule and a hover text for every currency, built from the data', () => {
    for (const id of currencyIds) {
      expect(shortRule[id].length).toBeGreaterThan(3);
      const tip = currencyTip(id);
      expect(tip.name).toBe(currencies[id].name);
      expect(tip.lines[0]).toBe(currencies[id].text);
    }
    expect(shortRule.weavers_knot).toBe('Normal → Magic');
    const shuttle = currencyTip('loom_shuttle').lines.join('\n');
    expect(shuttle).toContain('4 (55%), 5 (30%), 6 (15%)');
    expect(currencyTip('rune_polish').lines.join('\n')).not.toContain('Item level');
  });
});

describe('when a craft asks first', () => {
  it('asks the first time on a Rare or Unique, then not; Chaos Skein asks every time on a Rare', () => {
    expect(confirmReason('normal', 'weavers_knot', false)).toBeNull();
    expect(confirmReason('magic', 'spool_of_change', false)).toBeNull();
    expect(confirmReason('rare', 'golden_needle', false)).toMatch(/Rare/);
    expect(confirmReason('rare', 'golden_needle', true)).toBeNull();
    expect(confirmReason('rare', 'chaos_skein', true)).toMatch(/rerolls every affix/);
    expect(confirmReason('unique', 'unpick', false)).toMatch(/Unique/);
    expect(confirmReason('magic', 'chaos_skein', false)).toBeNull();
  });
});
