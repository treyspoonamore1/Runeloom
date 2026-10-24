/**
 * The Hearth's core (M7): creating and hashing HearthState, lighting the Hearth, and advancing
 * its production through time, online (one Hearth second per 60 ticks outside hitstop, from
 * step.ts) and offline (HearthEdit 'offline', the app's wall-clock gap capped at 8 h).
 *
 * CONTRACT (M7), owned by the meta agent. `advanceHearth` is the closed form: advancing by N
 * seconds at once gives the same Thread Scrap, rune XP and expedition timers (within 1%) as N
 * one-second steps (tests/sim/meta/offline.test.ts).
 */
import { BUILDING_IDS, type BuildingId } from '../../../data/hearth';
import type { Hasher } from '../core/hash';
import type { GameState } from '../state';
import type { HeroState } from '../hero/types';
import type { HearthState } from './types';

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
  for (const e of s.expeditions) h.u32(e.uid).u32(e.tier).num(e.left).num(e.duration);
  h.string(s.salvage).byte(0).u32(s.rekindles).u32(s.ash);
  const ids = Object.keys(s.mutations).sort();
  h.u32(ids.length);
  for (const id of ids) h.string(id).byte(0).u32(s.mutations[id as keyof typeof s.mutations] ?? 0);
  h.num(s.playSeconds).u32(s.clock);
}

/**
 * Lights the Hearth (the Cinder Warden's first death, or a migrated save that beat it): `lit`,
 * the onLit Embers, and the Hearth's Loom Stone activated so fast travel reaches it. Sends
 * 'hearthLit'. Does nothing when already lit. Meta agent.
 */
export function lightHearth(state: GameState): void {
  void state;
}

/**
 * Advances the Hearth by `seconds` of time: Kindling Pit Scrap, Rune Garden XP, expedition
 * timers. Closed form (one call for any span). Does nothing while unlit. Meta agent.
 */
export function advanceHearth(state: GameState, seconds: number): void {
  void state;
  void seconds;
}

/**
 * Per tick from step.ts (adventure mode, outside hitstop): counts `clock` and advances the
 * Hearth one second every 60 ticks; adds the second to playSeconds. Meta agent.
 */
export function stepHearth(state: GameState): void {
  void state;
}

/** The Hearth of a hero (createHero gives every hero one, unlit). */
export function hearthOf(hero: Readonly<HeroState>): Readonly<HearthState> {
  return hero.hearth;
}
