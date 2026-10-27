/**
 * Sound effect presets for M4 (DESIGN §13): puzzle objects, loot, the new enemies' attacks, boss
 * moments, level ups and room transitions. Same conventions as data/sfx.ts (ZzFX layers with
 * named parameters, normalized to `gain`); routed by src/audio/m4Cues.ts. Everything is quiet and
 * rate-limited: several hulks can slam at once. Unheard so far: tune by ear after a playtest.
 */
import type { SfxDef } from './sfx';
import { sfxM4Fights } from './sfxM4Fights';
import { sfxFenBosses } from './sfxFenBosses';
import { sfxHits } from './sfxHits';
import { sfxHearth } from './sfxHearth';

const NOTE = (semitonesFromA4: number): number => 440 * 2 ** (semitonesFromA4 / 12);
const C4 = NOTE(-9);
const E4 = NOTE(-5);
const G4 = NOTE(-2);
const A4 = 440;
const C5 = NOTE(3);
const E5 = NOTE(7);
const G5 = NOTE(10);
const C6 = NOTE(15);

/** Puzzle objects and loot. */
const sfxM4World = {
  // ---- Puzzle objects --------------------------------------------------------------------------
  /** A door grinds open. */
  doorOpen: {
    gain: 0.42,
    minGapMs: 200,
    priority: 2,
    layers: [
      {
        volume: 0.8,
        frequency: 90,
        shape: 'saw',
        slide: -0.2,
        attack: 0.05,
        sustain: 0.25,
        release: 0.15,
        filter: 500,
        tremolo: 0.4,
      },
      {
        volume: 0.5,
        frequency: 300,
        shape: 'noise',
        noise: 1,
        attack: 0.05,
        sustain: 0.25,
        release: 0.2,
        filter: 700,
      },
    ],
  },
  /** A small key turns: two clicks and a clunk. */
  doorUnlock: {
    gain: 0.45,
    minGapMs: 200,
    priority: 2,
    layers: [
      { volume: 0.7, frequency: 2400, shape: 'square', release: 0.02, filter: 5000 },
      { at: 0.08, volume: 0.7, frequency: 1900, shape: 'square', release: 0.02, filter: 5000 },
      { at: 0.16, volume: 1, frequency: 140, shape: 'tan', slide: -0.4, release: 0.12, filter: 1200 },
    ],
  },
  /** The big-key door: a low rumble under a bright chime. */
  bigDoorOpen: {
    gain: 0.5,
    pitchVar: 0.01,
    minGapMs: 400,
    priority: 3,
    layers: [
      { volume: 0.9, frequency: 60, shape: 'sine', attack: 0.1, sustain: 0.4, release: 0.3, tremolo: 0.3 },
      { at: 0.1, volume: 0.6, frequency: E5, shape: 'sine', release: 0.5 },
      { at: 0.2, volume: 0.5, frequency: A4 * 2, shape: 'sine', release: 0.5 },
    ],
  },
  /** A chest lid creaks up and treasure chimes. */
  chestOpen: {
    gain: 0.5,
    pitchVar: 0.02,
    minGapMs: 300,
    priority: 3,
    layers: [
      { volume: 0.6, frequency: 180, shape: 'saw', slide: 0.6, release: 0.12, filter: 700 },
      { at: 0.12, volume: 0.7, frequency: C5, shape: 'sine', release: 0.25 },
      { at: 0.2, volume: 0.7, frequency: E5, shape: 'sine', release: 0.25 },
      { at: 0.28, volume: 0.8, frequency: G5, shape: 'sine', release: 0.4 },
    ],
  },
  /** A Heart Seed: a warm rising chime. */
  pickupHeart: {
    gain: 0.5,
    pitchVar: 0.01,
    minGapMs: 300,
    priority: 4,
    layers: [
      { volume: 0.8, frequency: E4, shape: 'triangle', release: 0.25 },
      { at: 0.1, volume: 0.8, frequency: A4, shape: 'triangle', release: 0.25 },
      { at: 0.2, volume: 0.9, frequency: E5, shape: 'sine', sustain: 0.1, release: 0.45 },
    ],
  },
  /** A Loom Shard: a glassy shimmer. */
  pickupShard: {
    gain: 0.45,
    pitchVar: 0.01,
    minGapMs: 300,
    priority: 4,
    layers: [
      { volume: 0.6, frequency: G5, shape: 'sine', release: 0.5, tremolo: 0.3 },
      { at: 0.05, volume: 0.5, frequency: C6, shape: 'sine', release: 0.5, tremolo: 0.4 },
      { at: 0.1, volume: 0.3, frequency: 4000, shape: 'noise', noise: 1, release: 0.3, filter: -3000 },
    ],
  },
  /** A Loom Stone wakes: a deep, slow chord. */
  loomStone: {
    gain: 0.5,
    pitchVar: 0,
    minGapMs: 800,
    priority: 4,
    layers: [
      { volume: 0.7, frequency: C4 / 2, shape: 'sine', attack: 0.15, sustain: 0.3, release: 0.45 },
      { at: 0.05, volume: 0.5, frequency: G4 / 2, shape: 'sine', attack: 0.15, sustain: 0.3, release: 0.45 },
      { at: 0.15, volume: 0.45, frequency: E4, shape: 'triangle', attack: 0.1, sustain: 0.2, release: 0.4 },
    ],
  },
  /** A pressure plate sinks (or springs back, quieter). */
  plateClick: {
    gain: 0.4,
    minGapMs: 80,
    layers: [{ volume: 1, frequency: 220, shape: 'tan', slide: -1, release: 0.06, filter: 1600 }],
  },
  plateRelease: {
    gain: 0.25,
    minGapMs: 80,
    layers: [{ volume: 1, frequency: 320, shape: 'tan', slide: 1, release: 0.05, filter: 1600 }],
  },
  /** A conduit switch powers up (or down). */
  switchOn: {
    gain: 0.42,
    minGapMs: 150,
    priority: 2,
    layers: [
      { volume: 0.6, frequency: 120, shape: 'saw', slide: 3, attack: 0.05, release: 0.2, filter: 1500 },
      {
        at: 0.15,
        volume: 0.6,
        frequency: 1600,
        shape: 'square',
        shapeCurve: 0.4,
        slide: -10,
        release: 0.06,
        filter: 4000,
      },
    ],
  },
  switchOff: {
    gain: 0.3,
    minGapMs: 150,
    layers: [{ volume: 0.7, frequency: 400, shape: 'saw', slide: -4, release: 0.25, filter: 1200 }],
  },
  /** A stone block scrapes one tile. */
  blockPush: {
    gain: 0.38,
    minGapMs: 120,
    layers: [
      {
        volume: 1,
        frequency: 160,
        shape: 'noise',
        noise: 1.2,
        attack: 0.03,
        sustain: 0.12,
        release: 0.1,
        filter: 450,
      },
    ],
  },
  /** An ice block starts sliding. */
  iceSlide: {
    gain: 0.32,
    minGapMs: 120,
    layers: [
      {
        volume: 1,
        frequency: 2600,
        shape: 'noise',
        noise: 2,
        attack: 0.02,
        sustain: 0.25,
        release: 0.15,
        filter: -1800,
        tremolo: 0.5,
      },
    ],
  },
  /** A block comes to rest. */
  blockStop: {
    gain: 0.42,
    minGapMs: 120,
    layers: [{ volume: 1, frequency: 85, shape: 'sine', slide: -0.4, release: 0.15 }],
  },
  /** A brazier catches fire (or goes out). */
  brazierLit: {
    gain: 0.45,
    minGapMs: 120,
    priority: 2,
    layers: [
      {
        volume: 0.8,
        frequency: 250,
        shape: 'noise',
        noise: 1.5,
        slide: 2,
        attack: 0.04,
        release: 0.3,
        filter: 1000,
      },
      {
        at: 0.05,
        volume: 0.3,
        frequency: 1800,
        shape: 'noise',
        noise: 3,
        release: 0.25,
        filter: -1500,
        tremolo: 0.7,
      },
    ],
  },
  brazierOut: {
    gain: 0.3,
    minGapMs: 120,
    layers: [
      { volume: 1, frequency: 3000, shape: 'noise', noise: 3, attack: 0.01, release: 0.3, filter: -2400 },
    ],
  },

  // ---- Loot -------------------------------------------------------------------------------------
  /** Something drops: a soft clink; rare and unique drops ring. */
  lootDrop: {
    gain: 0.28,
    pitchVar: 0.1,
    minGapMs: 60,
    layers: [{ volume: 1, frequency: 1300, shape: 'triangle', release: 0.08 }],
  },
  lootDropRare: {
    gain: 0.42,
    pitchVar: 0.02,
    minGapMs: 200,
    priority: 3,
    layers: [
      { volume: 0.7, frequency: G5, shape: 'sine', release: 0.4 },
      { at: 0.07, volume: 0.6, frequency: C6, shape: 'sine', release: 0.5, tremolo: 0.2 },
    ],
  },
  lootDropUnique: {
    gain: 0.48,
    pitchVar: 0.01,
    minGapMs: 300,
    priority: 3,
    layers: [
      { volume: 0.7, frequency: A4 / 2, shape: 'sine', attack: 0.02, release: 0.6 },
      { at: 0.06, volume: 0.6, frequency: E5, shape: 'sine', release: 0.6, tremolo: 0.2 },
      { at: 0.12, volume: 0.5, frequency: A4 * 2, shape: 'sine', release: 0.6 },
    ],
  },
  /** Picked up: a quick blip (runes shimmer). */
  lootPickup: {
    gain: 0.32,
    pitchVar: 0.06,
    minGapMs: 50,
    layers: [{ volume: 1, frequency: 700, shape: 'sine', slide: 8, release: 0.08 }],
  },
  runePickup: {
    gain: 0.36,
    pitchVar: 0.04,
    minGapMs: 60,
    layers: [
      { volume: 0.8, frequency: E5, shape: 'sine', release: 0.12 },
      { at: 0.06, volume: 0.7, frequency: A4 * 2, shape: 'sine', release: 0.18 },
    ],
  },
  /**
   * The item-get fanfare for a new element rune (the dungeon-item panel opens): a bright rising
   * C major arpeggio, C5 E5 G5 to a held C6 with a soft shimmer. No bass; quiet.
   */
  elementFanfare: {
    gain: 0.4,
    pitchVar: 0,
    minGapMs: 1500,
    priority: 5,
    layers: [
      { volume: 0.55, frequency: C5, shape: 'triangle', attack: 0.01, sustain: 0.05, release: 0.18 },
      {
        at: 0.12,
        volume: 0.55,
        frequency: E5,
        shape: 'triangle',
        attack: 0.01,
        sustain: 0.05,
        release: 0.18,
      },
      { at: 0.24, volume: 0.55, frequency: G5, shape: 'triangle', attack: 0.01, sustain: 0.05, release: 0.2 },
      {
        at: 0.36,
        volume: 0.6,
        frequency: C6,
        shape: 'sine',
        attack: 0.01,
        sustain: 0.35,
        release: 0.6,
        tremolo: 0.25,
      },
      { at: 0.36, volume: 0.25, frequency: G5, shape: 'sine', attack: 0.02, sustain: 0.3, release: 0.6 },
      { at: 0.4, volume: 0.12, frequency: 6000, shape: 'noise', noise: 1, release: 0.5, filter: -4000 },
    ],
  },
} satisfies Record<string, SfxDef>;

/**
 * Every M4 preset: objects and loot here, fights and moments in sfxM4Fights.ts, the Hearth (M7) in
 * sfxHearth.ts, the Drowned Foundry's bosses (M8) in sfxFenBosses.ts, playtest 8's reduced-hit clank
 * and bell ding in sfxHits.ts.
 */
export const sfxM4 = { ...sfxM4World, ...sfxM4Fights, ...sfxHearth, ...sfxFenBosses, ...sfxHits };

export type M4SfxId = keyof typeof sfxM4;
