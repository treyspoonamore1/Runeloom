import { readFileSync } from 'node:fs';
import { hashHex, runFrames } from '../../src/sim';
import { decodeFrames, parseReplay, type ReplayFile } from '../../src/app/replayFormat';
import { loadAllRooms, loadRoomText } from './rooms';

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
  const adventure = file.mode === 'adventure';
  const { state, hash } = runFrames(frames, adventure ? '' : loadRoomText(file.roomId), {
    seed: file.seed,
    tuning: file.tuning,
    mode: file.mode ?? 'sandbox',
    cheats: file.cheats,
    loadout: file.loadout,
    loadoutEdits: file.loadoutEdits,
    ...(adventure ? { rooms: loadAllRooms(), roomId: file.roomId, hero: file.hero, world: file.world } : {}),
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
