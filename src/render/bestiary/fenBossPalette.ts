import type { M4Look } from './bestiaryPalette';

/**
 * Looks of the Drowned Foundry's bosses (M8; CONTENT §5, DESIGN §10.5): the Old Bellwether and
 * the Glasswater Coil. Their art is drawn small (radius 2.5) and scaled up to the sim radius by
 * EnemyView (4.5 → ×1.8, 5 → ×2), which keeps the atlas small. Bodies stay off the element
 * colors at full saturation (DESIGN §14): the Coil is pale glass with a pale lightning spine, its
 * eye a soft yellow-white; Storm yellow and violet appear only in its glows, sparks and warnings.
 */
export const FEN_BOSS_LOOK = {
  bellwether: {
    radius: 2.5,
    shadowRx: 3.1,
    shadowRy: 1.2,
    shadowY: 1.5,
    foot: 1.6,
    speed: 9,
    box: { w: 2.9, top: -3.4, bottom: 1.7 },
  },
  glasswater_coil: {
    radius: 2.5,
    shadowRx: 2.6,
    shadowRy: 1.4,
    shadowY: 0.6,
    foot: 0.7,
    speed: 16,
    box: { w: 2.6, top: -1.8, bottom: 1.2 },
  },
} as const satisfies Record<string, M4Look>;

export type FenBossKind = keyof typeof FEN_BOSS_LOOK;

export const FEN_BOSS = {
  bellwether: {
    brass: 0xa8823a,
    brassLight: 0xdcb862,
    brassDark: 0x6e5022,
    verdigris: 0x5f9e88,
    verdigrisDark: 0x3f7464,
    moss: 0x6f8a4a,
    skin: 0x6f7a62,
    skinLight: 0x8f9a7c,
    skinDark: 0x4f5846,
    belly: 0xc8c09a,
    beak: 0x8a7a58,
    eye: 0xf0dc8a,
    pupil: 0x1a1a14,
    /** Rung, toll glows: a warm bell gold; self-toll: a violet glow (Storm's glow hue, softened). */
    ring: 0xf2e6b0,
    tollGlow: 0xffd88a,
    selfToll: 0xb49cff,
    dust: 0xb8a888,
  },
  glasswater_coil: {
    glass: 0xbfe4e2,
    glassLight: 0xeefcfb,
    glassShade: 0x86bcc2,
    glassDeep: 0x4f8a96,
    fin: 0xdaf4f2,
    spine: 0xf6efb8,
    spineHot: 0xfffbe6,
    eye: 0xf4edb4,
    iris: 0xd9c86a,
    pupil: 0x1d2430,
    /** Submerged: the body is a dark shape under the water. */
    deep: 0x24485a,
    /** Submerged: the film of water drawn over its body and head. */
    water: 0x2f6fbe,
    /** Surfaced: the foam rings where it breaks the water. */
    foam: 0xf4fdff,
    iced: 0x9fd4f4,
    stranded: 0xa8b8b4,
    ripple: 0xd8f2f6,
    /** The eye's and the body pulse's glow (additive), the pylon glow. */
    glow: 0xf2e27a,
    glowViolet: 0xa48cff,
  },
} as const;

/** Feel numbers of the Fen boss rigs and warnings (seconds, cells, Hz). */
export const FEN_BOSS_FEEL = {
  /** Bellwether: shell lift when open, shiver while rung, ring waves per second while rung. */
  bellLift: 1.5,
  bellShiver: 0.05,
  bellRingHz: 1.8,
  /** Bellwether roll: shell spin (radians per cell rolled). */
  rollSpin: 0.35,
  /**
   * Coil: points of its drawn body and their spacing along the trail (cells), the neck's
   * half-width (art units; the head is 1.2) and the tail end's share of it, the swim wave.
   */
  coilSegments: 16,
  coilSpacing: 2.1,
  coilNeck: 1.05,
  coilTailWidth: 0.3,
  coilWaveHz: 1.3,
  coilWaveAmp: 0.9,
  /** Coil stranded: thrash wave speed and size. */
  thrashHz: 4.5,
  thrashAmp: 2.2,
  /** Pylon storm warning: ring radius around each pylon (its 12×12 pad, CONTENT §13.3). */
  pylonRing: 7.5,
  /** Water-glow overlays: the most cells one warning draws. */
  glowMaxCells: 4500,
} as const;
