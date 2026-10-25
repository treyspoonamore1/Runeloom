import { beforeEach, describe, expect, it } from 'vitest';
import type { CurrencyId } from '../../data/currency';
import { affixLine } from '../../src/ui/craft/affixLine';
import { buildResult, diffLines, outcomeText, snapshotOf } from '../../src/ui/craft/craftDiff';
import { sendEdit } from '../../src/ui/heroAdapter';
import { give, giveCurrency, giveRune, newGame, resetBenchState } from './craftFixture';

beforeEach(resetBenchState);

const line = (id: string, tier: number, value: number, itemLevel = 9) => affixLine({ id, tier, value }, { itemLevel });

describe('affix lines', () => {
  it('carry side, tier, the tier range and a hover text', () => {
    const l = line('life_flat', 5, 27);
    expect(l.text).toBe('+27 to maximum life');
    expect(l.side).toBe('prefix');
    expect(l.tier).toBe(5);
    expect(l.range).toMatch(/^\d+–\d+$/);
    expect(l.hint).toContain('Prefix, tier 5');
    expect(l.hint).toContain(`rolls ${l.range}`);
    expect(line('fire_resist', 5, 12).side).toBe('suffix');
  });

  it('keep a plain line for an unknown affix id instead of failing', () => {
    const l = line('mystery', 2, 3);
    expect(l.text).toBe('mystery');
    expect(l.range).toBeNull();
  });
});

describe('before and after', () => {
  it('marks lines added as new and lines lost as gone; equal lines stay as they were', () => {
    const before = [line('life_flat', 5, 27), line('fire_resist', 5, 12), line('mana_regen', 6, 1)];
    const after = [line('life_flat', 5, 27), line('fire_resist', 5, 14), line('frost_resist', 6, 9)];
    const d = diffLines(before, after);
    expect(d.before.map((r) => r.mark)).toEqual(['same', 'gone', 'gone']);
    expect(d.after.map((r) => r.mark)).toEqual(['same', 'new', 'new']);
  });

  it('pairs duplicate lines one for one', () => {
    const a = line('fire_resist', 5, 12);
    const d = diffLines([a, a], [a]);
    expect(d.before.map((r) => r.mark)).toEqual(['same', 'gone']);
    expect(d.after.map((r) => r.mark)).toEqual(['same']);
    expect(diffLines([], [a]).after[0]!.mark).toBe('new');
    expect(diffLines([a], []).before[0]!.mark).toBe('gone');
  });

  it('a snapshot is a copy: crafting later does not change it', () => {
    const s = newGame();
    const hero = s.state.hero;
    const it = give(hero, 'wool_hood', 'normal');
    giveCurrency(hero, { weavers_knot: 1 });
    const before = snapshotOf(hero, it.uid)!;
    expect(sendEdit(s, { kind: 'craft', currency: 'weavers_knot', uid: it.uid })).toBeNull();
    expect(before.rarity).toBe('normal');
    expect(before.lines).toEqual([]);
    expect(snapshotOf(hero, it.uid)!.rarity).toBe('magic');
    expect(snapshotOf(hero, 424242)).toBeNull();
  });
});

describe('the outcome line', () => {
  function craft(currency: CurrencyId, base: string, rarity: 'normal' | 'magic' | 'rare', affixes = [] as { id: string; tier: number; value: number }[]) {
    const s = newGame();
    const hero = s.state.hero;
    const it = give(hero, base, rarity, 9, affixes);
    giveCurrency(hero, { [currency]: 1 });
    const before = snapshotOf(hero, it.uid)!;
    expect(sendEdit(s, { kind: 'craft', currency, uid: it.uid })).toBeNull();
    const after = snapshotOf(hero, it.uid)!;
    return { before, after, text: outcomeText(currency, before, after), result: buildResult(1, currency, before, after) };
  }
  const two = [{ id: 'life_flat', tier: 5, value: 20 }, { id: 'fire_resist', tier: 5, value: 12 }];

  it('names the rarity change and the affix count', () => {
    const knot = craft('weavers_knot', 'wool_hood', 'normal');
    expect(knot.text).toBe(`Normal → Magic · ${knot.after.lines.length} affix${knot.after.lines.length === 1 ? '' : 'es'}`);
    expect(craft('loom_shuttle', 'travelers_cloak', 'normal').text).toMatch(/^Normal → Rare · \d affixes$/);
  });

  it('says what a reroll, an added affix and a removed affix did', () => {
    const chaos = craft('chaos_skein', 'travelers_cloak', 'rare', two);
    expect(chaos.text).toBe(`rerolled ${chaos.after.lines.length} affixes`);
    expect(craft('spool_of_change', 'bone_charm', 'magic', [two[0]!]).text).toMatch(/^rerolled \d affix(es)?$/);
    const needle = craft('golden_needle', 'travelers_cloak', 'rare', two);
    expect(needle.text).toBe('added 1 affix');
    expect(needle.result.diff.after.filter((r) => r.mark === 'new')).toHaveLength(1);
    expect(needle.result.diff.before.every((r) => r.mark === 'same')).toBe(true);
    const unpick = craft('unpick', 'travelers_cloak', 'rare', two);
    expect(unpick.text).toBe('removed 1 affix');
    expect(unpick.result.diff.before.filter((r) => r.mark === 'gone')).toHaveLength(1);
    expect(unpick.result.diff.after.every((r) => r.mark === 'same')).toBe(true);
  });

  it('reads Rune Polish as a quality change', () => {
    const s = newGame();
    const hero = s.state.hero;
    const r = giveRune(hero, 'fire', 3);
    giveCurrency(hero, { rune_polish: 1 });
    const before = snapshotOf(hero, r.uid)!;
    sendEdit(s, { kind: 'craft', currency: 'rune_polish', uid: r.uid });
    const after = snapshotOf(hero, r.uid)!;
    expect(outcomeText('rune_polish', before, after)).toBe('Quality 3% → 4%');
    expect(before.kind).toBe('rune');
  });
});
