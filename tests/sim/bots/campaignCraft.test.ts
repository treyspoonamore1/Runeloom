import { describe, expect, it } from 'vitest';
import { applyHeroEdit } from '../../../src/sim';
import { craftEquipped, craftNewItems, polishMainRune } from '../../../src/sim/bots/campaignCraft';
import { makeItem } from '../../../src/sim/items/items';
import { adventure } from '../hero/helpers';

/** The campaign bot's crafting habit (bots/campaignCraft.ts). */

describe('campaign bot crafting', () => {
  it('shuttles the best Normal item of a slot with no Rare, and leaves Rare slots alone', () => {
    const s = adventure();
    const hood = makeItem(s.hero, 'wool_hood', 'normal', 9);
    const cloak = makeItem(s.hero, 'travelers_cloak', 'rare', 9, [{ id: 'life_flat', tier: 1, value: 20 }]);
    const spare = makeItem(s.hero, 'travelers_cloak', 'normal', 9);
    s.hero.items.push(hood, cloak, spare);
    applyHeroEdit(s, { kind: 'equip', uid: cloak.uid, slot: 'cloak' });
    s.hero.currency = { loom_shuttle: 2 };
    const log = craftNewItems(s);
    expect(hood.rarity).toBe('rare');
    expect(spare.rarity).toBe('normal');
    expect(log.some((l) => l.startsWith('loom_shuttle'))).toBe(true);
  });

  it('chaoses a weak equipped Rare, needles it, and spools a one-affix Magic item', () => {
    const s = adventure();
    const hood = makeItem(s.hero, 'wool_hood', 'rare', 9, [{ id: 'mana_flat', tier: 3, value: 5 }]);
    const boots = makeItem(s.hero, 'leather_boots', 'magic', 9, [{ id: 'move_speed', tier: 3, value: 4 }]);
    s.hero.items.push(hood, boots);
    applyHeroEdit(s, { kind: 'equip', uid: hood.uid, slot: 'hood' });
    applyHeroEdit(s, { kind: 'equip', uid: boots.uid, slot: 'boots' });
    s.hero.currency = { chaos_skein: 1, spool_of_change: 1 };
    const log = craftEquipped(s);
    expect(log.map((l) => l.split('→')[0])).toEqual(['chaos_skein', 'spool_of_change']);
    expect(hood.affixes.length).toBeGreaterThanOrEqual(4);
    expect(s.hero.currency).toEqual({});
  });

  it('needles an equipped Rare until it is full or the Needles run out', () => {
    const s = adventure();
    const sp = makeItem(s.hero, 'ashwood', 'rare', 9, [
      { id: 'fire_damage', tier: 2, value: 12 },
      { id: 'frost_damage', tier: 2, value: 12 },
      { id: 'cast_speed', tier: 2, value: 8 },
      { id: 'crit_chance', tier: 2, value: 2 },
    ]);
    sp.fused = [null];
    s.hero.items.push(sp);
    applyHeroEdit(s, { kind: 'equip', uid: sp.uid, slot: 'spindle' });
    s.hero.currency = { golden_needle: 5 };
    craftEquipped(s);
    expect(sp.affixes).toHaveLength(6);
    expect(s.hero.currency.golden_needle).toBe(3);
  });

  it("polishes the LMB weave's form rune up to 20%", () => {
    const s = adventure();
    s.hero.currency = { rune_polish: 25 };
    polishMainRune(s);
    const bolt = s.hero.runes.find((r) => r.uid === s.weaves.slots[0]!.runes![1])!;
    expect(bolt.rune).toBe('bolt');
    expect(bolt.quality).toBe(20);
    expect(s.hero.currency.rune_polish).toBe(5);
  });
});
