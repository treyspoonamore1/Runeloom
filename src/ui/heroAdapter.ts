/**
 * The menus' one door to the character (shared by the HUD, inventory, Fuse, tree and map).
 *
 * EXPECTED from src/app/hero.ts (hero/items agent), already in the contract:
 *   getHero(session), getHeroMods(session), sendHeroEdit(session, edit) → reason | null, and
 *   describeItem / describeRune / describePart (see inventory/adapter.ts).
 * EXPECTED, not yet in the contract: a pure `heroModsOf(hero): HeroMods` (the aggregation
 * refreshHero runs), so tooltips can compare "if you equip this" without touching sim state.
 * Until it lands, `modsFor` uses the fixture aggregation.
 */
import { signal } from '@preact/signals';
import { getHero, getHeroMods, sendHeroEdit, type HeroEdit } from '../app/hero';
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

/** HeroMods for a hypothetical hero (a copy with one change), for comparisons. MERGE: heroModsOf. */
export function modsFor(hero: Readonly<HeroState>): HeroMods {
  return fixtureMods(hero, passiveIndex().tree);
}

/** Every menu action goes through here. Returns null on success, else the reason. */
export function sendEdit(session: Session, edit: HeroEdit): string | null {
  const r = fixturesOn.peek() ? fixtureApply(edit) : sendHeroEdit(session, edit);
  if (r === null) heroRev.value++;
  return r;
}
