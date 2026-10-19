/**
 * Save data for the title screen and the save slots: a thin adapter over the pure save format
 * (src/sim/save.ts: makeSave, parseSave, loadSave) and the world agent's createAdventure.
 *
 * The UI wants `parseSave` to return `{ ok, save } | { ok: false, error }`; the sim's throws an
 * Error with a readable message, which becomes `error`. Games are built with the live tuning
 * (pass `session.state.tuning`) so F9 replays of them reproduce.
 */
import {
  createAdventure,
  makeSave as simMakeSave,
  parseSave as simParseSave,
  SAVE_FORMAT,
  SAVE_VERSION,
  type GameState,
  type SaveData,
} from '../sim';
import { startRoom } from '../../data/progression';
import type { Tuning } from '../../data/tuning';
import { roomTexts } from './rooms';
import { loadAdventure } from './session';
import { fixturesOn } from '../ui/fixtures/mode';
import { setFixtureHero } from '../ui/fixtures/store';
import { newGameHero as fixtureNewGameHero } from '../ui/fixtures/hero';

export { SAVE_FORMAT, SAVE_VERSION, type SaveData };

/** What a slot list shows, read from a save. */
export interface SaveMeta {
  level: number;
  roomId: string;
  ticks: number;
}

/** Where adventures start (data/progression.ts startRoom: emberwood/e1_glade). */
export function adventureRoom(): string {
  return startRoom;
}

export function makeSave(state: GameState): SaveData {
  return simMakeSave(state);
}

type Parsed = { ok: true; save: SaveData } | { ok: false; error: string };

/** Reads save text (checks, migrates, validates references); never throws. */
export function parseSave(text: string): Parsed {
  try {
    return { ok: true, save: simParseSave(text) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function saveMeta(save: SaveData): SaveMeta {
  return { level: save.hero.level, roomId: save.world.roomId, ticks: save.tick };
}

/** A new game (CONTENT §9.1): the new-game hero and weaves at E1's Loom Stone. */
export function newAdventure(seed: number, tuning?: Tuning): GameState {
  // ?fixture=1 (screenshots): the menus show the fixture hero instead of the real one.
  if (fixturesOn.peek()) setFixtureHero(fixtureNewGameHero());
  return createAdventure({ seed, rooms: roomTexts, tuning });
}

/** The saved game: its room (at the respawn Loom Stone when it is there), hero, weaves and RNGs. */
export function adventureFromSave(save: SaveData, tuning?: Tuning): GameState {
  if (fixturesOn.peek()) setFixtureHero(fixtureNewGameHero());
  return loadAdventure(save, tuning);
}
