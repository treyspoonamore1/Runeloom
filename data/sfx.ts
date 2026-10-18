/**
 * Sound effect presets (DESIGN §13), written as ZzFX layers with named parameters.
 * src/audio/synth.ts turns a layer into the 21 positional ZzFX arguments, mixes the layers of a
 * sound into one buffer and normalizes it to `gain`, so `gain` is the loudness knob.
 *
 * Reading guide (ZzFX units): `frequency` Hz; `attack`, `sustain`, `release`, `decay` seconds;
 * `slide` changes the pitch by about slide × 500 Hz per second; `filter` > 0 is a low-pass at
 * about 2 × filter Hz, < 0 a high-pass. Keep sounds short: nothing here is over a second.
 * Pitch variation is applied at playback (playbackRate), not baked in, so buffers are cached.
 */

export type ZzfxShape = 'sine' | 'triangle' | 'saw' | 'tan' | 'noise' | 'square';

export interface ZzfxLayer {
  /** Seconds after the sound starts at which this layer begins. Default 0. */
  at?: number;
  volume?: number;
  randomness?: number;
  frequency: number;
  attack?: number;
  sustain?: number;
  release?: number;
  shape?: ZzfxShape;
  shapeCurve?: number;
  slide?: number;
  deltaSlide?: number;
  pitchJump?: number;
  pitchJumpTime?: number;
  repeatTime?: number;
  noise?: number;
  modulation?: number;
  bitCrush?: number;
  delay?: number;
  sustainVolume?: number;
  decay?: number;
  tremolo?: number;
  filter?: number;
}

export interface SfxDef {
  layers: readonly ZzfxLayer[];
  /** Relative loudness, 0 to 1. The mixed buffer is normalized to this peak. */
  gain: number;
  /** Random pitch variation at playback, +/- this fraction. Default 0.05. */
  pitchVar?: number;
  /** Minimum ms between two plays of this sound. Default: the global minimum (30). */
  minGapMs?: number;
  /** Higher priority sounds may replace lower ones when the voice limit is reached. Default 1. */
  priority?: number;
}

const NOTE = (semitonesFromA4: number): number => 440 * 2 ** (semitonesFromA4 / 12);
// A few notes (A minor / C major flavored) so jingles are in tune with each other.
const C4 = NOTE(-9);
const E4 = NOTE(-5);
const G4 = NOTE(-2);
const A4 = 440;
const C5 = NOTE(3);
const D5 = NOTE(5);
const E5 = NOTE(7);
const G5 = NOTE(10);
const C6 = NOTE(15);

export const sfx = {
  // --- Player spells -------------------------------------------------------------------------
  /** Fire Bolt released: a soft rising zip with a spark on top. */
  boltCast: {
    gain: 0.55,
    pitchVar: 0.07,
    layers: [
      {
        volume: 0.8,
        frequency: 300,
        shape: 'triangle',
        slide: 5,
        attack: 0.004,
        sustain: 0.03,
        release: 0.14,
      },
      { at: 0.015, volume: 0.35, frequency: 880, shape: 'sine', slide: 4, release: 0.11 },
      {
        volume: 0.22,
        frequency: 1400,
        shape: 'noise',
        noise: 0.6,
        attack: 0.01,
        release: 0.12,
        filter: 1200,
      },
    ],
  },
  /** Fire Bolt hit something or a wall: a low pop and a spit of embers. */
  boltImpact: {
    gain: 0.6,
    pitchVar: 0.08,
    layers: [
      { volume: 0.9, frequency: 170, shape: 'sine', slide: -0.5, attack: 0.002, release: 0.16 },
      { volume: 0.6, frequency: 260, shape: 'noise', noise: 0.5, slide: -0.3, release: 0.2, filter: 650 },
      { at: 0.01, volume: 0.25, frequency: 1050, shape: 'triangle', slide: -3, release: 0.09 },
    ],
  },
  /** Strike swung: an airy swish that swells then fades. */
  strikeSwing: {
    gain: 0.5,
    pitchVar: 0.08,
    layers: [
      {
        volume: 0.8,
        frequency: 650,
        shape: 'sine',
        noise: 2,
        slide: -1,
        attack: 0.045,
        release: 0.13,
        filter: 3600,
      },
      { volume: 0.3, frequency: 300, shape: 'triangle', slide: 2, attack: 0.05, release: 0.12 },
    ],
  },
  /** Physical damage landed on an enemy (Strike): a woody thud with a crack. */
  strikeHit: {
    gain: 0.75,
    pitchVar: 0.08,
    layers: [
      { volume: 1, frequency: 150, shape: 'sine', slide: -1.1, attack: 0.002, release: 0.13 },
      { volume: 0.5, frequency: 900, shape: 'tan', slide: -3, release: 0.05, filter: 2200 },
      { volume: 0.3, frequency: 420, shape: 'noise', noise: 0.8, release: 0.08, filter: 2500 },
    ],
  },
  /** Fire damage on an enemy: a short sizzling pop. */
  hitFire: {
    gain: 0.5,
    pitchVar: 0.08,
    layers: [
      { volume: 0.7, frequency: 480, shape: 'triangle', slide: -2.2, attack: 0.002, release: 0.1 },
      { volume: 0.5, frequency: 1200, shape: 'noise', noise: 1, release: 0.14, filter: 1000 },
    ],
  },
  /** Frost damage on an enemy: a glassy ping. */
  hitFrost: {
    gain: 0.45,
    pitchVar: 0.06,
    layers: [
      { volume: 0.7, frequency: 1480, shape: 'sine', release: 0.18, repeatTime: 0.045, tremolo: 0.4 },
      { at: 0.02, volume: 0.45, frequency: 2220, shape: 'sine', release: 0.15 },
    ],
  },
  /** Storm damage on an enemy: a quick zap. */
  hitStorm: {
    gain: 0.5,
    pitchVar: 0.1,
    layers: [
      { volume: 0.6, frequency: 520, shape: 'saw', slide: -4, modulation: 60, release: 0.1, filter: 3200 },
      {
        volume: 0.4,
        frequency: 1700,
        shape: 'square',
        shapeCurve: 0.3,
        slide: -8,
        release: 0.06,
        filter: 4000,
      },
    ],
  },
  /** A critical hit: a bright two-note chime layered over the hit. */
  crit: {
    gain: 0.45,
    pitchVar: 0.03,
    minGapMs: 60,
    priority: 2,
    layers: [
      { volume: 0.8, frequency: C6, shape: 'sine', attack: 0.002, release: 0.22 },
      { at: 0.05, volume: 0.7, frequency: C6 * 1.5, shape: 'sine', release: 0.26 },
      { volume: 0.25, frequency: C6 * 2, shape: 'triangle', release: 0.1 },
    ],
  },

  // --- Ailments (DESIGN §6.4) -------------------------------------------------------------------
  // Quiet and short: ailments fire often, so none of these may become fatiguing in a crowd.
  /** Ignite took hold: a soft low "whoomp" of catching flame. */
  igniteApply: {
    gain: 0.38,
    pitchVar: 0.08,
    minGapMs: 90,
    layers: [
      { volume: 0.8, frequency: 105, shape: 'sine', slide: 1.4, attack: 0.012, release: 0.17 },
      { volume: 0.6, frequency: 320, shape: 'noise', noise: 1, slide: 1.2, attack: 0.02, release: 0.24, filter: 650 },
    ],
  },
  /** A burning target's damage tick (every 0.5 s per target): a faint crackle, lowest priority. */
  burnTick: {
    gain: 0.1,
    pitchVar: 0.25,
    minGapMs: 140,
    priority: 0,
    layers: [
      { volume: 1, frequency: 1700, shape: 'noise', noise: 2, release: 0.03, filter: -1400 },
      { at: 0.045, volume: 0.6, frequency: 2300, shape: 'noise', noise: 2, release: 0.025, filter: -1600 },
    ],
  },
  /** Chill added by a frost hit: a tiny icy tinkle under the frost hit sound. */
  chillApply: {
    gain: 0.18,
    pitchVar: 0.06,
    minGapMs: 110,
    priority: 0,
    layers: [
      { volume: 0.7, frequency: NOTE(31), shape: 'sine', release: 0.1 },
      { at: 0.035, volume: 0.6, frequency: NOTE(36), shape: 'sine', release: 0.12 },
    ],
  },
  /** Frozen solid: a crisp crack with a crystalline shimmer. */
  freeze: {
    gain: 0.45,
    pitchVar: 0.05,
    minGapMs: 60,
    priority: 2,
    layers: [
      { volume: 1, frequency: 900, shape: 'noise', noise: 3, release: 0.05, filter: -2000 },
      { at: 0.02, volume: 0.6, frequency: NOTE(26), shape: 'sine', release: 0.22, repeatTime: 0.03 },
      { at: 0.035, volume: 0.45, frequency: NOTE(33), shape: 'sine', release: 0.26 },
    ],
  },
  /** Thawed: a soft slushy crack and a drip. */
  thaw: {
    gain: 0.26,
    pitchVar: 0.08,
    minGapMs: 80,
    layers: [
      { volume: 0.6, frequency: 520, shape: 'noise', noise: 1.5, release: 0.12, filter: 900 },
      { volume: 0.5, frequency: 640, shape: 'sine', slide: -2, release: 0.1 },
      { at: 0.09, volume: 0.5, frequency: 1250, shape: 'sine', slide: 4, release: 0.05 },
    ],
  },
  /** A frozen enemy shattered: a glassy burst over a small thump. */
  shatter: {
    gain: 0.6,
    pitchVar: 0.06,
    minGapMs: 40,
    priority: 3,
    layers: [
      { volume: 1, frequency: 2000, shape: 'noise', noise: 2, release: 0.22, filter: -1800 },
      { volume: 0.55, frequency: NOTE(31), shape: 'sine', release: 0.3, repeatTime: 0.04 },
      { at: 0.025, volume: 0.45, frequency: NOTE(38), shape: 'sine', release: 0.28 },
      { volume: 0.6, frequency: 150, shape: 'sine', slide: -0.5, release: 0.13 },
    ],
  },
  /** Shocked: a short electric zap. */
  shockApply: {
    gain: 0.34,
    pitchVar: 0.1,
    minGapMs: 80,
    layers: [
      { volume: 0.7, frequency: 880, shape: 'saw', slide: -6, modulation: 90, release: 0.11, filter: 3400 },
      { volume: 0.4, frequency: 2100, shape: 'square', shapeCurve: 0.3, tremolo: 0.6, release: 0.06, filter: 4000 },
    ],
  },

  // --- Enemy deaths (one per kind) -------------------------------------------------------------
  /** Tinderling: a fizzling puff of ash. */
  deathTinderling: {
    gain: 0.6,
    pitchVar: 0.1,
    layers: [
      { volume: 0.8, frequency: 520, shape: 'sine', slide: -2.4, release: 0.15 },
      { volume: 0.5, frequency: 900, shape: 'noise', noise: 1.2, attack: 0.005, release: 0.24, filter: 900 },
    ],
  },
  /** Shieldbearer: a heavy thud and a clang of the dropped shield. */
  deathShieldbearer: {
    gain: 0.8,
    pitchVar: 0.05,
    priority: 2,
    layers: [
      { volume: 1, frequency: 120, shape: 'sine', slide: -0.4, attack: 0.003, release: 0.3 },
      { at: 0.04, volume: 0.5, frequency: 520, shape: 'triangle', modulation: 20, release: 0.3 },
      { at: 0.04, volume: 0.35, frequency: 790, shape: 'sine', release: 0.26 },
      { volume: 0.4, frequency: 300, shape: 'noise', noise: 0.8, release: 0.12, filter: 1600 },
    ],
  },
  /** Ember Archer: a thin airy "oof" and a few sparks. */
  deathEmberArcher: {
    gain: 0.6,
    pitchVar: 0.08,
    layers: [
      { volume: 0.8, frequency: 720, shape: 'triangle', slide: -3, attack: 0.004, release: 0.17 },
      { volume: 0.4, frequency: 1500, shape: 'noise', noise: 1, release: 0.2, filter: 1300 },
      { at: 0.06, volume: 0.3, frequency: 1250, shape: 'sine', slide: -3, release: 0.08 },
    ],
  },
  /** Training dummy (or any kind without its own sound): a wooden tock. */
  deathDefault: {
    gain: 0.6,
    pitchVar: 0.08,
    layers: [
      { volume: 1, frequency: 210, shape: 'triangle', slide: -1, release: 0.14 },
      { volume: 0.4, frequency: 600, shape: 'noise', noise: 0.5, release: 0.09, filter: 2000 },
    ],
  },

  // --- Player -----------------------------------------------------------------------------------
  /** The player was hurt: a low, rounded "oof", clearly different from enemy hits. */
  playerHurt: {
    gain: 0.8,
    pitchVar: 0.05,
    priority: 3,
    minGapMs: 80,
    layers: [
      { volume: 0.9, frequency: 200, shape: 'triangle', slide: -0.7, attack: 0.004, release: 0.22 },
      { volume: 0.5, frequency: 100, shape: 'saw', slide: -0.2, release: 0.18, filter: 500 },
      { volume: 0.25, frequency: 800, shape: 'noise', noise: 0.8, release: 0.06, filter: 1800 },
    ],
  },
  /** The player fell: three slow falling notes and a low thump. */
  playerDeath: {
    gain: 0.75,
    pitchVar: 0.02,
    priority: 4,
    layers: [
      { volume: 0.8, frequency: A4, shape: 'triangle', attack: 0.01, release: 0.32 },
      { at: 0.14, volume: 0.8, frequency: E4 * 0.95, shape: 'triangle', release: 0.34 },
      { at: 0.3, volume: 0.9, frequency: C4 * 0.95, shape: 'triangle', release: 0.5 },
      { at: 0.3, volume: 1, frequency: 90, shape: 'sine', slide: -0.2, release: 0.4 },
    ],
  },
  /** Rewoven: a rising shimmer of notes. */
  respawn: {
    gain: 0.6,
    pitchVar: 0.02,
    priority: 4,
    layers: [
      { volume: 0.7, frequency: C4, shape: 'sine', release: 0.25 },
      { at: 0.07, volume: 0.7, frequency: E4, shape: 'sine', release: 0.25 },
      { at: 0.14, volume: 0.7, frequency: G4, shape: 'sine', release: 0.25 },
      { at: 0.21, volume: 0.8, frequency: C5, shape: 'sine', release: 0.4, delay: 0.08 },
      { at: 0.21, volume: 0.3, frequency: C6, shape: 'triangle', release: 0.3 },
    ],
  },
  /** Dodge: a soft rising whoosh. */
  dodge: {
    gain: 0.4,
    pitchVar: 0.08,
    layers: [
      {
        volume: 0.8,
        frequency: 520,
        shape: 'sine',
        noise: 1.4,
        slide: 2.5,
        attack: 0.025,
        release: 0.12,
        filter: 3500,
      },
      { volume: 0.25, frequency: 240, shape: 'triangle', slide: 2, attack: 0.03, release: 0.1 },
    ],
  },
  /** A hit was dodged through i-frames: a tiny bright "tick-ting". */
  evaded: {
    gain: 0.35,
    pitchVar: 0.04,
    minGapMs: 90,
    priority: 2,
    layers: [
      { volume: 0.7, frequency: NOTE(15), shape: 'sine', release: 0.1 },
      { at: 0.035, volume: 0.6, frequency: NOTE(22), shape: 'sine', release: 0.14 },
    ],
  },
  /** Not enough mana: a short, dull two-step down. Soft, so it doesn't nag. */
  castFailed: {
    gain: 0.4,
    pitchVar: 0.02,
    minGapMs: 120,
    layers: [
      { volume: 0.7, frequency: 233, shape: 'triangle', attack: 0.004, release: 0.07 },
      { at: 0.06, volume: 0.7, frequency: 175, shape: 'triangle', release: 0.1 },
    ],
  },

  // --- Enemy attacks ------------------------------------------------------------------------------
  /** Telegraph start, default: a quiet low swell, so the player hears danger without being nagged. */
  telegraph: {
    gain: 0.3,
    pitchVar: 0.06,
    minGapMs: 110,
    layers: [
      { volume: 0.7, frequency: 262, shape: 'triangle', slide: 1.5, attack: 0.07, release: 0.17 },
      { volume: 0.5, frequency: 277, shape: 'sine', slide: 1.5, attack: 0.07, release: 0.17 },
    ],
  },
  /** Telegraph of a quick melee nip: a short high tick. */
  telegraphNip: {
    gain: 0.22,
    pitchVar: 0.1,
    minGapMs: 130,
    layers: [{ volume: 0.7, frequency: 700, shape: 'triangle', slide: 1.5, attack: 0.03, release: 0.09 }],
  },
  /** Telegraph of the Shieldbearer's bash: lower and longer. */
  telegraphHeavy: {
    gain: 0.34,
    pitchVar: 0.04,
    minGapMs: 150,
    layers: [
      { volume: 0.8, frequency: 150, shape: 'triangle', slide: 0.8, attack: 0.12, release: 0.2 },
      { volume: 0.4, frequency: 158, shape: 'sine', slide: 0.8, attack: 0.12, release: 0.2 },
    ],
  },
  /** Telegraph of the archer's shot: a rising tension note. */
  telegraphRanged: {
    gain: 0.3,
    pitchVar: 0.04,
    minGapMs: 140,
    layers: [
      { volume: 0.7, frequency: 420, shape: 'triangle', slide: 3, attack: 0.1, release: 0.14 },
      { volume: 0.3, frequency: 840, shape: 'sine', slide: 3, attack: 0.12, release: 0.12 },
    ],
  },
  /** Ember Archer loosed an arrow: a bow twang and a flicker of fire. */
  archerShot: {
    gain: 0.55,
    pitchVar: 0.07,
    layers: [
      { volume: 0.8, frequency: 700, shape: 'triangle', slide: -4, attack: 0.002, release: 0.13 },
      { volume: 0.4, frequency: 1100, shape: 'noise', noise: 1, attack: 0.015, release: 0.15, filter: 1200 },
      { at: 0.02, volume: 0.25, frequency: 350, shape: 'sine', slide: 2, release: 0.12 },
    ],
  },
  /** Shieldbearer's bash lands: a heavy whoomp. */
  bashSwing: {
    gain: 0.6,
    pitchVar: 0.05,
    layers: [
      { volume: 0.9, frequency: 110, shape: 'sine', slide: -0.3, attack: 0.01, release: 0.22 },
      { volume: 0.4, frequency: 500, shape: 'noise', noise: 1.5, attack: 0.02, release: 0.16, filter: 700 },
    ],
  },
  /** A tinderling's nip lands: a tiny snap (the player-hurt sound carries the weight). */
  nipSnap: {
    gain: 0.25,
    pitchVar: 0.12,
    layers: [{ volume: 0.7, frequency: 900, shape: 'triangle', slide: -4, release: 0.06 }],
  },
  /** A shield blocked a projectile: a metallic tink. */
  shieldBlock: {
    gain: 0.6,
    pitchVar: 0.07,
    priority: 2,
    layers: [
      { volume: 0.7, frequency: 1180, shape: 'triangle', modulation: 30, release: 0.16 },
      { volume: 0.5, frequency: 1770, shape: 'sine', release: 0.13 },
      { volume: 0.3, frequency: 2650, shape: 'sine', release: 0.08 },
      { volume: 0.3, frequency: 1500, shape: 'noise', noise: 0.5, release: 0.03, filter: 5000 },
    ],
  },

  // --- Arena and UI -------------------------------------------------------------------------------
  /** A wave begins: three rising horn-like notes and a held fifth. */
  waveStart: {
    gain: 0.6,
    pitchVar: 0.01,
    minGapMs: 500,
    priority: 5,
    layers: [
      { volume: 0.8, frequency: C4, shape: 'triangle', attack: 0.015, release: 0.18 },
      { at: 0.11, volume: 0.8, frequency: E4, shape: 'triangle', release: 0.18 },
      { at: 0.22, volume: 0.8, frequency: G4, shape: 'triangle', release: 0.18 },
      { at: 0.33, volume: 0.9, frequency: C5, shape: 'triangle', attack: 0.02, sustain: 0.1, release: 0.4 },
      { at: 0.33, volume: 0.45, frequency: G5, shape: 'sine', attack: 0.03, release: 0.4 },
    ],
  },
  /** Wave cleared: a bright, ringing chime. */
  waveCleared: {
    gain: 0.6,
    pitchVar: 0.01,
    minGapMs: 500,
    priority: 5,
    layers: [
      { volume: 0.8, frequency: C5, shape: 'sine', release: 0.35 },
      { at: 0.09, volume: 0.8, frequency: E5, shape: 'sine', release: 0.35 },
      { at: 0.18, volume: 0.8, frequency: G5, shape: 'sine', release: 0.35 },
      { at: 0.3, volume: 0.9, frequency: C6, shape: 'sine', release: 0.55, delay: 0.1 },
      { at: 0.3, volume: 0.35, frequency: D5 * 4, shape: 'triangle', release: 0.3 },
    ],
  },
  /** UI click (menus, slider release). */
  uiClick: {
    gain: 0.4,
    pitchVar: 0.03,
    minGapMs: 40,
    layers: [{ volume: 0.7, frequency: 880, shape: 'sine', attack: 0.002, release: 0.05 }],
  },
  /** Start screen "Click to play": a warm rising shimmer. */
  uiStart: {
    gain: 0.55,
    pitchVar: 0,
    minGapMs: 300,
    priority: 5,
    layers: [
      { volume: 0.7, frequency: A4 / 2, shape: 'triangle', slide: 0.8, attack: 0.02, release: 0.3 },
      { at: 0.1, volume: 0.7, frequency: E5, shape: 'sine', release: 0.3 },
      { at: 0.18, volume: 0.7, frequency: A4 * 2, shape: 'sine', release: 0.45, delay: 0.08 },
    ],
  },
} satisfies Record<string, SfxDef>;

export type SfxId = keyof typeof sfx;

/** Telegraph sound by enemy attack name (AttackDef.name); other attacks use `telegraph`. */
export const telegraphSfx: Record<string, SfxId> = {
  nip: 'telegraphNip',
  shield_bash: 'telegraphHeavy',
  fire_arrow: 'telegraphRanged',
};

/** Sound when an enemy attack lands, by attack name. Unlisted attacks are silent. */
export const attackSfx: Record<string, SfxId> = {
  nip: 'nipSnap',
  shield_bash: 'bashSwing',
  fire_arrow: 'archerShot',
};

/** Death sound by enemy kind; other kinds use `deathDefault`. */
export const deathSfx: Record<string, SfxId> = {
  tinderling: 'deathTinderling',
  shieldbearer: 'deathShieldbearer',
  ember_archer: 'deathEmberArcher',
};

/** Hit sound on an enemy by damage type. */
export const hitSfx = {
  physical: 'strikeHit',
  fire: 'hitFire',
  frost: 'hitFrost',
  storm: 'hitStorm',
} as const satisfies Record<string, SfxId>;

/** Cast sound by spell id. */
export const castSfx: Record<string, SfxId> = {
  fire_bolt: 'boltCast',
  strike: 'strikeSwing',
};

/** Sound when an ailment takes hold or gets stronger, by ailment. */
export const ailmentSfx = {
  ignite: 'igniteApply',
  chill: 'chillApply',
  shock: 'shockApply',
} as const satisfies Record<string, SfxId>;

/** Projectile impact sound by projectile kind (player projectiles only). */
export const impactSfx: Record<string, SfxId> = {
  fire_bolt: 'boltImpact',
};

/** Global tuning for the audio system (DESIGN §13). */
export const audioTuning = {
  /** Simultaneous sounds. */
  maxVoices: 24,
  /** Minimum ms between two plays of the same sound, unless the preset overrides it. */
  minGapMs: 30,
  /** ZzFX's own master (its default is 0.3); the player's volume setting scales on top. */
  zzfxMaster: 0.5,
  /** Panning at the screen edge, 0 to 1. Distance is in cells (the view is about 160 wide). */
  panRange: 0.6,
  panDistance: 80,
  /** Sounds this far away (cells) are attenuated down to `farGain`. */
  fadeDistance: 90,
  farGain: 0.45,
} as const;
