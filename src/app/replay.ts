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
    mode: session.mode,
    cheats: session.startCheats,
    cheatsEdited:
      session.edited || JSON.stringify(session.state.cheats) !== JSON.stringify(session.startCheats),
    loadout: session.startLoadout,
    loadoutEdits: session.loadoutEdits.map((e) => ({ ...e })),
    heroEdits: session.heroEdits.map((e) => structuredClone(e)),
    ...(session.startSave ? { start: session.startSave } : {}),
    tuning: session.startTuning,
    tuningEdited: JSON.stringify(session.state.tuning) !== JSON.stringify(session.startTuning),
    ticks: session.frames.length,
    finalHash: hashHex(hashState(session.state)),
    frames: encodeFrames(session.frames),
  };
}

/** The replay's file name (app/handoff.ts saves it and sends it to Claude). */
export function replayFileName(replay: ReplayFile): string {
  return `runeloom-replay-${replay.roomId.replace(/\//g, '_')}-seed${replay.seed}-t${replay.ticks}.json`;
}
