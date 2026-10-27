/** Playtest 8: a hit a state cut clanks under a quieter hit sound; a bell rung by charge dings. */
import { describe, expect, it } from 'vitest';
import { audioTuning, hitSfx } from '../../data/sfx';
import { sfxM4 } from '../../data/sfxM4';
import { cuesForEvent } from '../../src/audio/cues';
import { fenBossSounds } from '../../src/audio/fenBossCues';
import type { GameState, SimEvent } from '../../src/sim';

const hit = (extra: Partial<Extract<SimEvent, { type: 'hit' }>> = {}): SimEvent => ({
  type: 'hit',
  target: 3,
  sourceId: 0,
  amount: 12,
  crit: false,
  damageType: 'physical',
  x: 5,
  y: 6,
  kbX: 0,
  kbY: 0,
  ...extra,
});
const state = {} as GameState;

describe('reduced-hit and bell sounds', () => {
  it('a reduced hit clanks where it landed, over the hit sound at reducedHitGain', () => {
    expect(fenBossSounds(hit({ reduced: 'shelled' }))).toEqual([{ id: 'shellClank', x: 5, y: 6 }]);
    expect(fenBossSounds(hit({ reduced: 'submerged' }))).toEqual([{ id: 'shellClank', x: 5, y: 6 }]);
    expect(cuesForEvent(hit({ reduced: 'shelled' }), state)).toEqual([
      { id: hitSfx.physical, x: 5, y: 6, gain: audioTuning.reducedHitGain },
    ]);
  });

  it('other hits are unchanged and never clank', () => {
    expect(fenBossSounds(hit())).toEqual([]);
    expect(cuesForEvent(hit(), state)).toEqual([{ id: hitSfx.physical, x: 5, y: 6 }]);
  });

  it('a ring dings', () => {
    expect(fenBossSounds({ type: 'bellRung', id: 3, stun: 2.5, open: 5, x: 1, y: 2 })).toEqual([
      { id: 'bellDing', x: 1, y: 2 },
    ]);
  });

  it('both presets exist and the clank is quieter and shorter than the ding', () => {
    const clank = sfxM4.shellClank;
    const ding = sfxM4.bellDing;
    expect(clank.gain).toBeLessThan(ding.gain);
    const longest = (d: { layers: readonly { release?: number }[] }) => Math.max(...d.layers.map((l) => l.release ?? 0));
    expect(longest(clank)).toBeLessThan(longest(ding));
  });
});
