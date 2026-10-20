/**
 * M4 sound presets for fights and moments: the new enemies' windups and impacts, boss stings,
 * phases and deaths, level ups, room changes and respawns. Merged into data/sfxM4.ts.
 */
import type { SfxDef } from './sfx';

const NOTE = (semitonesFromA4: number): number => 440 * 2 ** (semitonesFromA4 / 12);
const A2 = NOTE(-24);
const E3 = NOTE(-17);
const C4 = NOTE(-9);
const E4 = NOTE(-5);
const G4 = NOTE(-2);
const A4 = 440;
const C5 = NOTE(3);
const E5 = NOTE(7);
const G5 = NOTE(10);
const C6 = NOTE(15);

export const sfxM4Fights = {
  // ---- Enemy windups and impacts ----------------------------------------------------------------
  lurkerRipple: {
    gain: 0.3,
    minGapMs: 150,
    layers: [
      {
        volume: 1,
        frequency: 300,
        shape: 'sine',
        noise: 0.8,
        attack: 0.1,
        sustain: 0.3,
        release: 0.3,
        tremolo: 0.8,
        filter: 900,
      },
    ],
  },
  lurkerSplash: {
    gain: 0.4,
    minGapMs: 100,
    layers: [
      { volume: 1, frequency: 600, shape: 'noise', noise: 1.8, attack: 0.005, release: 0.25, filter: 1500 },
    ],
  },
  slamGrunt: {
    gain: 0.32,
    pitchVar: 0.08,
    minGapMs: 120,
    layers: [
      {
        volume: 1,
        frequency: 110,
        shape: 'saw',
        slide: -0.3,
        attack: 0.05,
        sustain: 0.1,
        release: 0.15,
        filter: 500,
      },
    ],
  },
  slamImpact: {
    gain: 0.5,
    pitchVar: 0.06,
    minGapMs: 90,
    priority: 2,
    layers: [
      { volume: 1, frequency: 70, shape: 'sine', slide: -0.4, release: 0.25 },
      { volume: 0.6, frequency: 400, shape: 'noise', noise: 1, release: 0.2, filter: 700 },
    ],
  },
  frostLineCharge: {
    gain: 0.3,
    minGapMs: 150,
    layers: [
      {
        volume: 1,
        frequency: 1800,
        shape: 'sine',
        slide: 2,
        attack: 0.2,
        sustain: 0.3,
        release: 0.2,
        tremolo: 0.5,
      },
    ],
  },
  stormCharge: {
    gain: 0.3,
    minGapMs: 120,
    layers: [
      {
        volume: 1,
        frequency: 300,
        shape: 'saw',
        slide: 6,
        attack: 0.3,
        sustain: 0.4,
        release: 0.2,
        modulation: 40,
        filter: 3000,
      },
    ],
  },
  thunder: {
    gain: 0.55,
    pitchVar: 0.08,
    minGapMs: 100,
    priority: 3,
    layers: [
      { volume: 1, frequency: 2000, shape: 'noise', noise: 3, release: 0.08, filter: -1500 },
      { at: 0.03, volume: 0.9, frequency: 120, shape: 'noise', noise: 1, release: 0.5, filter: 400 },
    ],
  },
  tarGloop: {
    gain: 0.35,
    pitchVar: 0.1,
    minGapMs: 100,
    layers: [{ volume: 1, frequency: 200, shape: 'sine', slide: -2, release: 0.15, tremolo: 0.6 }],
  },
  summonGurgle: {
    gain: 0.4,
    minGapMs: 500,
    priority: 3,
    layers: [
      {
        volume: 1,
        frequency: 90,
        shape: 'saw',
        attack: 0.2,
        sustain: 0.5,
        release: 0.3,
        tremolo: 0.9,
        filter: 600,
      },
    ],
  },
  chargeRoar: {
    gain: 0.45,
    minGapMs: 300,
    priority: 3,
    layers: [
      {
        volume: 0.8,
        frequency: 80,
        shape: 'saw',
        slide: 0.5,
        attack: 0.15,
        sustain: 0.4,
        release: 0.3,
        filter: 700,
      },
      {
        volume: 0.4,
        frequency: 600,
        shape: 'noise',
        noise: 1.5,
        attack: 0.2,
        sustain: 0.4,
        release: 0.3,
        filter: 900,
      },
    ],
  },
  fireWhoosh: {
    gain: 0.42,
    minGapMs: 200,
    priority: 2,
    layers: [
      {
        volume: 1,
        frequency: 300,
        shape: 'noise',
        noise: 1.5,
        slide: 2.5,
        attack: 0.15,
        sustain: 0.2,
        release: 0.25,
        filter: 1100,
      },
    ],
  },
  stormBuild: {
    gain: 0.45,
    minGapMs: 800,
    priority: 3,
    layers: [
      {
        volume: 1,
        frequency: 200,
        shape: 'saw',
        slide: 4,
        attack: 0.6,
        sustain: 0.3,
        release: 0.25,
        modulation: 30,
        tremolo: 0.6,
        filter: 2500,
      },
    ],
  },
  fuseSizzle: {
    gain: 0.4,
    minGapMs: 200,
    priority: 3,
    layers: [
      {
        volume: 1,
        frequency: 3200,
        shape: 'noise',
        noise: 3,
        attack: 0.02,
        sustain: 0.8,
        release: 0.1,
        tremolo: 0.9,
        filter: -2000,
      },
    ],
  },
  kilnHatch: {
    gain: 0.32,
    pitchVar: 0.08,
    minGapMs: 200,
    layers: [
      { volume: 0.8, frequency: 160, shape: 'tan', slide: 1, release: 0.1, filter: 900 },
      { at: 0.05, volume: 0.5, frequency: 2500, shape: 'noise', noise: 2, release: 0.25, filter: -2000 },
    ],
  },

  // ---- Bosses and moments -----------------------------------------------------------------------
  /** A boss is in the room: a short minor stab. */
  bossSting: {
    gain: 0.5,
    pitchVar: 0,
    minGapMs: 3000,
    priority: 5,
    layers: [
      { volume: 0.8, frequency: A2, shape: 'saw', attack: 0.02, sustain: 0.5, release: 0.8, filter: 700 },
      { volume: 0.6, frequency: E3, shape: 'saw', attack: 0.02, sustain: 0.5, release: 0.8, filter: 800 },
      { volume: 0.5, frequency: C4, shape: 'triangle', attack: 0.04, sustain: 0.4, release: 0.8 },
    ],
  },
  bossPhase: {
    gain: 0.55,
    pitchVar: 0,
    minGapMs: 1000,
    priority: 5,
    layers: [
      { volume: 1, frequency: 55, shape: 'sine', slide: -0.2, attack: 0.02, sustain: 0.3, release: 0.6 },
      {
        volume: 0.6,
        frequency: 300,
        shape: 'noise',
        noise: 1,
        attack: 0.05,
        sustain: 0.3,
        release: 0.5,
        filter: 500,
      },
    ],
  },
  bossDeath: {
    gain: 0.6,
    pitchVar: 0,
    minGapMs: 2000,
    priority: 6,
    layers: [
      { volume: 1, frequency: 60, shape: 'sine', slide: -0.3, attack: 0.01, sustain: 0.4, release: 1.0 },
      {
        volume: 0.8,
        frequency: 500,
        shape: 'noise',
        noise: 1.5,
        slide: -1,
        sustain: 0.3,
        release: 1.0,
        filter: 900,
      },
      { at: 0.5, volume: 0.5, frequency: E4, shape: 'sine', release: 0.8 },
      { at: 0.65, volume: 0.5, frequency: A4, shape: 'sine', release: 0.9 },
    ],
  },
  superheatOn: {
    gain: 0.45,
    minGapMs: 500,
    priority: 3,
    layers: [
      {
        volume: 1,
        frequency: 200,
        shape: 'noise',
        noise: 1.5,
        slide: 1.5,
        attack: 0.2,
        sustain: 0.3,
        release: 0.3,
        filter: 1000,
      },
    ],
  },
  superheatOff: {
    gain: 0.45,
    minGapMs: 500,
    priority: 3,
    layers: [
      {
        volume: 1,
        frequency: 3000,
        shape: 'noise',
        noise: 3,
        attack: 0.01,
        sustain: 0.3,
        release: 0.4,
        filter: -2200,
      },
      { volume: 0.6, frequency: 240, shape: 'tan', slide: -2, release: 0.1, filter: 2000 },
    ],
  },
  flood: {
    gain: 0.45,
    minGapMs: 1000,
    priority: 3,
    layers: [
      {
        volume: 1,
        frequency: 400,
        shape: 'noise',
        noise: 1.5,
        attack: 0.3,
        sustain: 0.4,
        release: 0.3,
        filter: 1200,
        tremolo: 0.3,
      },
    ],
  },
  levelUp: {
    gain: 0.55,
    pitchVar: 0,
    minGapMs: 800,
    priority: 5,
    layers: [
      { volume: 0.8, frequency: C5, shape: 'triangle', release: 0.18 },
      { at: 0.09, volume: 0.8, frequency: E5, shape: 'triangle', release: 0.18 },
      { at: 0.18, volume: 0.8, frequency: G5, shape: 'triangle', release: 0.18 },
      { at: 0.27, volume: 0.9, frequency: C6, shape: 'sine', sustain: 0.1, release: 0.5 },
      { at: 0.27, volume: 0.4, frequency: G4, shape: 'sine', sustain: 0.1, release: 0.5 },
    ],
  },
  roomEnter: {
    gain: 0.22,
    minGapMs: 500,
    layers: [
      {
        volume: 1,
        frequency: 500,
        shape: 'noise',
        noise: 1,
        slide: -1,
        attack: 0.08,
        release: 0.25,
        filter: 900,
      },
    ],
  },
  respawnLoom: {
    gain: 0.45,
    pitchVar: 0,
    minGapMs: 800,
    priority: 4,
    layers: [
      { volume: 0.6, frequency: C4, shape: 'sine', attack: 0.2, sustain: 0.2, release: 0.4 },
      { at: 0.1, volume: 0.5, frequency: G4, shape: 'sine', attack: 0.2, sustain: 0.2, release: 0.4 },
      { at: 0.25, volume: 0.5, frequency: E5, shape: 'sine', attack: 0.1, release: 0.5 },
    ],
  },
} satisfies Record<string, SfxDef>;
