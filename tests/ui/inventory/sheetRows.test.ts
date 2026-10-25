import { describe, expect, it } from 'vitest';
import { cloneTuning } from '../../../data/tuning';
import { demoHero } from '../../../src/ui/fixtures/hero';
import { fixtureMods } from '../../../src/ui/fixtures/mods';
import { fixtureTree } from '../../../src/ui/fixtures/tree';
import { sheetRows, statRows, withEquipped } from '../../../src/ui/inventory/stats';
import type { HeroState } from '../../../src/sim/hero/types';

const tuning = cloneTuning();
const tree = fixtureTree(20);
const modsFor = (h: Readonly<HeroState>) => fixtureMods(h, tree);
const item = (h: HeroState, base: string) =>
  h.items.find((i) => i.base === base && !Object.values(h.equipped).includes(i.uid))!;

function preview(h: HeroState, base: string, slot: 'cloak' | 'spindle' | 'charm2') {
  const after = withEquipped(h, item(h, base), slot);
  return { hero: after, mods: modsFor(after) };
}

describe('character sheet while an item is hovered', () => {
  it('is the plain sheet without a preview', () => {
    const h = demoHero();
    expect(sheetRows(h, modsFor(h), tuning)).toEqual(statRows(h, modsFor(h), tuning));
    expect(sheetRows(h, modsFor(h), tuning, null).some((r) => 'delta' in r)).toBe(false);
  });

  it('puts each stat change on its own row, green for better and red for worse', () => {
    const h = demoHero();
    const rows = sheetRows(h, modsFor(h), tuning, preview(h, 'wool_cloak', 'cloak'));
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(by.life!.delta).toMatchObject({ text: '+8', good: true, from: '174', to: '182' });
    expect(by.fireRes!.delta).toMatchObject({ text: '−12%', good: false });
    expect(by.stormRes!.delta).toMatchObject({ text: '+14%', good: true });
    // Rows the item doesn't touch carry no change.
    expect(by.mana!.delta).toBeUndefined();
    // The same rows as the plain sheet, in the same order.
    expect(rows.map((r) => r.key)).toEqual(statRows(h, modsFor(h), tuning).map((r) => r.key));
  });

  it('uses the same deltas as the tooltip comparison (diffStats)', async () => {
    const { compareItem } = await import('../../../src/ui/inventory/stats');
    const h = demoHero();
    const cmp = compareItem(h, item(h, 'wool_cloak'), ['cloak'], modsFor, tuning)!;
    const rows = sheetRows(h, modsFor(h), tuning, preview(h, 'wool_cloak', 'cloak'));
    expect(rows.flatMap((r) => (r.delta ? [r.delta] : []))).toEqual(cmp.deltas);
  });

  it('adds a row that only exists once the item is worn, in its place in the sheet', () => {
    const h = demoHero();
    const plain = statRows(h, modsFor(h), tuning);
    expect(plain.some((r) => r.key === 'crit')).toBe(false);
    const rows = sheetRows(h, modsFor(h), tuning, preview(h, 'ironbark', 'spindle'));
    const crit = rows.find((r) => r.key === 'crit')!;
    expect(crit).toMatchObject({ ghost: true, text: '–' });
    expect(crit.delta).toMatchObject({ text: '+2%', good: true });
    const keys = rows.map((r) => r.key);
    expect(keys.indexOf('crit')).toBeGreaterThan(keys.indexOf('stormInc'));
    expect(keys.indexOf('crit')).toBeLessThan(keys.indexOf('capacity'));
  });

  it('keeps a row that disappears once the item is worn, with its loss', () => {
    const h = demoHero();
    // Take the worn charm off: its Elemental damage rows vanish from the sheet.
    const none = { ...h, equipped: { ...h.equipped, charm1: null } } as HeroState;
    const rows = sheetRows(h, modsFor(h), tuning, { hero: none, mods: modsFor(none) });
    const lost = rows.filter((r) => r.delta && !r.delta.good);
    expect(lost.length).toBeGreaterThan(0);
    expect(rows.find((r) => r.key === 'fireInc')!.delta).toMatchObject({ good: false });
  });
});
