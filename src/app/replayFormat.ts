import type { Cheats, GameMode, InputFrame, LoadoutEdit, LoadoutSpec } from '../sim';
import type { Tuning } from '../../data/tuning';

/**
 * Replay files (F9). Plain JSON with no DOM dependency, so tools/sim.ts can
 * read them. Frames are stored as [moveX, moveY, aimX, aimY, buttons].
 */
export interface ReplayFile {
  format: 'runeloom-replay';
  version: 1;
  seed: number;
  roomId: string;
  sceneId: string;
  /** Game mode; absent in M0 replays, meaning 'sandbox'. */
  mode?: GameMode;
  /** Cheats at the start of the recording; absent means none. */
  cheats?: Cheats;
  /** True if cheats or console commands changed the state during the recording, so it may not reproduce. */
  cheatsEdited?: boolean;
  /** Weaves and spindle at the start of the recording; absent (pre-M2) means the default loadout. */
  loadout?: LoadoutSpec;
  /** Loom edits during the recording, applied between ticks (LoadoutEdit); absent means none. */
  loadoutEdits?: LoadoutEdit[];
  /** Tuning the recording started with. */
  tuning: Tuning;
  /** True if tuning was edited during the recording, in which case it may not reproduce. */
  tuningEdited: boolean;
  ticks: number;
  /** State hash after the last frame, as 8 hex digits. */
  finalHash: string;
  frames: [number, number, number, number, number][];
}

export function encodeFrames(frames: readonly InputFrame[]): ReplayFile['frames'] {
  return frames.map((f) => [f.moveX, f.moveY, f.aimX, f.aimY, f.buttons]);
}

export function decodeFrames(frames: ReplayFile['frames']): InputFrame[] {
  return frames.map(([moveX, moveY, aimX, aimY, buttons]) => ({ moveX, moveY, aimX, aimY, buttons }));
}

export function parseReplay(json: string): ReplayFile {
  const data = JSON.parse(json) as Partial<ReplayFile>;
  if (data.format !== 'runeloom-replay' || data.version !== 1) {
    throw new Error('Not a Runeloom replay file (expected format "runeloom-replay", version 1).');
  }
  return data as ReplayFile;
}
