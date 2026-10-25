import { describe, expect, it } from 'vitest';
import { currencyIds } from '../../data/currency';
import { fuseParts } from '../../data/fuseParts';
import { gearBases } from '../../data/items';
import { spindles } from '../../data/spindles';
import { uniques } from '../../data/uniques';
import { LOOT } from '../../src/render/world/worldPalette';
import {
  guessKind,
  resolveCurrencyArt,
  resolveItemArt,
  resolvePartArt,
} from '../../src/ui/items/art/resolve';
import { CurrencyArt, ItemArt, PartArt } from '../../src/ui/items/itemArt';
import { RARITY_RIM } from '../../src/ui/items/itemArtStyle';
import { menuCss } from '../../src/ui/menus/menuStyle';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

describe('item art', () => {
  it('draws every spindle and gear base with its own shape', () => {
    const shapes = new Set<unknown>();
    for (const base of [...Object.keys(spindles), ...Object.keys(gearBases)]) {
      const art = resolveItemArt({ base });
      expect(art.from, base).toBe('base');
      shapes.add(art.shape);
      expect(() => art.shape()).not.toThrow();
    }
    expect(shapes.size).toBe(Object.keys(spindles).length + Object.keys(gearBases).length);
  });

  it('draws every unique with its own shape, not its base', () => {
    for (const u of Object.values(uniques)) {
      const art = resolveItemArt({ base: u.base, unique: u.id });
      expect(art.from, u.id).toBe('unique');
      expect(art.shape).not.toBe(resolveItemArt({ base: u.base }).shape);
      expect(() => art.shape()).not.toThrow();
    }
  });

  it('draws every currency in its floor-drop color', () => {
    const shapes = new Set<unknown>();
    for (const id of currencyIds) {
      const art = resolveCurrencyArt(id, LOOT.currency);
      expect(art.from, id).toBe('base');
      expect(art.color).toBe(hex(LOOT.currency[id]));
      shapes.add(art.shape);
    }
    expect(shapes.size).toBe(currencyIds.length);
  });

  it('draws every Fuse part with its own shape', () => {
    const shapes = new Set<unknown>();
    for (const id of Object.keys(fuseParts)) {
      const art = resolvePartArt(id);
      expect(art.from, id).toBe('base');
      shapes.add(art.shape);
    }
    expect(shapes.size).toBe(Object.keys(fuseParts).length);
  });

  it('falls back by kind, then to a generic picture, without throwing', () => {
    expect(resolveItemArt({ base: 'wool_cloak' }).from).toBe('kind');
    expect(guessKind('wool_cloak')).toBe('cloak');
    expect(guessKind('iron_boot')).toBe('boots');
    expect(resolveItemArt({ base: 'nothing_known' }).from).toBe('unknown');
    expect(resolveItemArt({ base: 'twig', unique: 'not_a_unique' }).from).toBe('base');
    expect(resolveItemArt({}).from).toBe('unknown');
    expect(resolvePartArt('no_part').from).toBe('unknown');
    expect(resolveCurrencyArt('no_currency', LOOT.currency).from).toBe('unknown');
    expect(() => ItemArt({ item: { base: 'nothing_known', rarity: 'rare' } })).not.toThrow();
    expect(() => PartArt({ part: 'no_part', tier: 3 })).not.toThrow();
    expect(() => CurrencyArt({ currency: 'no_currency' as never })).not.toThrow();
    expect(() => resolveItemArt({ base: 'nothing_known' }).shape()).not.toThrow();
  });

  it('marks part tiers with that many pips', () => {
    const pips = (tier: 1 | 2 | 3) => {
      const frame = PartArt({ part: 'tinder_tooth', tier }) as unknown as {
        props: { children: unknown };
      };
      // Frame is a component: render it one level to reach the pips.
      const inner = (frame as unknown as { type: (p: unknown) => { props: { children: unknown[] } } }).type(
        frame.props,
      );
      const tierEl = inner.props.children[1] as { props: { children: unknown[] } };
      return tierEl.props.children.length;
    };
    expect([pips(1), pips(2), pips(3)]).toEqual([1, 2, 3]);
  });

  it('frames use the menus’ rarity colors', () => {
    for (const [r, color] of Object.entries(RARITY_RIM))
      expect(menuCss, r).toContain(`.r-${r} { --rar: ${color}; }`);
  });
});

describe('loot toasts carry their art', () => {
  it('item, part and currency toasts name what to draw', async () => {
    const { toastsFor, HUD_EVENT } = await import('../../src/ui/adventure/hudEvents');
    const names = {
      rune: (id: string) => id,
      item: () => ({ name: 'Pyre Hood', rarity: 'unique' as const }),
      part: () => 'Rime Mote III',
    };
    const t = toastsFor(
      [
        {
          type: HUD_EVENT.lootPicked,
          content: { kind: 'item', item: { base: 'wool_hood', rarity: 'unique', unique: 'pyre_hood' } },
        },
        {
          type: HUD_EVENT.lootPicked,
          content: { kind: 'part', part: { uid: 1, part: 'rime_mote', tier: 3 } },
        },
        { type: HUD_EVENT.lootPicked, content: { kind: 'currency', currency: 'golden_needle', amount: 2 } },
        { type: HUD_EVENT.lootPicked, content: { kind: 'scrap', amount: 2 } },
      ],
      names,
    );
    expect(t.map((x) => x.art)).toEqual([
      { kind: 'item', base: 'wool_hood', rarity: 'unique', unique: 'pyre_hood' },
      { kind: 'part', part: 'rime_mote', tier: 3 },
      { kind: 'currency', currency: 'golden_needle' },
      undefined,
    ]);
  });
});
