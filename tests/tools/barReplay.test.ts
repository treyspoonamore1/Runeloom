/** Replay files with weave bar swaps (playtest 8): `npm run sim -- --replay` reproduces them. */
import { describe, expect, it } from 'vitest';
import { Button, createGame, hashHex, hashState, step, type InputFrame, type LoadoutSpec } from '../../src/sim';
import { encodeFrames, parseReplay, type ReplayFile } from '../../src/app/replayFormat';
import { cloneTuning } from '../../data/tuning';
import { checkReplay } from '../../tools/lib/replay';
import { loadRoomText } from '../../tools/lib/rooms';

const ROOM = 'test/arena';

function record(loadout: LoadoutSpec, frames: InputFrame[]): ReplayFile {
  const state = createGame({ seed: 11, roomText: loadRoomText(ROOM), mode: 'arena', loadout });
  for (const f of frames) step(state, f);
  return {
    format: 'runeloom-replay',
    version: 1,
    seed: 11,
    roomId: ROOM,
    sceneId: 'arena',
    mode: 'arena',
    loadout,
    tuning: cloneTuning(),
    tuningEdited: false,
    ticks: frames.length,
    finalHash: hashHex(hashState(state)),
    frames: encodeFrames(frames),
  };
}

describe('replays with weave bar swaps', () => {
  const loadout: LoadoutSpec = {
    spindleId: 'twig',
    notations: ['Cast > Bolt[Fire]', 'Cast > Strike[]', null, null, null, 'Cast > Strike[Frost]', 'Cast > Bolt[Frost]'],
    activeBar: 1,
  };
  const frames: InputFrame[] = Array.from({ length: 400 }, (_, i) => ({
    moveX: i % 100 < 50 ? 1 : -1,
    moveY: 0,
    aimX: 60,
    aimY: 40,
    buttons: (i % 30 < 18 ? Button.Cast1 : Button.Cast2) | (i % 70 === 35 ? Button.SwapBar : 0),
  }));

  it('reproduces the recorded hash, starting on bar 2', () => {
    const f = record(loadout, frames);
    const r = checkReplay(parseReplay(JSON.stringify(f)));
    expect(r.match).toBe(true);
    expect(r.ticks).toBe(400);
  });

  it('the swaps matter: without them the hash differs', () => {
    const f = record(loadout, frames);
    const quiet = frames.map((x) => ({ ...x, buttons: x.buttons & ~Button.SwapBar }));
    expect(checkReplay({ ...f, frames: encodeFrames(quiet) }).match).toBe(false);
  });
});
