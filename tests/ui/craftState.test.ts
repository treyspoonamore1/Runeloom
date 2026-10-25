import { beforeEach, describe, expect, it } from 'vitest';
import { hearthTab } from '../../src/ui/hearth/hearthSignals';
import { Bench } from '../../src/ui/craft/benchPanel';
import {
  cancelPending,
  chooseCurrency,
  clickTarget,
  confirmPending,
  craftArmed,
  craftCurrency,
  craftLast,
  craftPending,
  craftResult,
  craftSkipConfirm,
  craftTab,
  craftTarget,
  repeatCraft,
  spendCurrency,
} from '../../src/ui/craft/craftState';
import { ItemList } from '../../src/ui/craft/itemList';
import { BuyFromSpindlewright, Wallet, openSpindlewright } from '../../src/ui/craft/walletPanel';
import { give, giveCurrency, giveRune, newGame, resetBenchState, textOf } from './craftFixture';

beforeEach(resetBenchState);

const aff = [
  { id: 'life_flat', tier: 5, value: 20 },
  { id: 'fire_resist', tier: 5, value: 12 },
];

describe('pick a currency, then click items', () => {
  it('a click only selects until a currency is picked, so opening the bench spends nothing', () => {
    const s = newGame();
    const hero = s.state.hero;
    const it = give(hero, 'wool_hood', 'normal');
    giveCurrency(hero, { weavers_knot: 3 });
    clickTarget(s, it.uid);
    expect(craftTarget.value).toBe(it.uid);
    expect(it.rarity).toBe('normal');
    expect(hero.currency.weavers_knot).toBe(3);
  });

  it('with a currency armed, a click on a valid item uses it at once and the currency stays picked', () => {
    const s = newGame();
    const hero = s.state.hero;
    const a = give(hero, 'wool_hood', 'normal');
    const b = give(hero, 'bone_charm', 'normal');
    giveCurrency(hero, { weavers_knot: 3 });
    chooseCurrency('weavers_knot');
    clickTarget(s, a.uid);
    clickTarget(s, b.uid);
    expect([a.rarity, b.rarity]).toEqual(['magic', 'magic']);
    expect(hero.currency.weavers_knot).toBe(1);
    expect(craftArmed.value).toBe(true);
    expect(craftCurrency.value).toBe('weavers_knot');
    expect(craftLast.value).toEqual({ currency: 'weavers_knot', uid: b.uid });
    expect(craftResult.value).toMatchObject({ uid: b.uid, currency: 'weavers_knot' });
  });

  it('a click on an item the currency cannot take spends nothing and keeps the last result', () => {
    const s = newGame();
    const hero = s.state.hero;
    const magic = give(hero, 'bone_charm', 'magic', 6, [aff[0]!]);
    const normal = give(hero, 'wool_hood', 'normal');
    giveCurrency(hero, { weavers_knot: 2 });
    chooseCurrency('weavers_knot');
    clickTarget(s, normal.uid);
    const result = craftResult.value;
    clickTarget(s, magic.uid);
    expect(hero.currency.weavers_knot).toBe(1);
    expect(craftResult.value).toBe(result);
    expect(craftTarget.value).toBe(magic.uid);
  });

  it('refuses with no stack left and spends nothing', () => {
    const s = newGame();
    const hero = s.state.hero;
    const it = give(hero, 'wool_hood', 'normal');
    giveCurrency(hero, {});
    chooseCurrency('weavers_knot');
    clickTarget(s, it.uid);
    expect(it.rarity).toBe('normal');
    expect(craftResult.value).toBeNull();
  });

  it('picking the armed currency again puts it away; Rune Polish opens the Runes tab, others the Items tab', () => {
    chooseCurrency('rune_polish');
    expect(craftTab.value).toBe('runes');
    chooseCurrency('rune_polish');
    expect(craftArmed.value).toBe(false);
    chooseCurrency('unpick');
    expect(craftTab.value).toBe('items');
    expect(craftArmed.value).toBe(true);
  });

  it('polishes a rune with one click', () => {
    const s = newGame();
    const hero = s.state.hero;
    const r = giveRune(hero, 'fire', 4);
    giveCurrency(hero, { rune_polish: 2 });
    chooseCurrency('rune_polish');
    clickTarget(s, r.uid);
    expect(r.quality).toBe(5);
    expect(craftResult.value!.outcome).toBe('Quality 4% → 5%');
  });
});

describe('confirmation', () => {
  it('asks the first time on a Rare, then not for that item', () => {
    const s = newGame();
    const hero = s.state.hero;
    const rare = give(hero, 'travelers_cloak', 'rare', 12, aff, { name: 'Cinder Shroud' });
    giveCurrency(hero, { golden_needle: 3 });
    chooseCurrency('golden_needle');
    clickTarget(s, rare.uid);
    expect(craftPending.value).toMatchObject({ uid: rare.uid, currency: 'golden_needle', name: 'Cinder Shroud' });
    expect(rare.affixes).toHaveLength(2);
    confirmPending(s, false);
    expect(craftPending.value).toBeNull();
    expect(rare.affixes).toHaveLength(3);
    clickTarget(s, rare.uid);
    expect(craftPending.value).toBeNull();
    expect(rare.affixes).toHaveLength(4);
    expect(hero.currency.golden_needle).toBe(1);
  });

  it('cancelling uses nothing', () => {
    const s = newGame();
    const hero = s.state.hero;
    const rare = give(hero, 'travelers_cloak', 'rare', 12, aff);
    giveCurrency(hero, { unpick: 1 });
    chooseCurrency('unpick');
    clickTarget(s, rare.uid);
    cancelPending();
    expect(rare.affixes).toHaveLength(2);
    expect(hero.currency.unpick).toBe(1);
  });

  it('Chaos Skein asks every time on a Rare', () => {
    const s = newGame();
    const hero = s.state.hero;
    const rare = give(hero, 'travelers_cloak', 'rare', 12, aff);
    giveCurrency(hero, { chaos_skein: 3 });
    chooseCurrency('chaos_skein');
    clickTarget(s, rare.uid);
    confirmPending(s, false);
    expect(hero.currency.chaos_skein).toBe(2);
    clickTarget(s, rare.uid);
    expect(craftPending.value).not.toBeNull();
    expect(hero.currency.chaos_skein).toBe(2);
  });

  it('"don\'t ask again this session" stops every confirmation, Chaos Skein included', () => {
    const s = newGame();
    const hero = s.state.hero;
    const rare = give(hero, 'travelers_cloak', 'rare', 12, aff);
    const other = give(hero, 'bone_charm', 'rare', 12, aff);
    giveCurrency(hero, { chaos_skein: 5 });
    chooseCurrency('chaos_skein');
    clickTarget(s, rare.uid);
    confirmPending(s, true);
    expect(craftSkipConfirm.value).toBe(true);
    clickTarget(s, rare.uid);
    clickTarget(s, other.uid);
    expect(craftPending.value).toBeNull();
    expect(hero.currency.chaos_skein).toBe(2);
  });

  it('Normal and Magic items never ask', () => {
    const s = newGame();
    const hero = s.state.hero;
    const magic = give(hero, 'bone_charm', 'magic', 6, [aff[0]!]);
    giveCurrency(hero, { spool_of_change: 2 });
    chooseCurrency('spool_of_change');
    clickTarget(s, magic.uid);
    expect(craftPending.value).toBeNull();
    expect(hero.currency.spool_of_change).toBe(1);
  });
});

describe('use again', () => {
  it('repeats the last currency on the last item, and says why when it cannot', () => {
    const s = newGame();
    const hero = s.state.hero;
    const magic = give(hero, 'bone_charm', 'magic', 6, [aff[0]!]);
    giveCurrency(hero, { spool_of_change: 2 });
    repeatCraft(s); // nothing yet
    expect(hero.currency.spool_of_change).toBe(2);
    spendCurrency(s, 'spool_of_change', magic.uid);
    expect(craftResult.value!.n).toBeGreaterThan(0);
    const first = craftResult.value!.n;
    repeatCraft(s);
    expect(hero.currency.spool_of_change ?? 0).toBe(0);
    expect(craftResult.value!.n).toBe(first + 1);
    repeatCraft(s); // none left
    expect(craftResult.value!.n).toBe(first + 1);
  });

  it('keeps the last result until the next craft, even when another item is selected', () => {
    const s = newGame();
    const hero = s.state.hero;
    const a = give(hero, 'wool_hood', 'normal');
    const b = give(hero, 'bone_charm', 'normal');
    giveCurrency(hero, { weavers_knot: 2 });
    spendCurrency(s, 'weavers_knot', a.uid);
    const result = craftResult.value;
    craftTarget.value = b.uid;
    expect(craftResult.value).toBe(result);
    expect(textOf(Bench({ session: s, hero, rev: 0, onTab: () => {} }))).toContain('Last craft');
  });
});

describe('the bench panels', () => {
  it('the list dims what the picked currency cannot take, with the reason', () => {
    const s = newGame();
    const hero = s.state.hero;
    give(hero, 'travelers_cloak', 'rare', 12, aff, { name: 'Cinder Shroud' });
    giveCurrency(hero, { weavers_knot: 1 });
    const idle = textOf(ItemList({ session: s, hero, rev: 0 }));
    expect(idle).toContain('Pick a currency, then click what to use it on');
    expect(idle).not.toContain('Needs a Normal item');
    chooseCurrency('weavers_knot');
    const armed = textOf(ItemList({ session: s, hero, rev: 0 }));
    expect(armed).toContain('Needs a Normal item');
    expect(armed).toContain('Click to use Weaver');
  });

  it('shows empty states for no gear and for filters that match nothing', () => {
    const s = newGame();
    const hero = s.state.hero;
    hero.items.length = 0;
    expect(textOf(ItemList({ session: s, hero, rev: 0 }))).toContain('No gear yet');
    give(hero, 'wool_hood', 'normal');
    craftTab.value = 'items';
    chooseCurrency('weavers_knot');
    expect(textOf(ItemList({ session: s, hero, rev: 0 }))).not.toContain('Nothing matches');
  });

  it('the wallet shows each currency with its rule and Thread Scrap', () => {
    const s = newGame();
    const hero = s.state.hero;
    hero.threadScrap = 17;
    giveCurrency(hero, { chaos_skein: 2 });
    const text = textOf(Wallet({ session: s, hero, rev: 0, onTab: () => {} }));
    expect(text).toMatch(/17\s+Scrap/);
    expect(text).toContain("Weaver's Knot");
    expect(text).toContain('Normal → Magic');
    expect(text).toMatch(/×\s*2/);
  });

  it('offers the Spindlewright only once the Hearth is lit, and opens its tab', () => {
    const s = newGame();
    const hero = s.state.hero;
    expect(BuyFromSpindlewright({ session: s, hero, currency: 'unpick', onTab: () => {} })).toBeNull();
    const opened: string[] = [];
    hearthTab.value = 'buildings';
    openSpindlewright((id) => opened.push(id));
    expect(hearthTab.value).toBe('spindlewright');
    expect(opened).toEqual(['hearth']);
    hero.hearth.lit = true;
    const away = textOf(BuyFromSpindlewright({ session: s, hero, currency: 'unpick', onTab: () => {} }));
    expect(away).toContain('at the Hearth');
    expect(away).not.toContain('Buy from');
  });
});
