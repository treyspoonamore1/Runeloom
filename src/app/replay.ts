import { hashHex, hashState } from '../sim';
import { encodeFrames, type ReplayFile } from './replayFormat';
import type { Session } from './session';

/** Builds a replay of everything since the session's last reset. */
export function makeReplay(session: Session): ReplayFile {
  return {
    format: 'runeloom-replay',
    version: 1,
    seed: session.seed,
    roomId: session.roomId,
    sceneId: session.sceneId,
    tuning: session.startTuning,
    tuningEdited: JSON.stringify(session.state.tuning) !== JSON.stringify(session.startTuning),
    ticks: session.frames.length,
    finalHash: hashHex(hashState(session.state)),
    frames: encodeFrames(session.frames),
  };
}

/** Saves the replay as a .json download. Returns the file name. */
export function downloadReplay(replay: ReplayFile): string {
  const name = `runeloom-replay-${replay.roomId.replace(/\//g, '_')}-seed${replay.seed}-t${replay.ticks}.json`;
  const blob = new Blob([JSON.stringify(replay)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}
