import { readFileSync } from 'node:fs';
import {
  createAdventure,
  hashHex,
  loadSave,
  parseSave,
  runFrames,
  type GameState,
  type SaveData,
} from '../../src/sim';
import { decodeFrames, parseReplay, type ReplayFile } from '../../src/app/replayFormat';
import type { Tuning } from '../../data/tuning';
import { loadAllRooms, loadRoomText } from './rooms';

/**
 * An adventure game rebuilt from a save, the way replays and tools start one: loadSave with
 * createAdventure (the save's room at its respawn Loom Stone), then the saved weaves and RNGs.
 */
export function adventureFromSave(save: SaveData, tuning?: Tuning): GameState {
  const rooms = loadAllRooms();
  return loadSave(parseSave(save), (init) => createAdventure({ ...init, rooms, tuning }));
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
