import { describe, expect, it } from 'vitest';
import { cloneTuning } from '../../data/tuning';
import { demoHero } from '../../src/ui/fixtures/hero';
import { fixtureMods } from '../../src/ui/fixtures/mods';
import { fixtureTree } from '../../src/ui/fixtures/tree';
import { compareItem, diffStats, statRows, targetSlot, withEquipped } from '../../src/ui/inventory/stats';
import type { HeroState } from '../../src/sim/hero/types';

const tuning = cloneTuning();
const tree = fixtureTree(20);
const modsFor = (h: Readonly<HeroState>) => fixtureMods(h, tree);
const item = (h: HeroState, base: string) =>
  h.items.find((i) => i.base === base && !Object.values(h.equipped).includes(i.uid))!;

describe('character sheet rows', () => {
  it('adds level, Heart Seeds and gear into life, and caps resistances', () => {
    const h = demoHero();
    const rows = statRows(h, modsFor(h), tuning);
    const life = rows.find((r) => r.key === 'life')!;
    // 80 + 12 × 5 levels + 18 (cloak) + 2 × 8 (Heart Seeds)
    expect(life.value).toBe(80 + 60 + 18 + 16);
    const m = modsFor(h);
    m.resistAdd.fire = 0.9;
    const fire = statRows(h, m, tuning).find((r) => r.key === 'fireRes')!;
    expect(fire.value).toBe(0.75);
    expect(fire.text).toBe('75% (90%)');
  });

  it('reads Capacity from the equipped spindle plus Loom Shards', () => {
    const h = demoHero();
    expect(statRows(h, modsFor(h), tuning).find((r) => r.key === 'capacity')!.value).toBe(10 + 1);
  });
});

describe('item comparison', () => {
  it('shows what equipping changes, better and worse', () => {
    const h = demoHero();
    const cloak = item(h, 'wool_cloak'); // +26 life, +14% Storm res vs equipped +18 life, +12% Fire res
    const cmp = compareItem(h, cloak, ['cloak'], modsFor, tuning)!;
    expect(cmp.slot).toBe('cloak');
    expect(cmp.current?.base).toBe('travelers_cloak');
    const by = Object.fromEntries(cmp.deltas.map((d) => [d.label, d]));
    expect(by['Maximum life']).toMatchObject({ text: '+8', good: true });
    expect(by['Fire resistance']).toMatchObject({ text: '−12%', good: false });
    expect(by['Storm resistance']).toMatchObject({ text: '+14%', good: true });
  });

  it('compares a spindle by its implicit, affixes and cast speed', () => {
    const h = demoHero();
    const iron = item(h, 'ironbark');
    const labels = compareItem(h, iron, ['spindle'], modsFor, tuning)!.deltas.map(
      (d) => `${d.text} ${d.label}`,
    );
    expect(labels).toContain('+2% Added crit chance');
    expect(labels).toContain('+18 Strike base damage');
    expect(labels).toContain('−24% Increased Fire damage');
    expect(labels.some((l) => l.endsWith('Cast speed') && l.startsWith('−'))).toBe(true);
  });

  it('puts a charm in the empty charm slot, and returns null for equipped items', () => {
    const h = demoHero();
    expect(targetSlot(h, ['charm1', 'charm2'])).toBe('charm2');
    const worn = h.items.find((i) => i.uid === h.equipped.cloak)!;
    expect(compareItem(h, worn, ['cloak'], modsFor, tuning)).toBeNull();
  });

  it('never changes the hero it compares against', () => {
    const h = demoHero();
    const before = JSON.stringify(h);
    withEquipped(h, item(h, 'wool_cloak'), 'cloak');
    compareItem(h, item(h, 'river_charm'), ['charm1', 'charm2'], modsFor, tuning);
    expect(JSON.stringify(h)).toBe(before);
  });

  it('diffs rows missing on one side as 0', () => {
    const a = [
      { key: 'x', group: 'Offense' as const, label: 'X', value: 0.1, text: '10%', higherIsBetter: true },
    ];
    expect(diffStats(a, [])).toEqual([{ label: 'X', text: '−10%', good: false }]);
    expect(diffStats([], a)).toEqual([{ label: 'X', text: '+10%', good: true }]);
  });
});
