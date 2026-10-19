/**
 * Save data for the title screen and the save slots: the adapter to the hero/items agent's pure
 * save format and the world agent's adventure setup.
 *
 * EXPECTED from src/sim/save.ts (hero/items agent): `SaveData` (versioned plain JSON, with
 * migrations), `makeSave(state: GameState): SaveData` and
 * `parseSave(text: string): { ok: true; save: SaveData } | { ok: false; error: string }`
 * (errors written for the player: "Not a Runeloom save", "Made by a newer version").
 * EXPECTED from the world agent: `createAdventure({ seed, rooms, save? }): GameState`, a new
 * game when `save` is absent (CONTENT §9.1 loadout at the start room), else the saved game.
 * Until they land, a fixture format with the same shape stands in (version 1, `fixture: true`).
 */
import { createGame, loadoutSpecOf, type GameState } from '../sim';
import { createWorldState, type WorldState } from '../sim/world/worldState';
import type { HeroState } from '../sim/hero/types';
import { newGame, startRoom } from '../../data/progression';
import { isSpindleId, type SpindleId } from '../../data/spindles';
import { roomTexts } from './rooms';
import { fixturesOn } from '../ui/fixtures/mode';
import { fixtureHero, setFixtureHero } from '../ui/fixtures/store';
import { newGameHero } from '../ui/fixtures/hero';

export const SAVE_FORMAT = 'runeloom-save';
export const SAVE_VERSION = 1;

export interface SaveData {
  format: typeof SAVE_FORMAT;
  version: number;
  seed: number;
  tick: number;
  hero: HeroState;
  world: WorldState;
  weaves: { spindleId: string; notations: (string | null)[] };
}

/** What a slot list shows, read from a save. */
export interface SaveMeta {
  level: number;
  roomId: string;
  ticks: number;
}

/** Where adventures start: the real region once its rooms exist, else the Wilds test map. */
export function adventureRoom(): string {
  return roomTexts[startRoom] !== undefined ? startRoom : 'test/wilds';
}

export function makeSave(state: GameState): SaveData {
  const l = loadoutSpecOf(state.weaves);
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    seed: state.seed,
    tick: state.tick,
    hero: structuredClone(fixturesOn.peek() ? fixtureHero() : state.hero),
    world: structuredClone(state.world),
    weaves: { spindleId: l.spindleId, notations: [...l.notations] },
  };
}

type Parsed = { ok: true; save: SaveData } | { ok: false; error: string };

export function parseSave(text: string): Parsed {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "That isn't save data (it isn't JSON)" };
  }
  if (!raw || typeof raw !== 'object' || (raw as SaveData).format !== SAVE_FORMAT)
    return { ok: false, error: 'Not a Runeloom save' };
  const s = raw as SaveData;
  if (typeof s.version !== 'number' || s.version > SAVE_VERSION)
    return { ok: false, error: `Made by a newer version of Runeloom (save v${String(s.version)})` };
  if (!s.hero || !s.world || !s.weaves || typeof s.world.roomId !== 'string' || !Array.isArray(s.hero.runes))
    return { ok: false, error: 'The save is damaged: parts of it are missing' };
  return { ok: true, save: s };
}

export function saveMeta(save: SaveData): SaveMeta {
  return { level: save.hero.level, roomId: save.world.roomId, ticks: save.tick };
}

/** A new game (CONTENT §9.1). MERGE: createAdventure({ seed, rooms: roomTexts }). */
export function newAdventure(seed: number): GameState {
  if (fixturesOn.peek()) setFixtureHero(newGameHero());
  const roomId = adventureRoom();
  return createGame({
    seed,
    rooms: roomTexts,
    roomId,
    mode: 'adventure',
    world: createWorldState(roomId),
    loadout: { spindleId: newGame.spindle, capacity: null, notations: newGame.weaves },
  });
}

/** The saved game. MERGE: createAdventure({ seed, rooms: roomTexts, save }). */
export function adventureFromSave(save: SaveData): GameState {
  if (fixturesOn.peek()) setFixtureHero(structuredClone(save.hero));
  const roomId = roomTexts[save.world.roomId] !== undefined ? save.world.roomId : adventureRoom();
  const spindleId: SpindleId = isSpindleId(save.weaves.spindleId) ? save.weaves.spindleId : 'twig';
  return createGame({
    seed: save.seed,
    rooms: roomTexts,
    roomId,
    mode: 'adventure',
    hero: structuredClone(save.hero),
    world: { ...structuredClone(save.world), roomId },
    loadout: { spindleId, capacity: null, notations: save.weaves.notations },
  });
}
