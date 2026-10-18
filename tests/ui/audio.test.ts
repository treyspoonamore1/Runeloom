import { describe, expect, it, vi } from 'vitest';
import { audioTuning, sfx, type SfxId } from '../../data/sfx';
import { layerToArgs, mixSfx } from '../../src/audio/synth';
import { VoiceLimiter } from '../../src/audio/voices';
import { cuesForEvent, spatialize } from '../../src/audio/cues';
import { WaveWatcher, readArena } from '../../src/ui/arena';
import { createGame, type GameState, type SimEvent } from '../../src/sim';
import arenaText from '../../data/rooms/test/arena.txt?raw';

const state = (): GameState => createGame({ seed: 1, roomText: arenaText, spawnRoomEnemies: false });

describe('layerToArgs', () => {
  it('orders the 21 ZzFX arguments', () => {
    const a = layerToArgs({
      volume: 0.5,
      frequency: 300,
      shape: 'noise',
      slide: 2,
      filter: 900,
      release: 0.2,
    });
    expect(a).toHaveLength(21);
    expect(a[0]).toBe(0.5);
    expect(a[2]).toBe(300);
    expect(a[5]).toBe(0.2);
    expect(a[6]).toBe(4);
    expect(a[8]).toBe(2);
    expect(a[20]).toBe(900);
  });
});

describe('mixSfx', () => {
  const sr = 1000;
  const build = (...a: number[]) => new Float32Array(Math.round(a[2]! * 10)).fill(a[0]!);

  it('offsets layers, sums them and normalizes to the preset gain', () => {
    const out = mixSfx(
      {
        gain: 0.5,
        layers: [
          { frequency: 10, volume: 1 },
          { frequency: 10, volume: 1, at: 0.05 },
        ],
      },
      build,
      sr,
    );
    expect(out.length).toBe(150);
    expect(Math.max(...out)).toBeCloseTo(0.5, 6);
    expect(out[0]).toBeCloseTo(0.25, 6);
    expect(out[60]).toBeCloseTo(0.5, 6);
  });
});

describe('every preset renders', () => {
  it('is finite, audible, short and peaks at its gain', async () => {
    vi.stubGlobal('AudioContext', class {});
    const { ZZFX } = await import('zzfx');
    for (const id of Object.keys(sfx) as SfxId[]) {
      const def = sfx[id];
      const s = mixSfx(def, (...a) => ZZFX.buildSamples(...a), ZZFX.sampleRate);
      const seconds = s.length / ZZFX.sampleRate;
      let peak = 0;
      for (const v of s) {
        expect(Number.isFinite(v), id).toBe(true);
        peak = Math.max(peak, Math.abs(v));
      }
      expect(peak, id).toBeGreaterThan(0.05);
      expect(peak, id).toBeLessThanOrEqual(def.gain + 1e-6);
      expect(seconds, id).toBeLessThan(1.0);
      expect(def.gain, id).toBeLessThanOrEqual(1);
    }
    vi.unstubAllGlobals();
  });
});

describe('VoiceLimiter', () => {
  const req = (id: string, now: number, extra: Partial<Parameters<VoiceLimiter['request']>[0]> = {}) => ({
    id,
    now,
    durationMs: 200,
    minGapMs: 30,
    priority: 1,
    ...extra,
  });

  it('refuses a repeat of the same sound inside the minimum gap', () => {
    const l = new VoiceLimiter(24);
    expect(l.request(req('a', 0)).ok).toBe(true);
    expect(l.request(req('a', 29)).ok).toBe(false);
    expect(l.request(req('b', 29)).ok).toBe(true);
    expect(l.request(req('a', 30)).ok).toBe(true);
  });

  it('caps simultaneous voices and frees them when they end', () => {
    const l = new VoiceLimiter(3);
    for (let i = 0; i < 3; i++) expect(l.request(req(`s${i}`, 0)).ok).toBe(true);
    expect(l.request(req('s3', 10)).ok).toBe(false);
    expect(l.active).toBe(3);
    expect(l.request(req('s3', 250)).ok).toBe(true);
    expect(l.active).toBe(1);
  });

  it('lets a higher priority replace the oldest lowest-priority voice', () => {
    const l = new VoiceLimiter(2);
    const a = l.request(req('a', 0));
    l.request(req('b', 5));
    const c = l.request(req('c', 10, { priority: 3 }));
    expect(c.ok).toBe(true);
    expect(c.evict).toBe(a.voice);
    expect(l.request(req('d', 20, { priority: 1 })).ok).toBe(false);
  });

  it('release() frees a voice early', () => {
    const l = new VoiceLimiter(1);
    const a = l.request(req('a', 0));
    l.release(a.voice!);
    expect(l.request(req('b', 1)).ok).toBe(true);
  });

  it('uses the shared tuning numbers', () => {
    expect(audioTuning.maxVoices).toBe(24);
    expect(audioTuning.minGapMs).toBe(30);
  });
});

describe('cuesForEvent', () => {
  const s = state();
  const ids = (e: SimEvent) => cuesForEvent(e, s).map((c) => c.id);

  it('maps casts, failures and impacts', () => {
    expect(ids({ type: 'cast', slot: 0, spell: 'fire_bolt', x: 0, y: 0, dirX: 1, dirY: 0 })).toEqual([
      'boltCast',
    ]);
    expect(ids({ type: 'cast', slot: 1, spell: 'strike', x: 0, y: 0, dirX: 1, dirY: 0 })).toEqual([
      'strikeSwing',
    ]);
    expect(ids({ type: 'castFailed', slot: 0, spell: 'fire_bolt', reason: 'mana' })).toEqual(['castFailed']);
    expect(ids({ type: 'projectileEnd', id: 1, kind: 'fire_bolt', x: 1, y: 1, reason: 'wall' })).toEqual([
      'boltImpact',
    ]);
    expect(ids({ type: 'projectileEnd', id: 1, kind: 'fire_bolt', x: 1, y: 1, reason: 'expired' })).toEqual(
      [],
    );
    expect(ids({ type: 'projectileEnd', id: 2, kind: 'ember_arrow', x: 1, y: 1, reason: 'hit' })).toEqual([]);
  });

  it('plays the hit sound by damage type, plus a chime on crits, and a hurt sound for the player', () => {
    const hit = (target: number | 'player', damageType: 'fire' | 'physical', crit = false): SimEvent => ({
      type: 'hit',
      target,
      sourceId: 0,
      amount: 5,
      crit,
      damageType,
      x: 3,
      y: 4,
      kbX: 0,
      kbY: 0,
    });
    expect(ids(hit(7, 'fire'))).toEqual(['hitFire']);
    expect(ids(hit(7, 'physical', true))).toEqual(['strikeHit', 'crit']);
    expect(ids(hit('player', 'physical'))).toEqual(['playerHurt']);
  });

  it('picks death, telegraph and attack sounds by kind or attack name', () => {
    expect(
      ids({
        type: 'death',
        id: 1,
        kind: 'shieldbearer',
        x: 0,
        y: 0,
        killerId: 0,
        cause: 'hit' as const,
        shattered: false,
      }),
    ).toEqual(['deathShieldbearer']);
    expect(
      ids({
        type: 'death',
        id: 1,
        kind: 'dummy',
        x: 0,
        y: 0,
        killerId: 0,
        cause: 'hit' as const,
        shattered: false,
      }),
    ).toEqual(['deathDefault']);
    expect(ids({ type: 'telegraph', id: 99, attack: 'fire_arrow', windup: 0.4 })).toEqual([
      'telegraphRanged',
    ]);
    expect(ids({ type: 'telegraph', id: 99, attack: 'mystery', windup: 0.4 })).toEqual(['telegraph']);
    expect(ids({ type: 'attack', id: 1, attack: 'fire_arrow', x: 0, y: 0 })).toEqual(['archerShot']);
    expect(ids({ type: 'attack', id: 1, attack: 'mystery', x: 0, y: 0 })).toEqual([]);
    expect(ids({ type: 'shieldBlock', id: 1, projectileId: 2, x: 0, y: 0 })).toEqual(['shieldBlock']);
    expect(ids({ type: 'dodge', x: 0, y: 0, dirX: 1, dirY: 0 })).toEqual(['dodge']);
    expect(ids({ type: 'evaded', x: 0, y: 0, sourceId: 3 })).toEqual(['evaded']);
    expect(ids({ type: 'playerDeath', x: 0, y: 0 })).toEqual(['playerDeath']);
    expect(ids({ type: 'playerRespawn', x: 0, y: 0 })).toEqual(['respawn']);
    expect(ids({ type: 'hitstop', seconds: 0.03 })).toEqual([]);
  });
});

describe('spatialize', () => {
  it('pans toward the source and fades with distance', () => {
    expect(spatialize(0, 0)).toEqual({ pan: 0, gain: 1 });
    expect(spatialize(80, 0).pan).toBeCloseTo(audioTuning.panRange);
    expect(spatialize(-200, 0).pan).toBeCloseTo(-audioTuning.panRange);
    expect(spatialize(500, 0).gain).toBeCloseTo(audioTuning.farGain);
  });
});

describe('WaveWatcher', () => {
  const a = (wave: number, phase: 'fighting' | 'intermission') => ({
    wave,
    phase,
    timer: 3,
    spawnedTotal: 0,
    killedTotal: 0,
  });

  it('reports wave start, clear and restart once each', () => {
    const w = new WaveWatcher();
    expect(w.update(null).transition).toBeNull();
    expect(w.update(a(0, 'intermission')).transition).toBeNull();
    expect(w.update(a(1, 'fighting')).transition).toBe('started');
    expect(w.update(a(1, 'fighting')).transition).toBeNull();
    expect(w.update(a(1, 'intermission')).transition).toBe('cleared');
    expect(w.update(a(1, 'intermission')).transition).toBeNull();
    expect(w.update(a(2, 'fighting')).transition).toBe('started');
    expect(w.update(a(0, 'intermission')).transition).toBe('reset');
  });

  it('readArena tolerates a missing arena', () => {
    expect(readArena(state())).toBeNull();
    const s = state();
    s.mode = 'arena';
    s.arena = {
      wave: 2,
      phase: 'fighting',
      timer: 0,
      spawnedTotal: 5,
      killedTotal: 1,
      waveSize: 0,
      remaining: 0,
      areaLevel: 1,
      queue: [],
    };
    expect(readArena(s)?.wave).toBe(2);
  });
});
