/**
 * The menus' one door to the character (shared by the HUD, inventory, Fuse, tree and map):
 * src/app/hero.ts getHero, getHeroMods, heroModsOf (a hypothetical hero's mods, for "if you
 * equip this" comparisons) and sendHeroEdit (recorded, so replays reproduce it). With
 * `?fixture=1` (screenshots) a fixture hero and fixture edits stand in.
 */
import { signal } from '@preact/signals';
import { getHero, getHeroMods, heroModsOf, sendHeroEdit, type HeroEdit } from '../app/hero';
import type { Session } from '../app/session';
import type { HeroMods } from '../sim/hero/mods';
import type { HeroState } from '../sim/hero/types';
import { fixturesOn } from './fixtures/mode';
import { fixtureMods } from './fixtures/mods';
import { fixtureApply, fixtureHero } from './fixtures/store';
import { passiveIndex } from './tree/adapter';

/** Bumped after every hero edit the menus make (and on pickups), so open screens re-read. */
export const heroRev = signal(0);

export function heroOf(session: Session): Readonly<HeroState> {
  return fixturesOn.peek() ? fixtureHero() : getHero(session);
}

export function modsOf(session: Session): Readonly<HeroMods> {
  return fixturesOn.peek() ? fixtureMods(fixtureHero(), passiveIndex().tree) : getHeroMods(session);
}

/** HeroMods for a hypothetical hero (a copy with one change), for comparisons. */
export function modsFor(hero: Readonly<HeroState>): HeroMods {
  return fixturesOn.peek() ? fixtureMods(hero, passiveIndex().tree) : heroModsOf(hero);
}

/** Every menu action goes through here. Returns null on success, else the reason. */
export function sendEdit(session: Session, edit: HeroEdit): string | null {
  const r = fixturesOn.peek() ? fixtureApply(edit) : sendHeroEdit(session, edit);
  if (r === null) heroRev.value++;
  return r;
}
