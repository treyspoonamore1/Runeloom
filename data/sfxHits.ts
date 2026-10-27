/**
 * Playtest 8 sound presets (same conventions as data/sfx.ts; merged into data/sfxM4.ts, routed by
 * src/audio/fenBossCues.ts): a dull clank for a hit a state cut a lot (Shelled, Submerged) and a
 * clear ding when charge rings a bell open. Unheard so far: tune by ear after a playtest.
 */
import type { SfxDef } from './sfx';

const NOTE = (semitonesFromA4: number): number => 440 * 2 ** (semitonesFromA4 / 12);
const D3 = NOTE(-19);
const A3 = NOTE(-12);

export const sfxHits = {
  /**
   * Playtest 8: a hit a state cut (Shelled, Submerged; 'hit' reduced): a dull, damped clank on
   * thick brass, low and short, so it reads as "that barely went in". Plays over a quieter hit sound.
   */
  shellClank: {
    gain: 0.3,
    pitchVar: 0.06,
    minGapMs: 70,
    layers: [
      { volume: 0.9, frequency: D3, shape: 'triangle', attack: 0.002, release: 0.09, slide: -0.2 },
      { volume: 0.45, frequency: D3 * 2.7, shape: 'square', attack: 0.002, release: 0.05, filter: 900 },
      { volume: 0.5, frequency: 1200, shape: 'noise', noise: 1, attack: 0.001, release: 0.04, filter: 1400 },
    ],
  },
  /**
   * Playtest 8: charge rings a bell open (Bellshell, Old Bellwether; 'bellRung'): a bright, clear
   * "ding" over its low hum, the opposite of the clank.
   */
  bellDing: {
    gain: 0.36,
    pitchVar: 0.02,
    minGapMs: 250,
    priority: 3,
    layers: [
      { volume: 0.9, frequency: A3 * 4, shape: 'sine', attack: 0.002, release: 0.9 },
      { volume: 0.5, frequency: A3 * 4 * 2.76, shape: 'sine', attack: 0.002, release: 0.5 },
      { volume: 0.35, frequency: A3 * 4 * 5.4, shape: 'sine', attack: 0.001, release: 0.25 },
      { volume: 0.45, frequency: A3, shape: 'sine', attack: 0.004, release: 1.1, tremolo: 0.1 },
      { volume: 0.2, frequency: 5000, shape: 'noise', noise: 1, release: 0.03, filter: -3000 },
    ],
  },
} satisfies Record<string, SfxDef>;
