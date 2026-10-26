import { FEN_LOOK } from './fenBeastPalette';

/**
 * Colors and feel values for the M4 enemies (CONTENT §5), their rarity looks and boss moments.
 * Purely presentational. Bodies stay off the element colors at full saturation (DESIGN §14):
 * tar is a warm brown-black (not Oil's #3A2A4A), the wisp a pale lavender (not Frost's #8FE3FF),
 * the Stormcaller slate and brass (Storm yellow only in its sparks).
 */

/**
 * Per-kind art: the collision radius the drawing was made for (the view scales the art by
 * radius ÷ art radius, so a different sim radius still fits), shadow, feet height (lift pivot),
 * a speed hint for gallery and fallback animation, and where effects sit (BodyBox).
 */
export interface M4Look {
  radius: number;
  shadowRx: number;
  shadowRy: number;
  shadowY: number;
  foot: number;
  speed: number;
  box: { w: number; top: number; bottom: number };
}

const M4_BASE_LOOK = {
  bog_lurker: {
    radius: 1.8,
    shadowRx: 2.1,
    shadowRy: 0.8,
    shadowY: 1.1,
    foot: 1.2,
    speed: 14,
    box: { w: 2, top: -2.1, bottom: 1.4 },
  },
  tar_hulk: {
    radius: 2.6,
    shadowRx: 3.2,
    shadowRy: 1.25,
    shadowY: 2.0,
    foot: 2.1,
    speed: 9,
    box: { w: 2.9, top: -4.1, bottom: 2.3 },
  },
  frost_wisp: {
    radius: 1.3,
    shadowRx: 1.2,
    shadowRy: 0.5,
    shadowY: 1.9,
    foot: 1.0,
    speed: 18,
    box: { w: 1.3, top: -3.0, bottom: 0.9 },
  },
  stormcaller: {
    radius: 1.5,
    shadowRx: 1.6,
    shadowRy: 0.7,
    shadowY: 1.3,
    foot: 1.4,
    speed: 14,
    box: { w: 1.3, top: -2.9, bottom: 1.5 },
  },
  kiln_mite: {
    radius: 0.6,
    shadowRx: 1.0,
    shadowRy: 0.42,
    shadowY: 0.55,
    foot: 0.6,
    speed: 26,
    box: { w: 0.95, top: -1.3, bottom: 0.7 },
  },
  brood_kiln: {
    radius: 2.0,
    shadowRx: 2.7,
    shadowRy: 1.0,
    shadowY: 1.9,
    foot: 2.0,
    speed: 0,
    box: { w: 2.4, top: -4.4, bottom: 2.1 },
  },
  tar_matriarch: {
    radius: 4.0,
    shadowRx: 4.9,
    shadowRy: 1.9,
    shadowY: 3.2,
    foot: 3.3,
    speed: 8,
    box: { w: 4.5, top: -7.0, bottom: 3.6 },
  },
  cinder_warden: {
    radius: 4.5,
    shadowRx: 5.2,
    shadowRy: 2.0,
    shadowY: 3.6,
    foot: 3.7,
    speed: 12,
    box: { w: 4.8, top: -8.2, bottom: 4.0 },
  },
} as const satisfies Record<string, M4Look>;

/** The M4 kinds and, since M8, the Glasswater Fen kinds (fenBeastPalette.ts): one bestiary. */
export const M4_LOOK = { ...M4_BASE_LOOK, ...FEN_LOOK } as const;

export type M4Kind = keyof typeof M4_LOOK;

export function isM4Kind(kind: string): kind is M4Kind {
  return Object.prototype.hasOwnProperty.call(M4_LOOK, kind);
}

export const BESTIARY = {
  bog_lurker: {
    skin: 0x5d7a46,
    skinShade: 0x46613a,
    skinLight: 0x86a35c,
    belly: 0xc9c27a,
    moss: 0x3f5a2e,
    eye: 0xfff07a,
    pupil: 0x1d1418,
    mouth: 0x6a2a34,
    tooth: 0xfff4dc,
    ripple: 0xeefcff,
    bubble: 0xdff6ff,
  },
  tar: {
    body: 0x3a2b2a,
    shade: 0x281d1e,
    light: 0x5c4743,
    sheen: 0x9a83a8,
    eye: 0xffb84a,
    drip: 0x2a1f20,
    crack: 0xff7a2f,
    crackHot: 0xffe08a,
    stone: 0x8a7a70,
  },
  frost_wisp: {
    body: 0xe6e8f6,
    shade: 0xb4b8d8,
    deep: 0x8a8fbc,
    crystal: 0xf4f7ff,
    crystalShade: 0xa9b3d9,
    core: 0x3c3f6e,
    eye: 0xdff8ff,
    glow: 0xcfe8ff,
  },
  stormcaller: {
    robe: 0x4a4f6e,
    robeShade: 0x363a54,
    trim: 0xd9b25a,
    hood: 0x2e3046,
    hoodInner: 0x14141f,
    eye: 0xfff1a0,
    staff: 0x8a5d3b,
    staffLight: 0xb8844f,
    metal: 0xb8c0cc,
    orb: 0xfff6c0,
  },
  kiln_mite: {
    shell: 0xb5653a,
    shellShade: 0x8a4628,
    shellLight: 0xe0915a,
    glow: 0xffc45a,
    leg: 0x2a1c1f,
  },
  brood_kiln: {
    brick: 0xb0603c,
    brickShade: 0x8a4630,
    brickLight: 0xd98a5a,
    mortar: 0x6a3424,
    base: 0x6f6168,
    baseShade: 0x51464e,
    mouth: 0x1d1014,
    fire: 0xff9a4a,
    fireHot: 0xffe9a0,
    frost: 0xe8f8ff,
    frostShade: 0xa8d4ea,
  },
  cinder_warden: {
    iron: 0x4b4350,
    ironShade: 0x35303a,
    ironLight: 0x6e6676,
    rim: 0x8a7f86,
    seam: 0xff8a3a,
    seamHot: 0xfff0b0,
    seamCold: 0x8a3a2a,
    horn: 0xd8c9b0,
    eye: 0xffe9a0,
    flameOuter: 0xff8a3a,
    flameInner: 0xffd25a,
    flameCore: 0xfff4c4,
    heat: 0xffb050,
    steam: 0xf2f2f6,
    wet: 0x7d9cc4,
  },
} as const;

/** Monster rarity looks (CONTENT §5): Magic blue, Rare yellow. */
export const RARITY = {
  magic: 0x7f9cff,
  rare: 0xffcf3a,
  /** Aura ring: ground ellipse scale over the body's shadow, alpha, pulse Hz and depth. */
  ringScale: 1.25,
  ringAlpha: 0.9,
  pulseHz: 0.9,
  pulseDepth: 0.25,
  /** Rares also get a soft ground glow under the ring. */
  rareGlowAlpha: 0.35,
  /** Name plate: font px at 720p, max plates on screen (nearest first), offset above the head (cells). */
  plateSize: 12,
  plateMax: 6,
  plateGap: 0.9,
  plateBg: 0x1d1622,
  plateBgAlpha: 0.78,
  plateText: 0xffe58a,
  plateMods: 0xf2e6c8,
} as const;

/** Animation feel for the M4 kinds (cells, seconds). */
export const BEAST_FEEL = {
  /** Bog Lurker: seconds to rise or sink, ripple rings per second (idle, telegraph). */
  lurkerRise: 0.12,
  lurkerSink: 0.35,
  rippleIdle: 0.8,
  rippleTell: 5,
  /** Frost Wisp: hover height and bob. */
  wispHover: 1.5,
  wispBob: 0.25,
  wispBobHz: 0.8,
  /** Tar Hulk drips per second and the fuse's pulse rate at start and end (Hz). */
  dripRate: 1.6,
  fuseHz0: 3,
  fuseHz1: 12,
  /** Kiln: glow ramp over the last fraction of its 5 s cycle and the spawn flash seconds. */
  kilnCycle: 5,
  kilnRamp: 0.35,
  kilnFlash: 0.4,
  /** Warden: heat aura pulse (Hz), steam puffs per second in phase 2, seam glow by state. */
  heatHz: 1.6,
  steamRate: 6,
  /** Boss death: white flash, slow shock rings and ember pillar seconds. */
  bossFlash: 0.18,
  bossRings: 1.4,
  bossPillar: 1.8,
} as const;
