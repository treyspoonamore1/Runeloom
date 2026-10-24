/**
 * Sound effect presets for the Hearth (M7, DESIGN §13): its stations, buildings, the Hearth
 * lighting, Embers and expeditions. Same conventions as data/sfx.ts; routed by
 * src/audio/hearthCues.ts (and m4Cues.ts for Ember pickups). Soft and short on purpose: the hub
 * has no ambience or music bed, and Embers drop by the dozen, so their tick is barely there.
 * Unheard so far: tune by ear after a playtest.
 */
import type { SfxDef } from './sfx';

const NOTE = (semitonesFromA4: number): number => 440 * 2 ** (semitonesFromA4 / 12);
const C5 = NOTE(3);
const E5 = NOTE(7);
const G5 = NOTE(10);
const A4 = 440;
const C6 = NOTE(15);
const E6 = NOTE(19);
const F4 = NOTE(-4);
const A3 = NOTE(-12);

export const sfxHearth = {
  /** Interact at a station: a soft two-note chime. */
  stationUse: {
    gain: 0.26,
    pitchVar: 0.01,
    minGapMs: 250,
    layers: [
      { volume: 0.7, frequency: E5, shape: 'sine', attack: 0.005, release: 0.25 },
      { at: 0.06, volume: 0.55, frequency: A4 * 2, shape: 'sine', attack: 0.005, release: 0.35 },
    ],
  },
  /** A building rises a level: a warm rising major chord (F, A, C, then a high C). No bass. */
  buildingUpgrade: {
    gain: 0.4,
    pitchVar: 0,
    minGapMs: 400,
    priority: 3,
    layers: [
      { volume: 0.5, frequency: F4, shape: 'triangle', attack: 0.02, sustain: 0.1, release: 0.45 },
      { at: 0.08, volume: 0.5, frequency: A4, shape: 'triangle', attack: 0.02, sustain: 0.1, release: 0.45 },
      { at: 0.16, volume: 0.5, frequency: C5, shape: 'triangle', attack: 0.02, sustain: 0.12, release: 0.5 },
      { at: 0.26, volume: 0.45, frequency: C6, shape: 'sine', attack: 0.02, sustain: 0.1, release: 0.6, tremolo: 0.15 },
    ],
  },
  /** The Cinder Warden lit the Hearth: a slow warm swell with a soft crackle, rising to a held fifth. */
  hearthLit: {
    gain: 0.45,
    pitchVar: 0,
    minGapMs: 2000,
    priority: 5,
    layers: [
      { volume: 0.4, frequency: A3 * 2, shape: 'sine', attack: 0.45, sustain: 0.3, release: 0.5, slide: 0.05 },
      { at: 0.1, volume: 0.4, frequency: E5, shape: 'sine', attack: 0.4, sustain: 0.3, release: 0.5, tremolo: 0.2 },
      { at: 0.35, volume: 0.35, frequency: A4 * 2, shape: 'sine', attack: 0.15, sustain: 0.2, release: 0.5 },
      { volume: 0.1, frequency: 2500, shape: 'noise', noise: 2, attack: 0.3, sustain: 0.3, release: 0.4, filter: -1800 },
    ],
  },
  /** An Ember picked up: a tiny warm tick, rate-limited (dozens drop). */
  emberPickup: {
    gain: 0.12,
    pitchVar: 0.12,
    minGapMs: 90,
    layers: [{ volume: 1, frequency: 1500, shape: 'sine', slide: 2, release: 0.035 }],
  },
  /** An expedition came back: a small bell. */
  expeditionBell: {
    gain: 0.34,
    pitchVar: 0.01,
    minGapMs: 600,
    priority: 2,
    layers: [
      { volume: 0.7, frequency: G5, shape: 'sine', attack: 0.003, release: 0.6, tremolo: 0.1 },
      { volume: 0.25, frequency: G5 * 2.4, shape: 'sine', attack: 0.003, release: 0.3 },
      { at: 0.12, volume: 0.45, frequency: E6, shape: 'sine', attack: 0.003, release: 0.5 },
    ],
  },
} satisfies Record<string, SfxDef>;

export type HearthSfxId = keyof typeof sfxHearth;
