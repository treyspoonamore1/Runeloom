/**
 * Fixture characters for the menus until the hero/items agent's code lands: a mid-Emberwood
 * hero with gear, runes, parts and a few passives (screenshots, dev), and the CONTENT §9.1
 * new-game hero. Plain HeroState data held outside the sim (see store.ts).
 */
import type { RuneId } from '../../../data/runes';
import { createHero } from '../../sim/hero/hero';
import { litFixtureHearth } from './hearth';
import type { AffixRoll, FusePart, HeroState, Item, ItemRarity, RuneItem } from '../../sim/hero/types';

function builder() {
  const hero = createHero();
  const uid = () => hero.nextUid++;
  const rune = (id: RuneId, level = 1): RuneItem => {
    const r: RuneItem = { uid: uid(), rune: id, level, xp: 0, quality: 0 };
    hero.runes.push(r);
    if (!hero.unlockedRunes.includes(id)) hero.unlockedRunes.push(id);
    return r;
  };
  const item = (
    base: string,
    rarity: ItemRarity,
    itemLevel: number,
    affixes: AffixRoll[],
    sockets = 0,
  ): Item => {
    const it: Item = {
      uid: uid(),
      base,
      rarity,
      itemLevel,
      affixes,
      fused: Array.from({ length: sockets }, () => null),
    };
    hero.items.push(it);
    return it;
  };
  const part = (id: string, tier: 1 | 2 | 3): FusePart => {
    const p: FusePart = { uid: uid(), part: id, tier };
    hero.parts.push(p);
    return p;
  };
  return { hero, rune, item, part, uid };
}

const a = (id: string, value: number, tier = 2): AffixRoll => ({ id, tier, value });

/** About an hour in: level 6, at Shield Road. */
export function demoHero(): HeroState {
  const { hero, rune, item, part, uid } = builder();
  hero.level = 6;
  hero.xp = 1260;
  for (const [id, lv] of [
    ['cast', 4],
    ['cast', 2],
    ['cast', 1],
    ['pulse', 1],
    ['bolt', 5],
    ['strike', 3],
    ['swath', 2],
    ['lob', 2],
    ['nova', 1],
    ['fire', 5],
    ['fire', 2],
    ['fire', 1],
    ['split', 2],
    ['wide', 1],
    ['heavy', 1],
    ['pierce', 1],
    ['keen', 1],
    ['on_expire', 1],
  ] as Array<[RuneId, number]>)
    rune(id, lv);
  const spindle = item('ashwood', 'magic', 5, [a('fire_dmg', 14), a('cast_speed', 6, 3)], 1);
  spindle.fused[0] = { uid: uid(), part: 'tinder_tooth', tier: 1 };
  const cloak = item('travelers_cloak', 'magic', 4, [a('life', 18), a('fire_res', 12)]);
  const hood = item('linen_hood', 'normal', 2, []);
  const boots = item('leather_boots', 'magic', 5, [a('move_speed', 8), a('frost_res', 10)]);
  const charm = item('ember_charm', 'magic', 3, [a('elemental_dmg', 6)]);
  hero.equipped = {
    spindle: spindle.uid,
    cloak: cloak.uid,
    hood: hood.uid,
    boots: boots.uid,
    charm1: charm.uid,
    charm2: null,
  };
  item('twig', 'normal', 1, [], 1);
  item('ironbark', 'magic', 6, [a('strike_flat', 6), a('crit', 2)], 1);
  item('wool_cloak', 'magic', 5, [a('life', 26), a('storm_res', 14)]);
  item('reed_boots', 'normal', 3, []);
  item('river_charm', 'magic', 5, [a('life', 9), a('frost_res', 16)]);
  item('linen_hood', 'magic', 4, [a('mana', 14), a('ailment_duration', 10)]);
  part('ember_feather', 1);
  part('kiln_chitin', 2);
  part('shield_plate', 1);
  hero.passives = ['weaver_0', 'ember_1', 'ember_2', 'weaver_2'];
  hero.heartSeeds = 2;
  hero.loomShards = 1;
  hero.threadScrap = 7;
  hero.unlockedRunes.sort();
  litFixtureHearth(hero);
  return hero;
}

/** CONTENT §9.1: Twig Spindle and Cast, Bolt, Strike, Fire (two Casts: both starting weaves use one). */
export function newGameHero(): HeroState {
  const { hero, rune, item } = builder();
  for (const id of ['cast', 'cast', 'bolt', 'strike', 'fire'] as RuneId[]) rune(id);
  const twig = item('twig', 'normal', 1, [], 1);
  hero.equipped.spindle = twig.uid;
  hero.unlockedRunes.sort();
  return hero;
}
