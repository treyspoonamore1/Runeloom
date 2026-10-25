/**
 * The Hearth's core (M7): creating and hashing HearthState, lighting the Hearth, and advancing
 * its production through time, online (one Hearth second per 60 ticks outside hitstop, from
 * step.ts) and offline (HearthEdit 'offline', the app's wall-clock gap capped at 8 h).
 *
 * CONTRACT (M7), owned by the meta agent. `advanceHearth` is the closed form: advancing by N
 * seconds at once gives the same Thread Scrap, rune XP and expedition timers (within 1%) as N
 * one-second steps (tests/sim/meta/offline.test.ts).
 *
 * Nothing it changes is part of the build: garden runes can't be socketed and Thread Scrap,
 * timers and Embers feed no HeroMods, so it never calls refreshHero.
 */
import { BUILDING_IDS, embers, hearthStone, type BuildingId } from '../../../data/hearth';
import { maxRuneLevel, runeXpToNext } from '../../../data/progression';
import { weaveLimits } from '../../../data/runes';
import { SIM_HZ } from '../core/constants';
import type { Hasher } from '../core/hash';
import { emit } from '../events';
import type { GameState } from '../state';
import type { HeroState, RuneItem } from '../hero/types';
import { loomStoneId } from '../world/worldState';
import type { HearthState } from './types';
import { gardenXpPerMinute, productionMult, scrapPerMinute } from './view';

export function createHearth(): HearthState {
  const buildings = {} as Record<BuildingId, number>;
  for (const b of BUILDING_IDS) buildings[b] = 0;
  return {
    lit: false,
    embers: 0,
    embersSpent: 0,
    buildings,
    scrapCarry: 0,
    garden: [],
    expeditions: [],
    salvage: 'off',
    rekindles: 0,
    bestEverTier: 0,
    ash: 0,
    mutations: {},
    playSeconds: 0,
    clock: 0,
  };
}

export function hashHearth(h: Hasher, s: HearthState): void {
  h.bool(s.lit).u32(s.embers).num(s.embersSpent);
  for (const b of BUILDING_IDS) h.u32(s.buildings[b]);
  h.num(s.scrapCarry).u32(s.garden.length);
  for (const u of s.garden) h.u32(u);
  h.u32(s.expeditions.length);
  for (const e of s.expeditions) h.u32(e.uid).u32(e.tier).num(e.left).num(e.duration).u32(e.cycle);
  h.string(s.salvage).byte(0).u32(s.rekindles).u32(s.bestEverTier).u32(s.ash);
  const ids = Object.keys(s.mutations).sort();
  h.u32(ids.length);
  for (const id of ids)
    h.string(id)
      .byte(0)
      .u32(s.mutations[id as keyof typeof s.mutations] ?? 0);
  h.num(s.playSeconds).u32(s.clock);
}

/** The Hearth's Loom Stone id in WorldState.loomStones. */
export const HEARTH_STONE_ID = loomStoneId(hearthStone.roomId, hearthStone.key);

/** Sets a Hearth lit with its starting Embers and its Loom Stone activated (lightHearth and save migration). */
export function lightHearthState(hero: HeroState, loomStones: string[]): void {
  const h = hero.hearth;
  h.lit = true;
  h.embers += embers.onLit;
  if (!loomStones.includes(HEARTH_STONE_ID)) loomStones.push(HEARTH_STONE_ID);
}

/**
 * Lights the Hearth (the Cinder Warden's first death, or a migrated save that beat it): `lit`,
 * the onLit Embers, and the Hearth's Loom Stone activated so fast travel reaches it. Sends
 * 'hearthLit'. Does nothing when already lit, or outside adventure mode.
 */
export function lightHearth(state: GameState): void {
  if (state.mode !== 'adventure' || state.hero.hearth.lit) return;
  lightHearthState(state.hero, state.world.loomStones);
  emit(state, { type: 'hearthLit', embers: embers.onLit });
}

/** What a span of Hearth time gave (the 'offlineGains' summary). */
export interface HearthGains {
  seconds: number;
  /** Whole Thread Scrap added. */
  scrap: number;
  /** Rune XP added over all garden runes (what the runes took; none past max level). */
  runeXp: number;
  /** Levels gained over all garden runes. */
  runeLevels: number;
  expeditionsReturned: number;
}

/** XP a rune gains from `amount` (rune quality adds, as for socketed runes in hero/runes.ts). */
export function runeXpGain(r: Readonly<RuneItem>, amount: number): number {
  return r.quality > 0 ? amount * (1 + r.quality * weaveLimits.qualityXpPerPoint) : amount;
}

/** Adds XP to a rune and levels it through runeXpToNext up to maxRuneLevel (XP stops there). Returns the XP it took. */
function feedRune(r: RuneItem, xp: number): number {
  if (r.level >= maxRuneLevel) return 0;
  let took = xp;
  r.xp += xp;
  while (r.level < maxRuneLevel && r.xp >= runeXpToNext(r.level)) {
    r.xp -= runeXpToNext(r.level);
    r.level++;
  }
  if (r.level >= maxRuneLevel) {
    took -= r.xp;
    r.xp = 0;
  }
  return took;
}

/**
 * Advances the Hearth by `seconds` of time: Kindling Pit Scrap, Rune Garden XP, expedition
 * timers. Closed form (one call for any span, the same result as many short ones up to rounding).
 * Sends 'gardenRuneLevel' (a rune's new level, once per call) and 'expeditionReturned'. Does
 * nothing while unlit. Returns what it gave.
 */
export function advanceHearth(state: GameState, seconds: number): HearthGains {
  const gains: HearthGains = { seconds, scrap: 0, runeXp: 0, runeLevels: 0, expeditionsReturned: 0 };
  const hero = state.hero;
  const h = hero.hearth;
  if (!h.lit || !(seconds > 0)) return gains;
  const mult = productionMult(hero);
  // Kindling Pit: fractional Scrap carries over, so one long span equals many short ones.
  const pit = h.buildings.kindling_pit;
  if (pit > 0) {
    h.scrapCarry += ((scrapPerMinute(pit) * mult) / 60) * seconds;
    const whole = Math.floor(h.scrapCarry + 1e-9);
    if (whole > 0) {
      h.scrapCarry = Math.max(0, h.scrapCarry - whole);
      hero.threadScrap += whole;
      gains.scrap = whole;
    }
  }
  // Rune Garden: every planted rune gains the same XP.
  const garden = h.buildings.rune_garden;
  if (garden > 0 && h.garden.length > 0) {
    const xp = ((gardenXpPerMinute(garden) * mult) / 60) * seconds;
    for (const uid of h.garden) {
      const r = hero.runes.find((x) => x.uid === uid);
      if (!r) continue;
      const before = r.level;
      gains.runeXp += feedRune(r, runeXpGain(r, xp));
      if (r.level > before) {
        gains.runeLevels += r.level - before;
        emit(state, { type: 'gardenRuneLevel', uid, level: r.level });
      }
    }
  }
  // Expeditions: timers run down; a returned one waits to be collected.
  for (const e of h.expeditions) {
    if (e.left <= 0) continue;
    e.left = Math.max(0, e.left - seconds);
    if (e.left <= 1e-9) {
      e.left = 0;
      gains.expeditionsReturned++;
      emit(state, { type: 'expeditionReturned', uid: e.uid, tier: e.tier });
    }
  }
  return gains;
}

/** Ticks per Hearth second. */
export const HEARTH_TICKS = SIM_HZ;

/**
 * Per tick from step.ts (adventure mode, outside hitstop): counts `clock` and advances the
 * Hearth one second every 60 ticks; adds the second to playSeconds. Nothing while unlit.
 */
export function stepHearth(state: GameState): void {
  const h = state.hero.hearth;
  if (!h.lit) return;
  if (++h.clock < HEARTH_TICKS) return;
  h.clock = 0;
  h.playSeconds++;
  advanceHearth(state, 1);
}

/** The Hearth of a hero (createHero gives every hero one, unlit). */
export function hearthOf(hero: Readonly<HeroState>): Readonly<HearthState> {
  return hero.hearth;
}
