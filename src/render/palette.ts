/**
 * Purely visual constants for the M0 renderer: colors, line weights and
 * animation amplitudes. Gameplay-relevant camera numbers live in data/tuning.ts.
 * Lengths are in cells (1 cell = 8 px at 720p), times in seconds.
 */

/** Warm, bright terrain palette (DESIGN §15). */
export const PAL = {
  /** Outside the room. */
  void: 0x1d1622,
  /** The thick dark outline every shape shares. */
  ink: 0x2a1c1f,

  stone: [0xf1dbab, 0xeed6a4, 0xf4e0b4, 0xebd3a0] as const,
  stoneGrout: 0xdcc08e,
  stoneChip: 0xd2b480,

  dirt: [0xd39d64, 0xcf9860, 0xd7a46b] as const,
  dirtPebble: 0xa8774a,
  dirtEdge: 0x9a6a3e,

  grass: [0x8ad65e, 0x8eda62, 0x86d15a] as const,
  grassBlade: 0x4e9a38,
  grassBladeLight: 0xb4ec84,
  grassEdge: 0x4a8c34,

  shallow: 0x66d2e8,
  shallowShade: 0x4cbad6,
  shallowRipple: 0xe6fbff,
  deep: 0x2d78cc,
  deepShade: 0x2160ad,
  deepRipple: 0x7fc0f5,
  foam: 0xf6fdff,

  wallTop: 0xec9a66,
  wallTopLight: 0xffc28e,
  wallFront: 0x9a4c35,
  wallSeam: 0x6e3222,
  wallChip: 0xdb8957,

  /** Generic raised block for non-walkable tiles without their own look. */
  blockTop: 0xa99bc0,
  blockFront: 0x6f6190,

  crateTop: 0xd9a35a,
  crateTopDark: 0xb98340,
  crateFront: 0x8f5c2c,

  brazierStone: 0x8f8794,
  brazierRim: 0x6b6273,
  brazierCoal: 0x5a2a1a,
  flameOuter: 0xff7a2f,
  flameInner: 0xffd75a,
  flameCore: 0xfff4c4,

  loomStone: 0xb8b3c9,
  loomStoneRune: 0xffd76a,

  shadow: 0x2a1c1f,
} as const;

/** Base colors for ground materials M0 had no look for (the M3 terrain shader builds on them). */
export const FLAT_GROUND: Record<string, number> = {
  wood_bridge: 0xb7814c,
  wood_floor: 0xc48d55,
  metal_floor: 0xa7b1b8,
  oil: 0x3a2a4a,
  oil_water: 0x3f5a8a,
  ice: 0xc9f1ff,
  mud: 0x8a6440,
  pit: 0x140f18,
};

/** Top colors for raised non-walkable tiles without their own look. */
export const RAISED_TOP: Record<string, number> = {
  metal_pylon: 0x9aa6b2,
  bramble: 0x4f7d3a,
  door: 0xb07a45,
  locked_door: 0x9a6a3a,
  big_key_door: 0x8c5aa8,
};

/** Line weights in cells. */
export const LINE = {
  /** Outline around raised blocks, props and deep water. */
  outline: 0.42,
  /** Boundary between two walkable ground types. */
  groundEdge: 0.22,
  /** Seams and other interior details. */
  detail: 0.16,
};

/** Wall and block geometry in cells (a tile is 4 cells). */
export const BLOCK = {
  /** Height of the darker front face at the bottom of a raised tile with open ground below. */
  front: 1.5,
  /** Shadow strip cast on the ground south of a raised tile. */
  shadow: 1.2,
  shadowAlpha: 0.2,
};

/** The Loomwright (player) look and procedural animation. */
export const PLAYER = {
  ink: 0x1f1628,
  cloak: 0x3d4cb0,
  cloakShade: 0x2c3886,
  trim: 0xf4c54f,
  hood: 0x4757c0,
  hoodInner: 0x1b1733,
  eye: 0xffe9a8,
  staff: 0x8a5a34,
  spindle: 0xf4c54f,
  thread: 0xfff2c2,
  ghost: 0xa9c4ff,
  iframeRim: 0xd6f6ff,
  pipFull: 0xffd76a,
  pipEmpty: 0x2a1c1f,

  /** Visual body radius; the collision radius comes from tuning. */
  bodyRx: 1.55,
  bodyRy: 1.4,
  hoodR: 1.0,
  /** Hood center above the body center. */
  hoodY: -1.05,
  outline: 0.32,

  /** Bob height while running, cells. */
  bobHeight: 0.32,
  /** Cells travelled per bob. */
  bobStride: 3.2,
  /** Hood shift into the movement direction at full speed, cells. */
  leanShift: 0.32,
  /** Body tilt at full sideways speed, radians. */
  leanTilt: 0.14,
  /** Seconds for lean and run blend to follow velocity. */
  leanSmoothing: 0.07,
  /** Idle breathing scale amplitude and frequency (Hz). */
  breathAmp: 0.025,
  breathHz: 0.6,

  /** Squash-and-stretch spring: frequency (Hz), damping ratio, kicks (deformation per second). */
  springHz: 4.5,
  springDamping: 0.42,
  dodgeKick: 7.5,
  landKick: -6,
  deformMin: -0.3,
  deformMax: 0.42,

  /** Afterimages: seconds between ghosts, ghost lifetime, starting alpha. */
  ghostEvery: 0.022,
  ghostLife: 0.16,
  ghostAlpha: 0.5,
  ghostPool: 10,

  /** I-frame shimmer frequency (Hz) and minimum alpha. */
  iframeHz: 14,
  iframeMinAlpha: 0.6,

  /** Dodge pips: offset below the feet, radius, spacing; alpha when all charges are full. */
  pipY: 2.35,
  pipR: 0.34,
  pipGap: 0.95,
  pipIdleAlpha: 0.4,
};

/** Debug overlay colors. */
export const OVERLAY = {
  grid: 0xffffff,
  gridAlpha: 0.12,
  tileGridAlpha: 0.28,
  solid: 0xff3b6b,
  solidAlpha: 0.22,
  hitbox: 0x5dff8a,
  hitboxDodge: 0xffe14a,
  hitboxIframes: 0x7fe9ff,
  aimLine: 0xffffff,
};

/** Render-side hash of integer coordinates to [0, 1). Never use the sim Rng for visuals. */
export function hash2(x: number, y: number, salt = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(salt | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Picks an entry from a list with a hash in [0, 1). */
export function pick<T>(list: readonly T[], h: number): T {
  return list[Math.min(list.length - 1, Math.floor(h * list.length))]!;
}
