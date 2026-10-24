/**
 * The save format (M4 task 9), pure: no IndexedDB, no files. The UI stores the JSON string that
 * `JSON.stringify(makeSave(state))` gives and reads it back through `parseSave`.
 *
 * A save holds what persists across rooms: the seed, the hero, region progress, the weaves (with
 * their socketed rune uids) and spindle, and every RNG stream, so loot after a load continues
 * the same sequence. Room-scoped state (enemies, terrain, loot on the floor, projectiles) is not
 * saved: loading enters the respawn room fresh, as after a death.
 *
 * Loading: the world agent's createAdventure builds the game from `save.seed`, `save.hero` and
 * `save.world` (placing the player at world.respawn), then `restoreSave(state, save)` applies the
 * weaves and RNG streams and refreshes the hero. `loadSave` does both with a creator function.
 */
import type { SpindleId } from '../../data/spindles';
import { Hasher } from './core/hash';
import { Rng, type RngState } from './core/rng';
import type { GameState } from './state';
import { hashHero, refreshHero } from './hero/hero';
import type { HeroState } from './hero/types';
import { hashWorld, type WorldState } from './world/worldState';
import { applyLoadoutSpec, LOADOUT_SLOTS } from './weave/runtime/loadout';
import { syncWeaveSpindle } from './hero/equip';
import { parseSaveData } from './saveParse';

export const SAVE_FORMAT = 'runeloom-save';
export const SAVE_VERSION = 3;

/** The RNG streams a save restores. */
export const SAVED_RNGS = [
  'rng',
  'combatRng',
  'aiRng',
  'spellRng',
  'gridRng',
  'lootRng',
  'craftRng',
] as const;
export type SavedRng = (typeof SAVED_RNGS)[number];

export interface SavedWeaves {
  spindleId: SpindleId;
  /** One per slot (LMB, RMB, Q, E, R); null for an empty slot. Saves before M7 hold four. */
  notations: (string | null)[];
  /** Socketed rune uids per slot in rune order (hero/runes.ts), null for an empty slot. */
  runes: (number[] | null)[];
}

export interface SaveData {
  format: typeof SAVE_FORMAT;
  version: typeof SAVE_VERSION;
  seed: number;
  /** Ticks played when saved (informational: play time). */
  tick: number;
  hero: HeroState;
  /** Region progress, with no transition pending. */
  world: WorldState;
  weaves: SavedWeaves;
  rngs: Record<SavedRng, RngState>;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** The persistent part of a game as plain JSON-safe data. */
export function makeSave(state: GameState): SaveData {
  const w = state.weaves;
  const world = clone(state.world);
  world.pending = null;
  const rngs = {} as Record<SavedRng, RngState>;
  for (const k of SAVED_RNGS) rngs[k] = state[k].getState();
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    seed: state.seed,
    tick: state.tick,
    hero: clone(state.hero),
    world,
    weaves: {
      spindleId: w.spindleId,
      notations: w.slots.map((s) => s.notation),
      runes: w.slots.map((s) => (s.runes ? [...s.runes] : null)),
    },
    rngs,
  };
}

/**
 * Reads a save from its JSON text (or already-parsed data): checks the format, migrates older
 * versions, fills fields a version lacks with defaults, and validates every cross-reference
 * (equipped and socketed uids, rune, base, affix and part ids). Weaves whose socketed runes
 * don't match are emptied (their runes return to the pouch). Throws an Error saying what is
 * wrong when the save can't be used.
 */
export function parseSave(json: string | unknown): SaveData {
  let data: unknown = json;
  if (typeof json === 'string') {
    try {
      data = JSON.parse(json);
    } catch (e) {
      throw new Error(`Not a save file: ${(e as Error).message}`, { cause: e });
    }
  }
  return parseSaveData(data);
}

/** Applies a save's weaves, spindle and RNG streams to a game built from its hero and world, then refreshes the hero. */
export function restoreSave(state: GameState, save: SaveData): void {
  const notations: (string | null)[] = [];
  const runes: (number[] | null)[] = [];
  for (let i = 0; i < LOADOUT_SLOTS; i++) {
    notations.push(save.weaves.notations[i] ?? null);
    runes.push(save.weaves.runes[i] ?? null);
  }
  applyLoadoutSpec(state, { spindleId: save.weaves.spindleId, notations, runes });
  syncWeaveSpindle(state);
  for (const k of SAVED_RNGS) state[k] = Rng.fromState(save.rngs[k]);
  refreshHero(state);
}

/** Options a game creator gets from a save (the world agent's createAdventure takes these). */
export interface SaveGameInit {
  seed: number;
  hero: HeroState;
  world: WorldState;
}

/** Builds a game from a save: `create` makes the game (createAdventure), then restoreSave. */
export function loadSave(save: SaveData, create: (init: SaveGameInit) => GameState): GameState {
  const state = create({ seed: save.seed, hero: clone(save.hero), world: clone(save.world) });
  restoreSave(state, save);
  return state;
}

/** Hash of everything a save keeps: equal before saving and after loading. */
export function hashProgress(state: GameState): number {
  const h = new Hasher();
  h.u32(state.seed);
  hashHero(h, state.hero);
  hashWorld(h, { ...state.world, pending: null });
  const w = state.weaves;
  h.string(w.spindleId).byte(0).u32(w.slots.length);
  for (const s of w.slots) {
    h.string(s.notation ?? '-').byte(0);
    h.u32(s.runes?.length ?? 0);
    for (const u of s.runes ?? []) h.u32(u);
  }
  for (const k of SAVED_RNGS) for (const x of state[k].getState()) h.u32(x);
  return h.digest();
}
