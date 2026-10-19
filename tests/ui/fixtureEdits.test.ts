import { beforeEach, describe, expect, it } from 'vitest';
import { demoHero } from '../../src/ui/fixtures/hero';
import { fixtureApply, fixtureHero, setFixtureHero } from '../../src/ui/fixtures/store';

/** The fixture stand-in for applyHeroEdit follows the contract rules the menus rely on. */
describe('fixture hero edits', () => {
  beforeEach(() => setFixtureHero(demoHero()));
  const h = () => fixtureHero();
  const uidOf = (base: string) =>
    h().items.find((i) => i.base === base && !Object.values(h().equipped).includes(i.uid))!.uid;

  it('equips into a fitting slot only, and swaps charms between charm slots', () => {
    expect(fixtureApply({ kind: 'equip', uid: uidOf('wool_cloak'), slot: 'hood' })).toBe(
      "It doesn't go in that slot",
    );
    const cloak = uidOf('wool_cloak');
    expect(fixtureApply({ kind: 'equip', uid: cloak, slot: 'cloak' })).toBeNull();
    expect(h().equipped.cloak).toBe(cloak);
    const c1 = h().equipped.charm1!;
    expect(fixtureApply({ kind: 'equip', uid: c1, slot: 'charm2' })).toBeNull();
    expect(h().equipped).toMatchObject({ charm1: null, charm2: c1 });
  });

  it('never leaves the spindle slot empty', () => {
    expect(fixtureApply({ kind: 'unequip', slot: 'spindle' })).toMatch(/always equipped/);
    expect(fixtureApply({ kind: 'unequip', slot: 'cloak' })).toBeNull();
    expect(h().equipped.cloak).toBeNull();
  });

  it('salvages unequipped items and parts for Thread Scrap', () => {
    const scrap = h().threadScrap;
    expect(fixtureApply({ kind: 'salvage', uid: h().equipped.boots! })).toBe('Unequip it first');
    expect(fixtureApply({ kind: 'salvage', uid: uidOf('river_charm') })).toBeNull();
    expect(h().threadScrap).toBe(scrap + 2);
    const part = h().parts[0]!;
    expect(fixtureApply({ kind: 'salvage', uid: part.uid })).toBeNull();
    expect(h().parts).not.toContain(part);
  });

  it('fuses into an empty socket; unfusing keeps the part only for 5 Thread Scrap', () => {
    const sp = h().items.find((i) => i.uid === h().equipped.spindle)!;
    const part = h().parts[0]!;
    expect(fixtureApply({ kind: 'fuse', partUid: part.uid, spindleUid: sp.uid, socket: 0 })).toMatch(/taken/);
    h().threadScrap = 4;
    expect(fixtureApply({ kind: 'unfuse', spindleUid: sp.uid, socket: 0, keep: true })).toBe(
      'Needs 5 Thread Scrap',
    );
    h().threadScrap = 7;
    const fused = sp.fused[0]!;
    expect(fixtureApply({ kind: 'unfuse', spindleUid: sp.uid, socket: 0, keep: true })).toBeNull();
    expect(h().threadScrap).toBe(2);
    expect(h().parts).toContain(fused);
    expect(fixtureApply({ kind: 'fuse', partUid: part.uid, spindleUid: sp.uid, socket: 0 })).toBeNull();
    expect(fixtureApply({ kind: 'unfuse', spindleUid: sp.uid, socket: 0, keep: false })).toBeNull();
    expect(h().parts).not.toContain(part);
    expect(sp.fused[0]).toBeNull();
  });

  it('allocates and refunds passives through the tree rules', () => {
    expect(fixtureApply({ kind: 'allocate', node: 'rime_1' })).toBe('Not connected to your Pattern');
    expect(fixtureApply({ kind: 'allocate', node: 'weaver_1' })).toBeNull();
    expect(fixtureApply({ kind: 'allocate', node: 'rime_1' })).toBe('No passive points left');
    expect(fixtureApply({ kind: 'refund', node: 'ember_1' })).toBe('Other nodes depend on it');
    expect(fixtureApply({ kind: 'refund', node: 'ember_2' })).toBeNull();
    expect(h().passives).not.toContain('ember_2');
  });
});
