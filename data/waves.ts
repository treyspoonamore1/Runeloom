/**
 * Arena wave composition (src/sim/world/waves.ts). Timing and spawn placement are feel values in
 * data/tuning.ts (`arena`). All numbers are first guesses for the M1 playtest.
 */
import type { EnemyKind } from './enemies';

/** How many of each kind a wave spawns. */
export type WaveComposition = Partial<Record<EnemyKind, number>>;

export interface WaveShare {
  kind: EnemyKind;
  /** Fraction of the wave's count in the first wave after `opening`. */
  start: number;
  /** Added to the fraction for every wave after that. */
  perWave: number;
  /** The fraction never goes above this. */
  max: number;
}

export interface WaveTable {
  /** Hand-made compositions for the first waves; index 0 is wave 1. */
  opening: readonly WaveComposition[];
  /** Wave n after the opening has round(base + perWave × n) enemies, capped at maxCount. */
  base: number;
  perWave: number;
  maxCount: number;
  /** Shares of the count (each rounded); the rest are `filler`. */
  shares: readonly WaveShare[];
  filler: EnemyKind;
  /** Area level rises by 1 every this many waves (DESIGN §7 scales life and damage). */
  levelEvery: number;
}

export const waveTable = {
  opening: [
    { tinderling: 6 },
    { tinderling: 8, ember_archer: 2 },
    { tinderling: 7, ember_archer: 3, shieldbearer: 2 },
  ],
  base: 6,
  perWave: 2,
  maxCount: 80,
  shares: [
    { kind: 'ember_archer', start: 0.25, perWave: 0.02, max: 0.35 },
    { kind: 'shieldbearer', start: 0.17, perWave: 0.015, max: 0.25 },
  ],
  filler: 'tinderling',
  levelEvery: 3,
} satisfies WaveTable;
