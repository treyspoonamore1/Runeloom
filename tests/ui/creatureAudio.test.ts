import { describe, expect, it, vi } from 'vitest';
import { sfxCreature, type CreatureSfxId } from '../../data/sfxCreature';
import { mixSfx } from '../../src/audio/synth';
import { creatureCues } from '../../src/audio/creatureCues';
import { createGame, type SimEvent } from '../../src/sim';
import arenaText from '../../data/rooms/test/arena.txt?raw';

const state = () => createGame({ seed: 1, roomText: arenaText, spawnRoomEnemies: false });

describe('creature presets', () => {
  it('render finite, audible, short and quiet', async () => {
    vi.stubGlobal('AudioContext', class {});
    const { ZZFX } = await import('zzfx');
    for (const id of Object.keys(sfxCreature) as CreatureSfxId[]) {
      const def = sfxCreature[id];
      const s = mixSfx(def, (...a) => ZZFX.buildSamples(...a), ZZFX.sampleRate);
      let peak = 0;
      let finite = true;
      for (const v of s) {
        if (!Number.isFinite(v)) finite = false;
        peak = Math.max(peak, Math.abs(v));
      }
      expect(finite, id).toBe(true);
      expect(peak, id).toBeGreaterThan(0.05);
      expect(s.length / ZZFX.sampleRate, id).toBeLessThan(1);
      expect(def.gain, id).toBeLessThanOrEqual(0.6);
      expect(def.minGapMs ?? 30, id).toBeGreaterThanOrEqual(30);
    }
    vi.unstubAllGlobals();
  });
});

describe('creatureCues', () => {
  const s = state();
  const ids = (e: SimEvent) => creatureCues(e, s).map((c) => c.id);

  it('splashes and squelches on entering water and oil, not on leaving', () => {
    expect(ids({ type: 'wetChanged', target: 3, wet: true, x: 1, y: 2 })).toEqual(['stepWater']);
    expect(ids({ type: 'wetChanged', target: 3, wet: false, x: 1, y: 2 })).toEqual([]);
    expect(ids({ type: 'oiledChanged', target: 'player', oiled: true, x: 1, y: 2 })).toEqual(['oilSquelch']);
    expect(creatureCues({ type: 'oiledChanged', target: 'player', oiled: true, x: 1, y: 2 }, s)[0]).toEqual({
      id: 'oilSquelch',
    });
  });

  it('whooshes on a fall and lands with a thud outside water', () => {
    expect(ids({ type: 'fell', target: 'player', fromX: 5, fromY: 5, toX: 6, toY: 6, damage: 8 })).toEqual([
      'fallWhoosh',
      'fallThud',
    ]);
  });

  it('maps charge, arcs, Tinderlings and shields', () => {
    expect(ids({ type: 'chargeHit', target: 2, chargeId: 1, damage: 3, x: 0, y: 0 })).toEqual(['chargeZap']);
    expect(ids({ type: 'arc', from: 2, to: 3, x0: 0, y0: 0, x1: 4, y1: 0 })).toEqual(['arcCrackle']);
    expect(ids({ type: 'tinderlingDoused', id: 2, x: 0, y: 0, stun: 2 })).toEqual(['douseHiss']);
    expect(ids({ type: 'tinderlingRelit', id: 2, x: 0, y: 0 })).toEqual(['relightWhoosh']);
    expect(ids({ type: 'shieldBurned', id: 2, x: 0, y: 0 })).toEqual(['shieldCrack']);
    expect(ids({ type: 'blindChanged', id: 2, blind: true, x: 0, y: 0 })).toEqual([]);
  });
});
