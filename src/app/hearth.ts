/**
 * The Hearth as menus see it (M7): buildings, Rune Garden, expeditions, Salvage Loom, the
 * Spindlewright's trade, Rekindle and Mutations, and offline progress on load.
 *
 * CONTRACT (M7): UI code reads the Hearth only through these functions and changes it only with
 * `sendHearthEdit` (a HeroEdit, recorded for replays like every menu action). The meta agent
 * fills in the views from src/sim/meta/view.ts; the UI agent calls `applyOfflineGains` where the
 * app loads a save and shows the summary.
 */
import {
  BUILDING_IDS,
  MUTATION_IDS,
  buildings,
  mutations,
  offline,
  spindlewrightPrices,
  stations,
  type BuildingId,
  type MutationId,
  type StationId,
} from '../../data/hearth';
import { currencyIds, currencies, type CurrencyId } from '../../data/currency';
import type { HearthEdit } from '../sim/meta/edits';
import type { Expedition, HearthState, SalvageSetting } from '../sim/meta/types';
import type { RuneItem } from '../sim/hero/types';
import {
  ashForRekindle,
  buildingEffect,
  expeditionSeconds,
  gardenPlots,
  gardenXpPerMinute,
  inHearth,
  maxExpeditionTier,
  maxRiftTier,
  riftOpenCap,
  maxRiftTierFor,
  mutationCost,
  productionMult,
  salvageCap,
  salvageMult,
  upgradeCost,
  weavers,
} from '../sim/meta/view';
import { expeditionRewardCounts } from '../sim/meta/expeditions';
import { rekindleError } from '../sim/meta/rekindle';
import { hearthGateError } from '../sim/meta/edits';
import { freeRunes } from '../sim/hero/runes';
import { maxRuneLevel } from '../../data/progression';
import { stationHere } from '../sim/world/hub';
import { sendHeroEdit } from './hero';
import type { Session } from './session';

export type { HearthEdit, BuildingId, MutationId, StationId, SalvageSetting, Expedition };
export { BUILDING_IDS, MUTATION_IDS, stations };

/** Read-only: never mutate what this returns. */
export function getHearth(session: Session): Readonly<HearthState> {
  return session.state.hero.hearth;
}

/** Applies a Hearth command now (between ticks), recorded for replays. Null on success, else why not. */
export function sendHearthEdit(session: Session, edit: HearthEdit): string | null {
  return sendHeroEdit(session, edit);
}

/** The HUD's Hearth line and badges. */
export interface HearthSummary {
  lit: boolean;
  embers: number;
  ash: number;
  rekindles: number;
  /** Highest rift tier that can be opened now (the ladder and the Rekindle cap). */
  maxRiftTier: number;
  /** The player is in the hub (Hearth edits work only there, except offline). */
  inHearth: boolean;
  /** Expeditions back and waiting to be collected. */
  expeditionsReady: number;
}

export function getHearthSummary(session: Session): HearthSummary {
  const s = session.state;
  const h = s.hero.hearth;
  return {
    lit: h.lit,
    embers: h.embers,
    ash: h.ash,
    rekindles: h.rekindles,
    maxRiftTier: Math.min(s.hero.riftTier + 1, riftOpenCap(s.hero, s.world)),
    inHearth: inHearth(s),
    expeditionsReady: h.expeditions.filter((e) => e.left <= 0).length,
  };
}

export interface BuildingView {
  id: BuildingId;
  name: string;
  text: string;
  level: number;
  maxLevel: number;
  /** Embers for the next level, null at max. */
  cost: number | null;
  /** Why it can't be upgraded now, or null. */
  blocker: string | null;
  /** What it does at its level and at the next ("2.4 Thread Scrap a minute"); next null at max. */
  now: string;
  next: string | null;
}

export function getBuildings(session: Session): BuildingView[] {
  const s = session.state;
  const h = s.hero.hearth;
  return BUILDING_IDS.map((id) => {
    const level = h.buildings[id];
    const max = buildings[id].maxLevel;
    const cost = level >= max ? null : upgradeCost(id, level);
    let blocker: string | null = null;
    if (!h.lit) blocker = 'The Hearth is not lit';
    else if (!inHearth(s)) blocker = 'Only at the Hearth';
    else if (cost === null) blocker = 'Max level';
    else if (h.embers < cost) blocker = `Needs ${cost} Embers`;
    return {
      id,
      name: stations[id].name,
      text: stations[id].text,
      level,
      maxLevel: max,
      cost,
      blocker,
      now: buildingEffect(s.hero, id, level),
      next: level >= max ? null : buildingEffect(s.hero, id, level + 1),
    };
  });
}

export interface GardenView {
  plots: number;
  /** Planted runes, planting order. */
  planted: RuneItem[];
  /** XP per minute each planted rune gets (Bright Hearth included). */
  xpPerMinute: number;
  /** Pouch runes (not socketed, not planted) that could go in a free plot. */
  plantable: RuneItem[];
}

export function getGarden(session: Session): GardenView {
  const s = session.state;
  const hero = s.hero;
  const h = hero.hearth;
  const level = h.buildings.rune_garden;
  const planted = h.garden.map((u) => hero.runes.find((r) => r.uid === u)).filter((r): r is RuneItem => !!r);
  // freeRunes already leaves out socketed and planted runes; a max-level rune has nothing to gain.
  const plantable = freeRunes(s).filter((r) => r.level < maxRuneLevel);
  return {
    plots: gardenPlots(level),
    planted,
    xpPerMinute: gardenXpPerMinute(level) * productionMult(hero),
    plantable,
  };
}

export interface ExpeditionBoardView {
  weavers: number;
  /** Weavers not out or waiting. */
  free: number;
  /** Tiers that can be sent: 1 up to this. */
  maxTier: number;
  expeditions: readonly Expedition[];
  /** Seconds an expedition of `tier` takes. */
  seconds(tier: number): number;
  /** What an expedition of `tier` brings back: Fuse parts, crafting currencies, Embers. */
  /** Reward counts for a tier; `cycle` (an expedition's) before the last Rekindle brings no sigil. */
  rewards(tier: number, cycle?: number): { parts: number; currency: number; embers: number; sigils: number };
}

export function getExpeditionBoard(session: Session): ExpeditionBoardView {
  const hero = session.state.hero;
  const h = hero.hearth;
  const w = weavers(h.buildings.expedition_board);
  return {
    weavers: w,
    free: Math.max(0, w - h.expeditions.length),
    maxTier: maxExpeditionTier(hero),
    expeditions: h.expeditions,
    seconds: (tier) => expeditionSeconds(hero, tier),
    rewards: (tier, cycle) => expeditionRewardCounts(tier, cycle === undefined || cycle === h.rekindles),
  };
}

export interface SalvageView {
  setting: SalvageSetting;
  /** The highest setting the Salvage Loom's level allows. */
  cap: SalvageSetting;
  options: readonly SalvageSetting[];
  /** Thread Scrap × this per salvaged item (round(scrap value × mult)). */
  scrapMult: number;
}

export function getSalvage(session: Session): SalvageView {
  const h = session.state.hero.hearth;
  const level = h.buildings.salvage_loom;
  return {
    setting: h.salvage,
    cap: salvageCap(level),
    options: ['off', 'normal', 'magic', 'rare'],
    scrapMult: salvageMult(level),
  };
}

export interface TradeView {
  currency: CurrencyId;
  name: string;
  price: number;
  owned: number;
}

/** The Spindlewright's wares, priced in Thread Scrap. */
export function getSpindlewrightTrade(session: Session): TradeView[] {
  const hero = session.state.hero;
  return currencyIds.map((c) => ({
    currency: c,
    name: currencies[c].name,
    price: spindlewrightPrices[c],
    owned: hero.currency[c] ?? 0,
  }));
}

export interface RekindleView {
  /** Why Rekindle can't be done now, or null. */
  blocker: string | null;
  /** Ash it would give now. */
  ash: number;
  /** The highest openable rift tier now and after it. */
  maxTier: number;
  nextMaxTier: number;
  /** What it resets and keeps, for the confirmation (DESIGN §11). */
  resets: readonly string[];
  keeps: readonly string[];
}

export function getRekindle(session: Session): RekindleView {
  const s = session.state;
  const hero = s.hero;
  const blocker = rekindleError(s) ?? hearthGateError(s);
  return {
    blocker,
    ash: ashForRekindle(hero),
    maxTier: maxRiftTier(hero),
    nextMaxTier: maxRiftTierFor(hero.hearth.rekindles + 1),
    resets: [
      'Embers',
      'Hearth buildings',
      'Rune Garden plots (runes return to the pouch)',
      'Rift tier progress',
      'Rift Sigils',
    ],
    keeps: [
      'Level, XP and passives',
      'Items, runes and their levels',
      'Thread Scrap and currencies',
      'Ash and Mutations',
    ],
  };
}

export interface MutationView {
  id: MutationId;
  name: string;
  text: string;
  /** Times bought and the most it can be. */
  count: number;
  max: number;
  /** Ash for the next purchase, null when maxed. */
  cost: number | null;
  blocker: string | null;
}

export function getMutations(session: Session): MutationView[] {
  const s = session.state;
  const hero = s.hero;
  return MUTATION_IDS.map((id) => {
    const d = mutations[id];
    const count = hero.hearth.mutations[id] ?? 0;
    const cost = mutationCost(hero, id);
    let blocker: string | null = null;
    if (cost === null) blocker = 'Owned';
    else if (!inHearth(s)) blocker = 'Only at the Hearth';
    else if (hero.hearth.ash < cost) blocker = `Needs ${cost} Ash`;
    return { id, name: d.name, text: d.text, count, max: d.max, cost, blocker };
  });
}

/** The station the living player stands at in the hub (Interact opens its screen), or null. Hub agent. */
export function getStationHere(session: Session): StationId | null {
  return stationHere(session.state);
}

/** What offline progress gave, for the "While you were away" summary. */
export interface OfflineGains {
  seconds: number;
  scrap: number;
  runeXp: number;
  runeLevels: number;
  expeditionsReturned: number;
}

/**
 * Offline progress after loading a save (DESIGN §11): the wall-clock gap since `savedAtMs`,
 * capped at 8 h, sent as the recorded 'offline' edit. Returns what it gave, or null when the
 * Hearth isn't lit or the gap is under a minute. The only wall-clock input to the sim.
 */
export function applyOfflineGains(session: Session, savedAtMs: number, nowMs: number): OfflineGains | null {
  const h = session.state.hero.hearth;
  const seconds = Math.min(offline.capSeconds, Math.max(0, (nowMs - savedAtMs) / 1000));
  if (!h.lit || seconds < offline.minSeconds) return null;
  const whole = Math.floor(seconds);
  const err = sendHearthEdit(session, { kind: 'offline', seconds: whole });
  if (err !== null) return null;
  // The session moved the edit's events to pendingEvents when it recorded it.
  const all = [...session.pendingEvents, ...session.state.events];
  for (let i = all.length - 1; i >= 0; i--) {
    const ev = all[i]!;
    if (ev.type === 'offlineGains') {
      const { type, ...gains } = ev;
      void type;
      return gains;
    }
  }
  return { seconds: whole, scrap: 0, runeXp: 0, runeLevels: 0, expeditionsReturned: 0 };
}
