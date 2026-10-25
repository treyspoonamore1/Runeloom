/**
 * Fixture Hearth for the menus' screenshots (`?fixture=1`): a lit Hearth on the fixture hero.
 * The session stand-in and the edit applier are in hearthStore.ts.
 */
import { createHearth } from '../../sim/meta/hearth';
import type { HeroState } from '../../sim/hero/types';
import { makeSigil } from '../../sim/items/sigils';

/** Makes `hero`'s Hearth the lit, mid-game one the shots show. */
export function litFixtureHearth(hero: HeroState): void {
  const h = createHearth();
  h.lit = true;
  h.embers = 1800;
  h.embersSpent = 24000;
  h.buildings = { kindling_pit: 6, rune_garden: 5, expedition_board: 7, salvage_loom: 5 };
  const planted = ['bolt', 'fire'].map((id) => hero.runes.find((r) => r.rune === id)).filter((r) => !!r);
  h.garden = planted.map((r) => r!.uid);
  planted.forEach((r, i) => (r!.xp = [740, 1180][i] ?? 0));
  h.expeditions = [
    { uid: hero.nextUid++, tier: 3, left: 412, duration: 585, cycle: 1 },
    { uid: hero.nextUid++, tier: 2, left: 0, duration: 510, cycle: 0 }, // sent before the Rekindle
  ];
  h.salvage = 'normal';
  h.rekindles = 1;
  h.ash = 3;
  h.mutations = { bright_hearth: 3, shatterpoint: 1 };
  h.playSeconds = 9 * 3600;
  hero.hearth = h;
  hero.riftTier = 9;
  hero.threadScrap = 148;
  hero.currency = {
    weavers_knot: 4,
    spool_of_change: 7,
    loom_shuttle: 2,
    chaos_skein: 1,
    unpick: 1,
    rune_polish: 3,
  };
  for (const [tier, mods] of [
    [4, ['hardened']],
    [6, ['brutal', 'drought']],
  ] as const)
    hero.sigils.push(makeSigil(hero, tier, [...mods]));
}
