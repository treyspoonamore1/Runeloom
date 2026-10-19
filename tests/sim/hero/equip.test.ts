import { describe, expect, it } from 'vitest';
import { applyHeroEdit, createGame, type GameState, type Item } from '../../../src/sim';
import { makeItem, makePart } from '../../../src/sim/items/items';
import type { AffixRoll } from '../../../src/sim/hero/types';
import { scrapValues } from '../../../data/loot';
import { adventure, OPEN_ROOM } from './helpers';

function give(
  state: GameState,
  base: string,
  affixes: AffixRoll[] = [],
  rarity: Item['rarity'] = 'magic',
): Item {
  const it = makeItem(state.hero, base, rarity, 5, affixes);
  state.hero.items.push(it);
  return it;
}

describe('equip and unequip', () => {
  it('puts items only in their slots; charms move between both charm slots', () => {
    const state = adventure();
    const cloak = give(state, 'travelers_cloak', [{ id: 'life_flat', tier: 3, value: 10 }]);
    expect(applyHeroEdit(state, { kind: 'equip', uid: cloak.uid, slot: 'hood' })).toMatch(/doesn't go/);
    expect(applyHeroEdit(state, { kind: 'equip', uid: cloak.uid, slot: 'cloak' })).toBeNull();
    expect(state.hero.equipped.cloak).toBe(cloak.uid);
    expect(state.player.maxLife).toBe(90);
    const a = give(state, 'bone_charm');
    const b = give(state, 'bone_charm');
    expect(applyHeroEdit(state, { kind: 'equip', uid: a.uid, slot: 'charm1' })).toBeNull();
    expect(applyHeroEdit(state, { kind: 'equip', uid: b.uid, slot: 'charm2' })).toBeNull();
    expect(applyHeroEdit(state, { kind: 'equip', uid: a.uid, slot: 'charm2' })).toBeNull();
    expect(state.hero.equipped.charm2).toBe(a.uid);
    expect(state.hero.equipped.charm1).toBe(b.uid);
    expect(applyHeroEdit(state, { kind: 'unequip', slot: 'cloak' })).toBeNull();
    expect(state.player.maxLife).toBe(80);
    expect(applyHeroEdit(state, { kind: 'unequip', slot: 'cloak' })).toMatch(/Nothing/);
    expect(applyHeroEdit(state, { kind: 'equip', uid: 999, slot: 'cloak' })).toMatch(/don't have/);
  });

  it('a spindle must stay equipped; equipping another switches the weaves to it', () => {
    const state = adventure();
    expect(applyHeroEdit(state, { kind: 'unequip', slot: 'spindle' })).toMatch(/must stay/);
    const ash = give(state, 'ashwood', [], 'normal');
    expect(applyHeroEdit(state, { kind: 'equip', uid: ash.uid, slot: 'spindle' })).toBeNull();
    expect(state.weaves.spindleId).toBe('ashwood');
    expect(state.weaves.slots[0]!.compiled!.costs!.capacity).toBe(10);
    // Its implicit (10% increased Fire damage) now reaches HeroMods.
    expect(state.heroMods.damageInc.fire).toBeCloseTo(0.1, 12);
    expect(state.weaves.slots[0]!.program).not.toBeNull();
  });

  it('equipment edits need adventure mode', () => {
    const state = createGame({ seed: 1, roomText: OPEN_ROOM });
    expect(applyHeroEdit(state, { kind: 'unequip', slot: 'cloak' })).toMatch(/adventure/);
  });
});

describe('salvage', () => {
  it('turns unequipped items and unfused parts into Thread Scrap', () => {
    const state = adventure();
    const hood = give(state, 'wool_hood');
    const part = makePart(state.hero, 'tinder_tooth', 2);
    state.hero.parts.push(part);
    expect(applyHeroEdit(state, { kind: 'salvage', uid: hood.uid })).toBeNull();
    expect(state.hero.threadScrap).toBe(scrapValues.item.magic);
    expect(applyHeroEdit(state, { kind: 'salvage', uid: part.uid })).toBeNull();
    expect(state.hero.threadScrap).toBe(scrapValues.item.magic + scrapValues.part[1]);
    expect(applyHeroEdit(state, { kind: 'salvage', uid: state.hero.equipped.spindle! })).toMatch(/Unequip/);
  });
});

describe('fuse and unfuse (DESIGN §8.4)', () => {
  it('fuses a part into an empty socket and lists it in HeroMods', () => {
    const state = adventure();
    const spindle = state.hero.equipped.spindle!;
    const p = makePart(state.hero, 'kiln_chitin', 1);
    const q = makePart(state.hero, 'rime_mote', 1);
    state.hero.parts.push(p, q);
    expect(applyHeroEdit(state, { kind: 'fuse', partUid: p.uid, spindleUid: spindle, socket: 1 })).toMatch(
      /no socket 2/,
    );
    expect(applyHeroEdit(state, { kind: 'fuse', partUid: p.uid, spindleUid: spindle, socket: 0 })).toBeNull();
    expect(state.hero.parts).toEqual([q]);
    expect(state.heroMods.parts).toEqual([{ part: 'kiln_chitin', tier: 1 }]);
    expect(applyHeroEdit(state, { kind: 'fuse', partUid: q.uid, spindleUid: spindle, socket: 0 })).toMatch(
      /taken/,
    );
    expect(applyHeroEdit(state, { kind: 'salvage', uid: p.uid })).toMatch(/don't have/);
  });

  it('unfusing destroys the part, or keeps it for 5 Thread Scrap', () => {
    const state = adventure();
    const spindle = state.hero.equipped.spindle!;
    const p = makePart(state.hero, 'shield_plate', 3);
    state.hero.parts.push(p);
    applyHeroEdit(state, { kind: 'fuse', partUid: p.uid, spindleUid: spindle, socket: 0 });
    state.hero.threadScrap = 4;
    expect(applyHeroEdit(state, { kind: 'unfuse', spindleUid: spindle, socket: 0, keep: true })).toMatch(
      /costs 5/,
    );
    state.hero.threadScrap = 7;
    expect(applyHeroEdit(state, { kind: 'unfuse', spindleUid: spindle, socket: 0, keep: true })).toBeNull();
    expect(state.hero.threadScrap).toBe(2);
    expect(state.hero.parts).toEqual([p]);
    expect(state.heroMods.parts).toEqual([]);
    applyHeroEdit(state, { kind: 'fuse', partUid: p.uid, spindleUid: spindle, socket: 0 });
    expect(applyHeroEdit(state, { kind: 'unfuse', spindleUid: spindle, socket: 0, keep: false })).toBeNull();
    expect(state.hero.parts).toEqual([]);
    expect(state.hero.threadScrap).toBe(2);
    expect(applyHeroEdit(state, { kind: 'unfuse', spindleUid: spindle, socket: 0, keep: false })).toMatch(
      /empty/,
    );
  });

  it("a spindle with fused parts can't be salvaged", () => {
    const state = adventure();
    const ash = give(state, 'ashwood', [], 'normal');
    const p = makePart(state.hero, 'tar_gland', 1);
    state.hero.parts.push(p);
    applyHeroEdit(state, { kind: 'fuse', partUid: p.uid, spindleUid: ash.uid, socket: 0 });
    expect(applyHeroEdit(state, { kind: 'salvage', uid: ash.uid })).toMatch(/fused parts/);
  });
});
