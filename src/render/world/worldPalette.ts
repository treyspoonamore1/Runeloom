/**
 * Colors and feel values for the M4 world: puzzle objects, pickups, loot and moments (room
 * transitions, level ups, boss deaths). Purely presentational. Lengths in cells, times in seconds.
 */
export const OBJ = {
  wood: 0xb07a45,
  woodDark: 0x7f5230,
  woodLight: 0xd59a5e,
  iron: 0x5f5966,
  ironLight: 0x8f8794,
  brass: 0xe0b450,
  brassDark: 0x9a7228,
  doorway: 0x2a1c1f,
  bigWood: 0x5a3a6e,
  bigWoodDark: 0x3e2850,
  gold: 0xffd166,
  goldDark: 0xb8862e,
  gem: 0xff4f7a,
  stone: 0xbcae9c,
  stoneDark: 0x8c7f70,
  stoneLight: 0xe0d4c0,
  rune: 0x6d7ddc,
  ice: 0xcff2ff,
  iceShade: 0x8fcde8,
  iceDeep: 0x5fa9d0,
  metal: 0x8f99a6,
  metalDark: 0x5c6470,
  crystalOff: 0x8a8fa0,
  crystalOn: 0xfff2a0,
  plate: 0xa69a8c,
  plateDark: 0x6f6458,
  plateGlow: 0xffd76a,
  chest: 0xb5773d,
  chestDark: 0x7f4f26,
  heart: 0xff4f7a,
  heartLight: 0xffb3c6,
  heartDark: 0xb02a4e,
  shard: 0x9db4ff,
  shardLight: 0xe8eeff,
  shardDark: 0x4e5fc0,
  thread: 0xffd76a,
  loomStone: 0xb8b3c9,
  loomStoneDark: 0x8a849e,
  loomRune: 0xffd76a,
  loomRuneOff: 0x6f6886,
} as const;

/** Object animation feel. */
export const OBJ_FEEL = {
  /** Seconds a door takes to open, and a chest lid to swing. */
  doorOpen: 0.45,
  chestOpen: 0.3,
  /** Pickups: bob height and speed (Hz), glow pulse (Hz). */
  bob: 0.35,
  bobHz: 0.9,
  glowHz: 1.4,
  /** Loom Stone: active pillar alpha, ring spin (rad/s), motes per second. */
  pillarAlpha: 0.3,
  ringSpin: 0.6,
  motes: 5,
  /** Blocks catch up with their tile at least this fast (cells/s) when the sim moves them. */
  blockCatchUp: 18,
  /** Plate press depth (cells) and switch glow (Hz). */
  plateSink: 0.18,
  switchHz: 2.2,
} as const;

/** Loot on the floor (DESIGN §8.2 rarity colors; rune kinds as the Loom's colors). */
export const LOOT = {
  rarity: { normal: 0xe8e0d0, magic: 0x7f9cff, rare: 0xffd84a, unique: 0xe0803a },
  runeKind: { trigger: 0xf2c35b, form: 0xfff0cf, element: 0xff8f52, modifier: 0xbfaeff, branch: 0x72dcc8 },
  part: 0x9ad06a,
  scrap: 0xc9b9a6,
  /** Drop arc: seconds and peak height; idle bob and glint. */
  dropTime: 0.45,
  dropHeight: 3,
  bob: 0.18,
  bobHz: 1.1,
  /** Rare and unique beams: height (cells), width, alpha. */
  beamHeight: 14,
  beamWidth: 1.1,
  beamAlpha: 0.55,
  /** Pickup: seconds the drop flies to the player. */
  pickupTime: 0.22,
} as const;

/** Transitions and moments. */
export const MOMENT = {
  /** Room transition: black hold, then fade (s). */
  roomHold: 0.08,
  roomFade: 0.4,
  /** Level up: ring burst and rising glyph (s). */
  levelTime: 1.2,
  levelColor: 0xffd76a,
  levelRing: 0xfff2c2,
  /** Boss death: white flash, slow rings, ember pillar (s). */
  bossFlash: 0.2,
  bossTime: 2.2,
  /** Player death: screen darkens to this alpha over `deathDim` seconds; respawn clears it. */
  deathAlpha: 0.45,
  deathDim: 0.6,
  respawnFade: 0.5,
} as const;

/**
 * Rune shrine and the dungeon-item moment (the hero holding a new element rune overhead). `light`
 * tints the tablet and glow, `deep` the glyph on it (the Loom's rune colors).
 */
export const RUNE_LOOK = {
  frost: { light: 0x8fe3ff, deep: 0x173f5e },
  storm: { light: 0xf5e04a, deep: 0x43306e },
  fire: { light: 0xff9a5c, deep: 0x5e2412 },
  other: { light: 0xfff0cf, deep: 0x2a1c1f },
} as const;

export const RUNE_GET = {
  /** The pose lasts at least this long (s), and holds while the item-get panel is open. */
  minTime: 1.5,
  /** Seconds to raise the rune, and to fade after the panel closes. */
  raise: 0.25,
  fade: 0.35,
  /** The tablet hovers this far above the player's center (cells), bobbing by `bob`. */
  height: 5,
  bob: 0.15,
  /** Tablet size over the hero (its art is 2 × 2.6 cells). */
  size: 1.5,
  /** Light burst: rays, their spin (rad/s), alpha and glow size (cells). */
  rays: 12,
  spin: 0.35,
  rayAlpha: 0.42,
  rayLength: 1.35,
  glow: 7,
  /** Shrine: tablet height over the altar (cells), light pillar alpha, motes per second. */
  shrineHeight: 3.4,
  /** Shrine scale (the altar fills its tile) and its tablet's scale. */
  shrineScale: 1.2,
  shrineTablet: 1.2,
  pillarAlpha: 0.28,
  motes: 4,
} as const;
