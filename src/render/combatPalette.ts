/**
 * Visual constants for M1 combat: enemy colors, telegraphs, projectiles, particles, damage
 * numbers and shake. Purely presentational (never read by the sim). Lengths in cells, times in
 * seconds. Enemy bodies avoid the element colors at full saturation (DESIGN §14).
 */

/** Element colors (DESIGN §14), for effects only. */
export const ELEMENT = {
  fire: 0xff7a2f,
  frost: 0x8fe3ff,
  storm: 0xf5e04a,
  stormGlow: 0x9b7bff,
} as const;

export const INK = 0x2a1c1f;

export const ENEMY = {
  outline: 0.3,
  /** Hit flash duration (DESIGN §4: 0.08 s) and the white silhouette's peak alpha. */
  flashTime: 0.08,
  flashAlpha: 0.95,
  /** Hurt recoil: render-only offset along the knockback direction, cells, and its decay (s). */
  recoil: 0.45,
  recoilDecay: 0.09,
  /** Squash spring (as PLAYER): Hz, damping, kick on hit (deformation per second). */
  springHz: 5,
  springDamping: 0.38,
  hitKick: -5.5,
  /** Windup anticipation: lean back, cells, and crouch squash. */
  windupLean: 0.45,
  windupSquash: 0.12,
  /** Bob per stride (cells) and cells travelled per bob. */
  bobHeight: 0.22,
  bobStride: 2.2,
  /** Tilt at full speed, radians. */
  leanTilt: 0.16,
  /** Seconds for facing to turn halfway. */
  turnSmoothing: 0.05,
  spawnPop: 0.22,
  /** Death: hold-and-topple seconds, then corpse fade seconds. */
  dieTime: 0.35,
  corpseHold: 0.6,
  corpseFade: 1.2,
  corpseTint: 0x8c7f8f,

  tinderling: {
    coal: 0x4b3434,
    coalShade: 0x382526,
    coalLight: 0x6e4c44,
    crack: 0xe0582e,
    eye: 0xfff2b0,
    flameOuter: 0xff9446,
    flameInner: 0xffcf63,
    flameCore: 0xfff3c6,
    glow: 0xff8a3a,
    leg: 0x2a1c1f,
  },
  shieldbearer: {
    armor: 0x6f7b8c,
    armorShade: 0x566273,
    armorLight: 0x96a2b2,
    leather: 0x8a5d3b,
    helm: 0x9aa3b2,
    helmShade: 0x7a8494,
    visor: 0x231a22,
    eye: 0xffe9a8,
    boot: 0x4a3426,
    wood: 0xb47c47,
    woodShade: 0x8f5f33,
    woodGrain: 0x7a4e2a,
    rim: 0x5f5966,
    boss: 0xa5adba,
    arcHint: 0xe9c48f,
  },
  ember_archer: {
    cloak: 0x3f7a74,
    cloakShade: 0x2e5a58,
    trim: 0xe0b866,
    hood: 0x3a3440,
    hoodInner: 0x1a1420,
    eye: 0xffb35a,
    bow: 0xc48a4a,
    bowLight: 0xf0c27a,
    string: 0xfff4dc,
    quiver: 0x6a4630,
    arrowShaft: 0x3b2a22,
    arrowTip: 0xff5a2e,
  },
  dummy: {
    post: 0x8a5a34,
    postShade: 0x6b4426,
    straw: 0xdcbd66,
    strawShade: 0xb8963e,
    strawLight: 0xf0d98a,
    rope: 0x8a5a34,
    sack: 0xcdb489,
    sackShade: 0xae9568,
    stitch: 0x3d2a22,
    target: 0xc0443a,
    targetLight: 0xf2e4c4,
  },
} as const;

/** Enemy ground telegraphs (DESIGN §14: red-magenta edge, ≥ 0.4 s). */
export const TELEGRAPH = {
  edge: 0xff2a6d,
  edgeDark: 0x5a0a2a,
  fill: 0xff2a6d,
  edgeWidth: 0.32,
  darkWidth: 0.6,
  /** Fill alpha of the whole area at windup start, and of the growing inner fill. */
  baseAlpha: 0.18,
  growAlpha: 0.36,
  /** Edge pulse frequency (Hz) and depth. */
  pulseHz: 7,
  pulseDepth: 0.3,
  /** Flash on 'attack': color, alpha and seconds. */
  flash: 0xffd6e4,
  flashAlpha: 0.75,
  flashTime: 0.16,
  /** Baked pixels per cell for telegraph textures. */
  res: 12,
} as const;

export const PROJ = {
  /** Player Fire Bolt. */
  boltCore: 0xffd27a,
  boltRim: ELEMENT.fire,
  boltGlow: ELEMENT.fire,
  boltTrail: ELEMENT.fire,
  boltGlowR: 2.6,
  boltTrailLen: 4.5,
  /** Enemy fire arrow: dark shaft, hot tip, danger halo in the telegraph color. */
  arrowLen: 2.6,
  arrowDanger: 0xff2a6d,
  arrowTrailLen: 3.5,
} as const;

export const FX = {
  maxParticles: 4000,
  ivory: 0xfff4dc,
  spark: 0xffe9a0,
  dust: 0xd8c3a0,
  smoke: 0x5a4a52,
  ash: 0x3a2e30,
  metal: 0xb8c0cc,
  clank: 0xffffff,
  hurt: 0xff3b3b,
  evade: 0xd6f6ff,
  thread: 0xfff2c2,
  threadBlue: 0x6d7ddc,
  strikeCore: 0xfff4d6,
  strikeEdge: 0xf4c54f,
  strikeTime: 0.17,
  castFlashTime: 0.12,
  /** Player hurt: body flash seconds, vignette peak alpha and seconds. */
  hurtFlashTime: 0.16,
  vignetteAlpha: 0.3,
  vignetteTime: 0.45,
  /** Player death collapse and re-weave seconds. */
  collapseTime: 0.35,
  reweaveTime: 0.55,
  /** Busy-screen dimming of player effects: enemy-equivalents where it starts and is full. */
  busyStart: 40,
  busyFull: 110,
} as const;

/** Damage numbers. Sizes in CSS pixels at 720p, scaled with the screen height. */
export const NUMBERS = {
  pool: 160,
  size: 17,
  critSize: 25,
  life: 0.85,
  critLife: 1.1,
  rise: 3.2,
  critPop: 1.6,
  /** Same-target numbers within this many seconds stack sideways and upward. */
  stackWindow: 0.45,
  stackDx: 1.3,
  stackDy: 1.1,
  crit: 0xffd23f,
  player: 0xff4a4a,
  colors: { physical: 0xfff4e0, fire: 0xff9a52, frost: ELEMENT.frost, storm: ELEMENT.storm },
} as const;

/** Screen shake (render only). Pixels at 720p, scaled with screen height; max 3 px (DESIGN §4). */
export const SHAKE = {
  max: 3,
  strikeKill: 3,
  crit: 1.2,
  playerHurt: 1.6,
  /** Seconds for a kick to decay to zero, and noise frequency (Hz). */
  decay: 0.18,
  hz: 38,
} as const;
