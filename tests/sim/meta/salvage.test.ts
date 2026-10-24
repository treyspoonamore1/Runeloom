/** M7: the Salvage Loom salvages picked-up gear up to its setting and level, never uniques. */
import { describe, expect, it } from 'vitest';
import { scrapValues } from '../../../data/loot';
import { dropLoot, grantContent, NEUTRAL_INPUT, step, type GameState } from '../../../src/sim';
import { makeItem } from '../../../src/sim/items/items';
import { makeUnique } from '../../../src/sim/items/uniqueItems';
import { salvageReach } from '../../../src/sim/meta/salvage';
import { salvageMult } from '../../../src/sim/meta/view';
import type { ItemRarity } from '../../../src/sim/hero/types';
import { build, hub, ok } from './helpers';

function loom(level: number, setting: 'off' | 'normal' | 'magic' | 'rare'): GameState {
  const s = hub();
  build(s, { salvage_loom: level });
  ok(s, { kind: 'salvageSetting', setting });
  return s;
}

/** Picks up an item of `rarity` by walking over it; true when it was salvaged. */
function pickUp(s: GameState, rarity: ItemRarity): boolean {
  const item =
    rarity === 'unique' ? makeUnique(s.hero, 'pyre_hood', 5) : makeItem(s.hero, 'travelers_cloak', rarity, 5);
  dropLoot(s, s.player.x, s.player.y, { kind: 'item', item });
  const scrap = s.hero.threadScrap;
  for (let i = 0; i < 40; i++) step(s, NEUTRAL_INPUT);
  expect(s.loot).toEqual([]);
  const salvaged = !s.hero.items.some((it) => it.uid === item.uid);
  if (salvaged)
    expect(s.hero.threadScrap - scrap).toBe(
      Math.round(scrapValues.item[rarity] * salvageMult(s.hero.hearth.buildings.salvage_loom)),
    );
  else expect(s.hero.threadScrap).toBe(scrap);
  return salvaged;
}

describe('the Salvage Loom', () => {
  it('salvages up to its setting: normal at level 1, magic from 4, rare from 8', () => {
    const one = loom(1, 'normal');
    expect([pickUp(one, 'normal'), pickUp(one, 'magic'), pickUp(one, 'rare')]).toEqual([true, false, false]);
    const four = loom(4, 'magic');
    expect([pickUp(four, 'normal'), pickUp(four, 'magic'), pickUp(four, 'rare')]).toEqual([
      true,
      true,
      false,
    ]);
    const eight = loom(8, 'rare');
    expect([pickUp(eight, 'normal'), pickUp(eight, 'magic'), pickUp(eight, 'rare')]).toEqual([
      true,
      true,
      true,
    ]);
    const low = loom(8, 'normal');
    expect(pickUp(low, 'magic')).toBe(false);
  });

  it('is capped by its level even when the setting says more', () => {
    const s = loom(8, 'rare');
    build(s, { salvage_loom: 4 });
    expect(salvageReach(s)).toBe('magic');
    expect(pickUp(s, 'rare')).toBe(false);
    expect(pickUp(s, 'magic')).toBe(true);
  });

  it('never takes uniques, and does nothing when off', () => {
    expect(pickUp(loom(10, 'rare'), 'unique')).toBe(false);
    expect(pickUp(loom(10, 'off'), 'normal')).toBe(false);
  });

  it('sends autoSalvaged; grantContent (expedition rewards) goes through it too', () => {
    const s = loom(4, 'magic');
    const item = makeItem(s.hero, 'wool_hood', 'magic', 3);
    grantContent(s, { kind: 'item', item }, { x: 10, y: 20 });
    expect(s.hero.items.some((it) => it.uid === item.uid)).toBe(false);
    expect(s.events).toContainEqual({
      type: 'autoSalvaged',
      base: 'wool_hood',
      rarity: 'magic',
      scrap: 3,
      x: 10,
      y: 20,
    });
  });
});
