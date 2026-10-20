import { describe, expect, it, vi } from 'vitest';
import { sfxM4, type M4SfxId } from '../../data/sfxM4';
import { mixSfx } from '../../src/audio/synth';
import { m4Sounds } from '../../src/audio/m4Cues';
import type { M4Cue } from '../../src/app/m4Signals';

describe('M4 presets', () => {
  it('render finite, audible, quiet and rate-limited', async () => {
    vi.stubGlobal('AudioContext', class {});
    const { ZZFX } = await import('zzfx');
    for (const id of Object.keys(sfxM4) as M4SfxId[]) {
      const def = sfxM4[id];
      const s = mixSfx(def, (...a) => ZZFX.buildSamples(...a), ZZFX.sampleRate);
      let peak = 0;
      for (const v of s) {
        expect(Number.isFinite(v), id).toBe(true);
        peak = Math.max(peak, Math.abs(v));
      }
      expect(peak, id).toBeGreaterThan(0.05);
      // The boss sting and death ring longer; everything else stays short.
      expect(s.length / ZZFX.sampleRate, id).toBeLessThan(
        id === 'bossSting' || id === 'bossDeath' ? 3 : 1.5,
      );
      expect(def.gain, id).toBeLessThanOrEqual(0.6);
      expect(def.minGapMs ?? 30, id).toBeGreaterThanOrEqual(30);
    }
    vi.unstubAllGlobals();
    // Rendering ~45 presets is slow on a busy machine.
  }, 60_000);
});

describe('m4Sounds', () => {
  const ids = (c: M4Cue) => m4Sounds(c).map((s) => s.id);
  const at = { x: 4, y: 5 };

  it('maps object cues, positional', () => {
    expect(ids({ type: 'doorOpened', kind: 'door', key: 'd', ...at })).toEqual(['doorOpen']);
    expect(ids({ type: 'doorOpened', kind: 'locked_door', key: 'd', ...at })).toEqual([
      'doorUnlock',
      'doorOpen',
    ]);
    expect(ids({ type: 'doorOpened', kind: 'big_key_door', key: 'd', ...at })).toEqual(['bigDoorOpen']);
    expect(ids({ type: 'plateClick', key: 'p', pressed: false, ...at })).toEqual(['plateRelease']);
    expect(
      ids({ type: 'blockMoved', kind: 'ice_block', key: 'b', sliding: true, stopped: false, ...at }),
    ).toEqual(['iceSlide']);
    expect(m4Sounds({ type: 'chestOpened', kind: 'key_chest', key: 'c', ...at })[0]).toEqual({
      id: 'chestOpen',
      x: 4,
      y: 5,
    });
  });

  it('rings louder for rare and unique drops and centers level ups', () => {
    const item = (rarity: 'normal' | 'rare' | 'unique'): M4Cue => ({
      type: 'lootDropped',
      id: 1,
      content: {
        kind: 'item',
        item: { uid: 1, base: 'cloak', rarity, itemLevel: 1, affixes: [], fused: [] },
      },
      ...at,
    });
    expect(ids(item('normal'))).toEqual(['lootDrop']);
    expect(ids(item('rare'))).toEqual(['lootDropRare']);
    expect(ids(item('unique'))).toEqual(['lootDropUnique']);
    expect(m4Sounds({ type: 'levelUp', level: 3, ...at })[0]).toEqual({ id: 'levelUp' });
  });

  it('maps attack windups and impacts by attack key', () => {
    expect(ids({ type: 'attackWindup', attack: 'stormStrike', id: 2, ...at })).toEqual(['stormCharge']);
    expect(ids({ type: 'attackLanded', attack: 'stormStrike', id: 2, ...at })).toEqual(['thunder']);
    expect(ids({ type: 'attackLanded', attack: 'wispBolt', id: 2, ...at })).toEqual([]);
  });

  it('stings when a boss appears and plays no drone loop while it lives', () => {
    expect(ids({ type: 'bossAppear', id: 1, kind: 'cinder_warden', ...at })).toEqual(['bossSting']);
    expect(Object.keys(sfxM4)).not.toContain('bossDrone');
  });
});
