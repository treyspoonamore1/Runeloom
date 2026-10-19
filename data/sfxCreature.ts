/**
 * Sound effect presets for entities on the chemistry grid (M3 phase B): stepping into water and
 * oil, falls, charge hits, Shock arcs, doused and relit Tinderlings and burning shields. Same
 * conventions as data/sfx.ts (ZzFX layers with named parameters, normalized to `gain`); played
 * through src/audio/creatureCues.ts. Kept quiet: several enemies can wade into water at once.
 */
import type { SfxDef } from './sfx';

export const sfxCreature = {
  /** Stepped into shallow water (became Wet): a small, soft splash. */
  stepWater: {
    gain: 0.26,
    pitchVar: 0.12,
    minGapMs: 70,
    priority: 0,
    layers: [
      { volume: 0.8, frequency: 700, shape: 'noise', noise: 1.5, attack: 0.005, release: 0.12, filter: 1400 },
      { at: 0.03, volume: 0.4, frequency: 900, shape: 'sine', slide: 3, release: 0.05 },
    ],
  },
  /** Stepped into oil (became Oiled): a low, sticky squelch. */
  oilSquelch: {
    gain: 0.28,
    pitchVar: 0.1,
    minGapMs: 80,
    priority: 0,
    layers: [
      { volume: 0.8, frequency: 180, shape: 'sine', slide: -1.2, release: 0.12, tremolo: 0.5 },
      { volume: 0.4, frequency: 400, shape: 'noise', noise: 1, release: 0.1, filter: 600 },
    ],
  },
  /** Fell into a pit or water: a falling whoosh. */
  fallWhoosh: {
    gain: 0.45,
    pitchVar: 0.05,
    minGapMs: 80,
    priority: 2,
    layers: [{ volume: 0.8, frequency: 700, shape: 'sine', noise: 2, slide: -4, attack: 0.02, release: 0.3, filter: 2400 }],
  },
  /** ... and the splash at the bottom. */
  fallSplash: {
    gain: 0.5,
    pitchVar: 0.06,
    minGapMs: 80,
    priority: 2,
    layers: [
      { at: 0.12, volume: 1, frequency: 500, shape: 'noise', noise: 1.8, attack: 0.005, release: 0.3, filter: 1200 },
      { at: 0.12, volume: 0.5, frequency: 140, shape: 'sine', slide: -0.6, release: 0.18 },
    ],
  },
  /** ... or the thud of a pit. */
  fallThud: {
    gain: 0.45,
    pitchVar: 0.06,
    minGapMs: 80,
    priority: 2,
    layers: [{ at: 0.14, volume: 1, frequency: 95, shape: 'sine', slide: -0.4, release: 0.2 }],
  },
  /** A charged-water or metal hit on a body: a dry electric zap. */
  chargeZap: {
    gain: 0.36,
    pitchVar: 0.1,
    minGapMs: 50,
    layers: [
      { volume: 0.8, frequency: 1600, shape: 'square', shapeCurve: 0.4, slide: -12, release: 0.06, filter: 4000 },
      { volume: 0.4, frequency: 3000, shape: 'noise', noise: 2, release: 0.05, filter: -2400 },
    ],
  },
  /** A Shock arc between wet bodies: a sharp crackle. */
  arcCrackle: {
    gain: 0.38,
    pitchVar: 0.12,
    minGapMs: 40,
    layers: [
      { volume: 0.8, frequency: 1100, shape: 'saw', modulation: 160, slide: -8, release: 0.1, filter: 4500 },
      { volume: 0.5, frequency: 2600, shape: 'noise', noise: 2.5, release: 0.08, tremolo: 0.8, filter: -2000 },
    ],
  },
  /** A Tinderling doused: a steamy hiss. */
  douseHiss: {
    gain: 0.36,
    pitchVar: 0.08,
    minGapMs: 60,
    layers: [{ volume: 1, frequency: 3000, shape: 'noise', noise: 3, attack: 0.01, release: 0.35, filter: -2200 }],
  },
  /** A Tinderling relit: a quick whoosh of flame. */
  relightWhoosh: {
    gain: 0.36,
    pitchVar: 0.08,
    minGapMs: 60,
    layers: [
      { volume: 0.8, frequency: 300, shape: 'noise', noise: 1.5, slide: 2.5, attack: 0.03, release: 0.18, filter: 900 },
      { volume: 0.4, frequency: 160, shape: 'sine', slide: 1, release: 0.15 },
    ],
  },
  /** A burnt shield breaks off: a woody crack. */
  shieldCrack: {
    gain: 0.55,
    pitchVar: 0.06,
    minGapMs: 80,
    priority: 2,
    layers: [
      { volume: 1, frequency: 240, shape: 'tan', slide: -2, release: 0.08, filter: 2000 },
      { volume: 0.6, frequency: 800, shape: 'noise', noise: 1.2, release: 0.18, filter: 1500 },
      { at: 0.05, volume: 0.5, frequency: 150, shape: 'triangle', slide: -0.8, release: 0.2 },
    ],
  },
} satisfies Record<string, SfxDef>;

export type CreatureSfxId = keyof typeof sfxCreature;
