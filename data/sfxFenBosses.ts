/**
 * Sound presets of the Drowned Foundry's bosses (M8; DESIGN §13, CONTENT §5): calm, readable cues
 * for their key telegraphs, so the ear hears what the eye should look for. Same conventions as
 * data/sfx.ts; merged into data/sfxM4.ts and routed by src/audio/m4Cues.ts (attack windups) and
 * src/audio/fenBossCues.ts (the pulse and pylon glows). Soft on purpose: a fight hears them every
 * few seconds. Unheard so far: tune by ear after a playtest.
 */
import type { SfxDef } from './sfx';

const NOTE = (semitonesFromA4: number): number => 440 * 2 ** (semitonesFromA4 / 12);
const A2 = NOTE(-24);
const D3 = NOTE(-19);
const A3 = NOTE(-12);

export const sfxFenBosses = {
  /** Toll ring windup: one low struck bell, its inharmonic partials ringing out. */
  bellToll: {
    gain: 0.34,
    pitchVar: 0.02,
    minGapMs: 600,
    priority: 3,
    layers: [
      { volume: 0.8, frequency: A2, shape: 'sine', attack: 0.004, release: 1.2 },
      { volume: 0.55, frequency: A2 * 2.01, shape: 'sine', attack: 0.004, release: 0.9, tremolo: 0.1 },
      { volume: 0.35, frequency: A2 * 2.76, shape: 'sine', attack: 0.004, release: 0.6 },
      { volume: 0.2, frequency: A2 * 5.4, shape: 'sine', attack: 0.002, release: 0.3 },
      { volume: 0.15, frequency: 2400, shape: 'noise', noise: 1, release: 0.04, filter: -1600 },
    ],
  },
  /** Self-toll windup (phase 2): the bell lower and muffled, with a soft electric hum under it. */
  bellSelfToll: {
    gain: 0.32,
    pitchVar: 0.02,
    minGapMs: 600,
    priority: 3,
    layers: [
      { volume: 0.8, frequency: D3 / 2, shape: 'sine', attack: 0.004, release: 1.1 },
      { volume: 0.45, frequency: D3 * 1.0, shape: 'sine', attack: 0.004, release: 0.8 },
      { volume: 0.3, frequency: D3 * 1.38, shape: 'sine', attack: 0.004, release: 0.5 },
      { volume: 0.2, frequency: A3, shape: 'saw', attack: 0.3, sustain: 0.5, release: 0.3, tremolo: 0.5, filter: 500 },
    ],
  },
  /** The Coil's pulse glow (Eye or Body): a soft hum rising through the 1–1.2 s glow. */
  coilPulseGlow: {
    gain: 0.28,
    pitchVar: 0.01,
    minGapMs: 700,
    priority: 3,
    layers: [
      { volume: 0.8, frequency: A3, shape: 'sine', slide: 0.4, attack: 0.5, sustain: 0.45, release: 0.2, tremolo: 0.35 },
      { volume: 0.35, frequency: A3 * 1.5, shape: 'triangle', slide: 0.6, attack: 0.6, sustain: 0.35, release: 0.2 },
      { volume: 0.12, frequency: 3000, shape: 'noise', noise: 1, attack: 0.7, sustain: 0.3, release: 0.15, filter: -2500 },
    ],
  },
  /** The pylons glow before the storm: a low buzz swelling in. */
  coilPylonHum: {
    gain: 0.26,
    pitchVar: 0,
    minGapMs: 1500,
    priority: 3,
    layers: [
      { volume: 0.8, frequency: A2, shape: 'square', attack: 0.6, sustain: 0.45, release: 0.15, tremolo: 0.6, filter: 300 },
      { volume: 0.3, frequency: A2 * 2, shape: 'saw', attack: 0.7, sustain: 0.35, release: 0.15, filter: 600 },
    ],
  },
  /** A stranded Coil winds up its tail thrash: three wet slaps on stone. */
  coilThrash: {
    gain: 0.3,
    pitchVar: 0.08,
    minGapMs: 400,
    layers: [
      { volume: 1, frequency: 300, shape: 'noise', noise: 1.5, attack: 0.005, release: 0.09, filter: 700 },
      { at: 0.16, volume: 0.85, frequency: 300, shape: 'noise', noise: 1.5, attack: 0.005, release: 0.09, filter: 650 },
      { at: 0.32, volume: 0.7, frequency: 300, shape: 'noise', noise: 1.5, attack: 0.005, release: 0.11, filter: 600 },
      { volume: 0.4, frequency: 90, shape: 'sine', slide: -0.3, release: 0.2 },
    ],
  },
} satisfies Record<string, SfxDef>;
