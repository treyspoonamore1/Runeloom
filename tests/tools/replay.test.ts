import { describe, expect, it } from 'vitest';
import { createGame, findScenario, hashHex, hashState, step, type InputFrame } from '../../src/sim';
import { decodeFrames, encodeFrames, parseReplay, type ReplayFile } from '../../src/app/replayFormat';
import { cloneTuning } from '../../data/tuning';
import { checkReplay } from '../../tools/lib/replay';
import { loadRoomText } from '../../tools/lib/rooms';

function record(ticks: number): ReplayFile {
  const sc = findScenario('wander')!;
  const state = createGame({ seed: 7, roomText: loadRoomText(sc.roomId) });
  const frames: InputFrame[] = [];
  for (let i = 0; i < ticks; i++) {
    const f = sc.input(state.tick, state);
    frames.push(f);
    step(state, f);
  }
  return {
    format: 'runeloom-replay',
    version: 1,
    seed: 7,
    roomId: sc.roomId,
    sceneId: 'room',
    tuning: cloneTuning(),
    tuningEdited: false,
    ticks,
    finalHash: hashHex(hashState(state)),
    frames: encodeFrames(frames),
  };
}

describe('replay files', () => {
  it('round-trips frames', () => {
    const f = record(50);
    expect(encodeFrames(decodeFrames(f.frames))).toEqual(f.frames);
  });
  it('survives JSON and matches the recorded hash', () => {
    const r = checkReplay(parseReplay(JSON.stringify(record(500))));
    expect(r.match).toBe(true);
    expect(r.ticks).toBe(500);
  });
  it('reports a mismatch when the hash is wrong', () => {
    const f = record(100);
    f.finalHash = '00000000';
    expect(checkReplay(f).match).toBe(false);
  });
  it('rejects non-replay JSON', () => {
    expect(() => parseReplay('{"format":"x"}')).toThrow(/Not a Runeloom replay/);
    expect(() => parseReplay('not json')).toThrow();
  });
});
