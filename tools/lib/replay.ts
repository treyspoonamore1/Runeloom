import { readFileSync } from 'node:fs';
import {
  createGame,
  hashHex,
  loadSave,
  parseSave,
  runFrames,
  type GameState,
  type SaveData,
} from '../../src/sim';
import { decodeFrames, parseReplay, type ReplayFile } from '../../src/app/replayFormat';
import type { Tuning } from '../../data/tuning';
import { listRoomIds, loadRoomText } from './rooms';

/** Every room text by id, read from data/rooms (the adventure's RoomSource). */
export function allRoomTexts(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of listRoomIds()) out[id] = loadRoomText(id);
  return out;
}

/**
 * An adventure game rebuilt from a save, the way replays and tools start one: the game is
 * created in the save's respawn room (else its current room), then restoreSave applies weaves
 * and RNG streams. Stand-in for the world agent's createAdventure.
 */
export function adventureFromSave(save: SaveData, tuning?: Tuning): GameState {
  const rooms = allRoomTexts();
  return loadSave(parseSave(save), (init) =>
    createGame({
      seed: init.seed,
      mode: 'adventure',
      rooms,
      roomId: init.world.respawn?.roomId ?? init.world.roomId,
      hero: init.hero,
      world: init.world,
      tuning,
    }),
  );
}

export interface ReplayCheck {
  file: ReplayFile;
  ticks: number;
  hash: string;
  expected: string;
  match: boolean;
  x: number;
  y: number;
}

/** Replays a ReplayFile from a fresh game and compares to the recorded final hash. */
export function checkReplay(file: ReplayFile): ReplayCheck {
  const frames = decodeFrames(file.frames);
  const start = file.start;
  const { state, hash } = runFrames(frames, start ? '' : loadRoomText(file.roomId), {
    seed: file.seed,
    tuning: file.tuning,
    mode: file.mode ?? 'sandbox',
    cheats: file.cheats,
    loadout: file.loadout,
    loadoutEdits: file.loadoutEdits,
    heroEdits: file.heroEdits,
    createState: start ? () => adventureFromSave(start, file.tuning) : undefined,
  });
  const h = hashHex(hash);
  return {
    file,
    ticks: frames.length,
    hash: h,
    expected: file.finalHash,
    match: h === file.finalHash,
    x: state.player.x,
    y: state.player.y,
  };
}

export function readReplay(path: string): ReplayFile {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    throw new Error(`Cannot read replay "${path}": ${(e as Error).message}`, { cause: e });
  }
  try {
    return parseReplay(text);
  } catch (e) {
    throw new Error(`Bad replay "${path}": ${(e as Error).message}`, { cause: e });
  }
}
