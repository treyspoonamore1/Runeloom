/**
 * The Hearth screens' one door to the game: src/app/hearth.ts readers and `sendHearthEdit`
 * (recorded, so replays reproduce it). With `?fixture=1` (screenshots) the fixture Hearth stands in
 * (src/ui/fixtures/hearthStore.ts). One call per frame reads everything a screen shows.
 */
import {
  getBuildings,
  getExpeditionBoard,
  getGarden,
  getHearthSummary,
  getMutations,
  getRekindle,
  getSalvage,
  getSpindlewrightTrade,
  getStationHere,
  sendHearthEdit,
  type BuildingView,
  type ExpeditionBoardView,
  type GardenView,
  type HearthEdit,
  type HearthSummary,
  type MutationView,
  type RekindleView,
  type SalvageView,
  type StationId,
  type TradeView,
} from '../../app/hearth';
import type { Session } from '../../app/session';
import type { HeroState, RuneItem } from '../../sim/hero/types';
import { freeRunes } from '../../sim/hero/runes';
import { productionMult, scrapPerMinute } from '../../sim/meta/view';
import { fixturesOn } from '../fixtures/mode';
import { fixtureHearthApply, fixtureHearthSession } from '../fixtures/hearthStore';
import { fixtureHero } from '../fixtures/store';
import { heroRev } from '../heroAdapter';

/** Per-minute production, for the header ("numbers going up"). */
export interface HearthRates {
  scrapPerMinute: number;
  /** Rune XP a minute for each planted rune. */
  runeXpPerMinute: number;
  planted: number;
}

export interface HearthSnapshot {
  summary: HearthSummary;
  buildings: BuildingView[];
  garden: GardenView;
  board: ExpeditionBoardView;
  salvage: SalvageView;
  trade: TradeView[];
  rekindle: RekindleView;
  mutations: MutationView[];
  rates: HearthRates;
  scrap: number;
}

const live = (session: Session): Session => (fixturesOn.peek() ? fixtureHearthSession() : session);
const heroIn = (session: Session): Readonly<HeroState> =>
  fixturesOn.peek() ? fixtureHero() : session.state.hero;

/** Pouch runes that could go in a free plot: not socketed, not planted. */
function plantable(session: Session, hero: Readonly<HeroState>): RuneItem[] {
  const planted = new Set(hero.hearth.garden);
  const free = fixturesOn.peek()
    ? [...hero.runes].sort((a, b) => b.level - a.level || a.uid - b.uid)
    : freeRunes(session.state);
  return free.filter((r) => !planted.has(r.uid));
}

export function readHearthSummary(session: Session): HearthSummary {
  return getHearthSummary(live(session));
}

export function readHearth(session: Session): HearthSnapshot {
  void heroRev.value;
  const s = live(session);
  const hero = heroIn(session);
  const level = hero.hearth.buildings;
  const mult = productionMult(hero);
  const garden = getGarden(s);
  return {
    summary: getHearthSummary(s),
    buildings: getBuildings(s),
    garden: { ...garden, plantable: plantable(session, hero) },
    board: getExpeditionBoard(s),
    salvage: getSalvage(s),
    trade: getSpindlewrightTrade(s),
    rekindle: getRekindle(s),
    mutations: getMutations(s),
    rates: {
      scrapPerMinute: scrapPerMinute(level.kindling_pit) * mult,
      runeXpPerMinute: garden.xpPerMinute,
      planted: garden.planted.length,
    },
    scrap: hero.threadScrap,
  };
}

/** Every Hearth action goes through here. Returns null on success, else the reason. */
export function sendHearth(session: Session, edit: HearthEdit): string | null {
  const r = fixturesOn.peek() ? fixtureHearthApply(edit) : sendHearthEdit(session, edit);
  if (r === null) heroRev.value++;
  return r;
}

/** The station the player stands at (hub), for the Interact prompt. */
export function stationNow(session: Session): StationId | null {
  return fixturesOn.peek() ? null : getStationHere(session);
}
