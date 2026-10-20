import type { GameState, SimEvent } from '../sim';
import { audioTuning, sfx, type SfxDef, type SfxId } from '../../data/sfx';
import { sfxCreature, type CreatureSfxId } from '../../data/sfxCreature';
import { creatureCues } from './creatureCues';
import { sfxM4, type M4SfxId } from '../../data/sfxM4';
import { M4Signals } from '../app/m4Signals';
import { BossDrone, m4Sounds } from './m4Cues';
import { onSettingsChange, settings } from '../app/settings';
import { readArena, WaveWatcher } from '../ui/arena';
import { cuesForEvent, spatialize, SpellCueTracker, type Cue } from './cues';
import { mixSfx } from './synth';
import { terrainCues, TerrainSoundTracker } from './terrainCues';
import { VoiceLimiter } from './voices';

/** Sound effects driven by sim events (DESIGN §13). */
export interface AudioSystem {
  /** Plays sounds for the events since the last frame. */
  handleEvents(events: readonly SimEvent[], state: GameState): void;
  /** Browsers only allow audio after a user gesture: call from the first click or key press. */
  unlock(): void;
  /** Master volume, 0 to 1. */
  setVolume(v: number): void;
  readonly volume: number;
  /** Plays one preset right now (menus, tests, the item-get fanfare). Does nothing until unlocked. */
  play(id: SfxId | M4SfxId, opts?: { pan?: number; gain?: number }): void;
}

interface Engine {
  ctx: AudioContext;
  master: GainNode;
  buffers: Map<AnySfxId, AudioBuffer>;
  buildSamples(...args: number[]): ArrayLike<number>;
  sampleRate: number;
}

/** Every preset: data/sfx.ts plus the grid-creature (data/sfxCreature.ts) and M4 (data/sfxM4.ts) sounds. */
type AnySfxId = SfxId | CreatureSfxId | M4SfxId;
const PRESETS: Record<AnySfxId, SfxDef> = { ...sfx, ...sfxCreature, ...sfxM4 };

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * ZzFX presets from data/sfx.ts rendered once into AudioBuffers, then played with a little random
 * pitch variation through a shared compressor. Never throws: if the AudioContext is missing or
 * blocked, sounds are silently dropped.
 */
export function createAudio(): AudioSystem {
  let volume = clamp01(settings.volume);
  let engine: Engine | null = null;
  let loading = false;
  const limiter = new VoiceLimiter(audioTuning.maxVoices);
  const sources = new Map<number, AudioBufferSourceNode>();
  const waves = new WaveWatcher();
  const spellCues = new SpellCueTracker();
  const terrain = new TerrainSoundTracker();
  /** M4 cues (objects, loot, bosses, level ups) from state changes and events; the boss drone. */
  const m4 = new M4Signals();
  const drone = new BossDrone();
  let lastFrame = -1;

  const applyVolume = (): void => {
    if (!engine) return;
    try {
      engine.master.gain.setTargetAtTime(volume, engine.ctx.currentTime, 0.02);
    } catch {
      // Ignore: the context may be closed.
    }
  };

  const boot = async (): Promise<void> => {
    loading = true;
    try {
      // Imported on the first gesture: the module creates its AudioContext when it loads.
      const { ZZFX } = await import('zzfx');
      ZZFX.volume = audioTuning.zzfxMaster;
      const ctx = ZZFX.audioContext;
      const master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 12;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.12;
      master.connect(comp).connect(ctx.destination);
      engine = {
        ctx,
        master,
        buffers: new Map(),
        buildSamples: (...a) => ZZFX.buildSamples(...a),
        sampleRate: ZZFX.sampleRate,
      };
      master.gain.value = volume;
    } catch {
      engine = null;
    }
    loading = false;
  };

  const resume = (): void => {
    try {
      if (engine && engine.ctx.state !== 'running') void engine.ctx.resume().catch(() => {});
    } catch {
      // Blocked: try again on the next gesture.
    }
  };

  const bufferFor = (e: Engine, id: AnySfxId): AudioBuffer | null => {
    let buf = e.buffers.get(id);
    if (!buf) {
      const samples = mixSfx(PRESETS[id], e.buildSamples, e.sampleRate);
      if (samples.length === 0) return null;
      buf = e.ctx.createBuffer(1, samples.length, e.sampleRate);
      buf.getChannelData(0).set(samples);
      e.buffers.set(id, buf);
    }
    return buf;
  };

  // Sounds requested while the engine is still loading (the first click) play once it's ready.
  let pending: Array<[AnySfxId, { pan?: number; gain?: number }]> = [];

  const play = (id: AnySfxId, opts: { pan?: number; gain?: number } = {}): void => {
    const e = engine;
    if (!e && loading && pending.length < 4) pending.push([id, opts]);
    if (!e || volume <= 0 || e.ctx.state !== 'running') return;
    try {
      const def: { pitchVar?: number; minGapMs?: number; priority?: number } = PRESETS[id];
      const buf = bufferFor(e, id);
      if (!buf) return;
      const rate = 1 + (Math.random() * 2 - 1) * (def.pitchVar ?? 0.05);
      const grant = limiter.request({
        id,
        now: now(),
        durationMs: (buf.duration / rate) * 1000,
        minGapMs: def.minGapMs ?? audioTuning.minGapMs,
        priority: def.priority ?? 1,
      });
      if (!grant.ok || grant.voice === undefined) return;
      if (grant.evict !== undefined) stopVoice(grant.evict);

      const src = e.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const gain = e.ctx.createGain();
      gain.gain.value = opts.gain ?? 1;
      src.connect(gain);
      if (opts.pan) {
        const panner = e.ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, opts.pan));
        gain.connect(panner).connect(e.master);
      } else {
        gain.connect(e.master);
      }
      const token = grant.voice;
      sources.set(token, src);
      src.onended = () => {
        sources.delete(token);
        limiter.release(token);
      };
      src.start();
    } catch {
      // Audio must never break the game loop.
    }
  };

  const stopVoice = (token: number): void => {
    const s = sources.get(token);
    sources.delete(token);
    try {
      s?.stop();
    } catch {
      // Already stopped.
    }
  };

  const playCue = (
    c: Cue | { id: AnySfxId; x?: number; y?: number; gain?: number },
    state: GameState,
  ): void => {
    let pan = 0;
    let g = c.gain ?? 1;
    if (c.x !== undefined && c.y !== undefined) {
      const s = spatialize(c.x - state.player.x, c.y - state.player.y);
      pan = s.pan;
      g *= s.gain;
    }
    play(c.id, { pan, gain: g });
  };

  onSettingsChange((s) => {
    volume = clamp01(s.volume);
    applyVolume();
  });

  return {
    handleEvents(events, state) {
      if (!engine) {
        // Keep the orb/sigil bookkeeping current even before audio is unlocked.
        for (const e of events) spellCues.cues(e);
        return;
      }
      try {
        for (const e of events) {
          for (const c of cuesForEvent(e, state)) playCue(c, state);
          for (const c of spellCues.cues(e)) playCue(c, state);
          for (const c of terrainCues(e)) playCue(c, state);
          for (const c of creatureCues(e, state)) playCue(c, state);
        }
        // The fire bed and burn-out crumbles (frame time, capped so a stall doesn't burst).
        const t = now();
        const dt = lastFrame < 0 ? 0 : Math.min(0.1, (t - lastFrame) / 1000);
        lastFrame = t;
        for (const c of terrain.cues(events, state, dt)) playCue(c, state);
        for (const c of m4.update(state, events, dt)) for (const sc of m4Sounds(c)) playCue(sc, state);
        for (const c of drone.cues(state, dt)) playCue(c, state);
        // Waves have no sim events: they show up as arena state changes.
        const w = waves.update(readArena(state));
        if (w.transition === 'started') play('waveStart');
        else if (w.transition === 'cleared') play('waveCleared');
      } catch {
        // Never break the frame.
      }
    },
    unlock() {
      if (!engine && !loading) {
        void boot().then(() => {
          resume();
          const queued = pending;
          pending = [];
          for (const [id, opts] of queued) play(id, opts);
        });
      } else resume();
    },
    setVolume(v) {
      volume = clamp01(v);
      applyVolume();
    },
    get volume() {
      return volume;
    },
    play,
  };
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}
