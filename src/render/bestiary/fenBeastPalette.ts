import type { M4Look } from './bestiaryPalette';

/**
 * Looks of the M8 Glasswater Fen enemies (CONTENT §5): art radius (as data/enemiesFen.ts),
 * shadow, feet height, a speed hint and the effect box; and their colors. Bodies keep off the
 * element colors at full saturation (DESIGN §14): Storm yellow and violet only in sparks and
 * telegraphs, the slag's glow a deep amber, the spit's water a pale glass (not Tide's #2F7BFF).
 */
export const FEN_LOOK = {
  glasspike: {
    radius: 1.3,
    shadowRx: 1.5,
    shadowRy: 0.55,
    shadowY: 0.8,
    foot: 0.8,
    speed: 18,
    box: { w: 1.9, top: -1.3, bottom: 0.9 },
  },
  copperback: {
    radius: 1.8,
    shadowRx: 2.4,
    shadowRy: 0.9,
    shadowY: 1.0,
    foot: 1.0,
    speed: 12,
    box: { w: 2.6, top: -2.0, bottom: 1.2 },
  },
  spark_heron: {
    radius: 1.6,
    shadowRx: 1.6,
    shadowRy: 0.6,
    shadowY: 1.5,
    foot: 1.5,
    speed: 15,
    box: { w: 1.6, top: -5.2, bottom: 1.6 },
  },
  slagshell: {
    radius: 2.4,
    shadowRx: 3.0,
    shadowRy: 1.15,
    shadowY: 1.8,
    foot: 1.9,
    speed: 9,
    box: { w: 2.8, top: -3.6, bottom: 2.0 },
  },
  sparkfly: {
    radius: 0.7,
    shadowRx: 0.6,
    shadowRy: 0.25,
    shadowY: 1.5,
    foot: 0.5,
    speed: 24,
    box: { w: 0.9, top: -2.2, bottom: 0.2 },
  },
  mire_bull: {
    radius: 2.2,
    shadowRx: 2.8,
    shadowRy: 1.05,
    shadowY: 1.6,
    foot: 1.7,
    speed: 11,
    box: { w: 2.7, top: -3.2, bottom: 1.8 },
  },
  bellows_toad: {
    radius: 1.8,
    shadowRx: 2.1,
    shadowRy: 0.8,
    shadowY: 1.2,
    foot: 1.3,
    speed: 10,
    box: { w: 2.1, top: -2.4, bottom: 1.4 },
  },
  bellshell: {
    radius: 2.2,
    shadowRx: 2.7,
    shadowRy: 1.05,
    shadowY: 1.3,
    foot: 1.4,
    speed: 8,
    box: { w: 2.6, top: -2.9, bottom: 1.5 },
  },
} as const satisfies Record<string, M4Look>;

export type FenKind = keyof typeof FEN_LOOK;

export const FEN_BEAST = {
  glasspike: {
    glass: 0xc6ece8,
    glassShade: 0x8fcac8,
    spine: 0x4f8f96,
    fin: 0xe8fbff,
    eye: 0x1f2a36,
    tooth: 0xffffff,
    glint: 0xf6ffff,
  },
  copperback: {
    shell: 0xb0683c,
    shellLight: 0xd48a56,
    shellDark: 0x7a4426,
    verdigris: 0x5f9f8a,
    claw: 0xc07444,
    leg: 0x7a4426,
    eye: 0x1f1a1a,
    antenna: 0x4a3426,
  },
  spark_heron: {
    metal: 0x6f7f88,
    metalLight: 0x9aa9b2,
    metalDark: 0x4a5860,
    rust: 0xa8633a,
    insulator: 0xe0d8c4,
    beak: 0x8a5a36,
    leg: 0x4a5860,
    eye: 0xfff2a0,
  },
  slagshell: {
    crust: 0x4a3a36,
    crustLight: 0x6a5650,
    crustDark: 0x2c2220,
    vein: 0xff9a48,
    veinHot: 0xffd27a,
    cooled: 0x8a8580,
    crack: 0xf2eee8,
    eye: 0xffc060,
  },
  sparkfly: {
    body: 0x4a5236,
    wing: 0xe8f4ff,
    lamp: 0xe6f08a,
    lampHot: 0xfffbd0,
    eye: 0x1a1c14,
  },
  mire_bull: {
    hide: 0x6b5238,
    hideDark: 0x4a3826,
    shag: 0x8a6c4a,
    horn: 0xe2d2ac,
    hornDark: 0x9a8a6a,
    nose: 0x3a2a22,
    mud: 0x5a4430,
    eye: 0x1a1210,
  },
  bellows_toad: {
    skin: 0x6c8f4c,
    skinDark: 0x4e6c38,
    skinLight: 0x94b46a,
    throat: 0xe0e6b0,
    throatHot: 0xf6f0c0,
    wart: 0x557a3a,
    eye: 0xe8c040,
    pupil: 0x1a1a10,
  },
  bellshell: {
    brass: 0xb08a3c,
    brassLight: 0xe2c06a,
    brassDark: 0x7a5a26,
    verdigris: 0x6aa892,
    skin: 0x7a8670,
    skinDark: 0x56604e,
    eye: 0x1a1a14,
    ring: 0xf2e6b0,
  },
} as const;

/** Feel numbers of the Fen rigs (seconds, cells, Hz). */
export const FEN_FEEL = {
  /** Glasspike: leap arc height at its peak; glint twinkle rate while hidden. */
  leapHeight: 4,
  glintHz: 0.6,
  /** Copperback: antenna spark rate while Charged. */
  copperSparks: 14,
  /** Toad: how much the body swells at the end of the inflate. */
  toadSwell: 0.38,
  /** Bellshell: ring wave rate while rung, shell shiver. */
  bellRingHz: 2.2,
  bellShiver: 0.06,
  /** Mirebull: how deep it sinks when bogged. */
  bogSink: 0.7,
} as const;
