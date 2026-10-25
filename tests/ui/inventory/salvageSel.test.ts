import { describe, expect, it } from 'vitest';
import { createHero } from '../../../src/sim/hero/hero';
import type { HeroState, Item, ItemRarity } from '../../../src/sim/hero/types';
import {
  protectedReason,
  quickSalvageNeedsConfirm,
  salvageCandidates,
  summarizePresets,
} from '../../../src/ui/inventory/salvageSel';

function bag(): HeroState {
  const hero = createHero();
  let uid = 1;
  const add = (rarity: ItemRarity, extra: Partial<Item> = {}): Item => {
    const it: Item = {
      uid: uid++,
      base: 'travelers_cloak',
      rarity,
      itemLevel: 5,
      affixes: [],
      fused: [],
      ...extra,
    };
    hero.items.push(it);
    return it;
  };
  add('normal'); // 1
  add('normal'); // 2
  add('magic'); // 3
  add('magic'); // 4
  add('rare'); // 5
  add('unique', { unique: 'pyre_hood' }); // 6
  add('normal', { locked: true }); // 7 kept
  add('magic', { locked: true }); // 8 kept
  add('normal'); // 9 worn
  hero.equipped.cloak = 9;
  add('normal', { base: 'twig', fused: [{ uid: 50, part: 'ember_feather', tier: 1 }] }); // 10 fused
  add('magic', { base: 'ashwood', fused: [null] }); // 11 empty socket
  return hero;
}
const uids = (l: Item[]) => l.map((i) => i.uid);
const hideMagic = (it: Item) => it.rarity === 'magic';

describe('bulk salvage selection', () => {
  it('"all Normal" takes plain items, not worn, kept or fused ones', () => {
    expect(uids(salvageCandidates(bag(), 'normal', () => false))).toEqual([1, 2]);
  });

  it('"all Normal and Magic" adds Magic items, never Rare or Unique', () => {
    expect(uids(salvageCandidates(bag(), 'normalMagic', () => false))).toEqual([1, 2, 3, 4, 11]);
  });

  it('"hidden" takes what the loot filter hides, with the same protections', () => {
    expect(uids(salvageCandidates(bag(), 'hidden', hideMagic))).toEqual([3, 4, 11]);
    // Even a filter that hides everything leaves worn, kept, unique and fused items.
    expect(uids(salvageCandidates(bag(), 'hidden', () => true))).toEqual([1, 2, 3, 4, 5, 11]);
  });

  it('never selects a protected item in any preset', () => {
    const hero = bag();
    for (const preset of ['normal', 'normalMagic', 'hidden'] as const)
      for (const it of salvageCandidates(hero, preset, () => true)) {
        expect(protectedReason(hero, it), `${preset} #${it.uid}`).toBeNull();
        expect(it.locked).toBeUndefined();
        expect(it.rarity).not.toBe('unique');
        expect(Object.values(hero.equipped)).not.toContain(it.uid);
        expect(it.fused.every((f) => f === null)).toBe(true);
      }
  });

  it('a unique-by-key item with another rarity label is still protected', () => {
    const hero = bag();
    hero.items[0]!.unique = 'pyre_hood';
    expect(protectedReason(hero, hero.items[0]!)).toBe('unique');
  });

  it('names why an item is protected', () => {
    const hero = bag();
    const by = (n: number) =>
      protectedReason(
        hero,
        hero.items.find((i) => i.uid === n)!,
      );
    expect([by(9), by(7), by(6), by(10), by(1)]).toEqual([
      'equipped',
      'kept',
      'unique',
      'has fused parts',
      null,
    ]);
  });

  it('sums the Scrap per preset and lists the uids', () => {
    const value = (it: Item) => ({ normal: 1, magic: 2, rare: 4, unique: 6 })[it.rarity];
    const s = summarizePresets(bag(), hideMagic, value);
    expect(s.map((x) => [x.preset, x.uids, x.scrap])).toEqual([
      ['normal', [1, 2], 2],
      ['normalMagic', [1, 2, 3, 4, 11], 2 + 6],
      ['hidden', [3, 4, 11], 6],
    ]);
  });

  it('asks before salvaging a Rare or Unique with shift-click, not a Normal or Magic', () => {
    const mk = (rarity: ItemRarity) => ({ rarity }) as Item;
    expect(
      ['normal', 'magic', 'rare', 'unique'].map((r) => quickSalvageNeedsConfirm(mk(r as ItemRarity))),
    ).toEqual([false, false, true, true]);
  });
});
