/**
 * Colors and feel of the Hearth's hub (M7): NPCs, the Hearth fire, the four buildings, the
 * station prompt and Embers. Purely presentational. Lengths in cells, times in seconds.
 */
export const HUB = {
  // Shared materials
  wood: 0xb07a45,
  woodDark: 0x7f5230,
  woodLight: 0xd59a5e,
  stone: 0xbcae9c,
  stoneDark: 0x8c7f70,
  stoneLight: 0xe0d4c0,
  brick: 0xc8714a,
  brickDark: 0x8e4630,
  roof: 0x9a4c35,
  roofLight: 0xc7684a,
  gold: 0xffd166,
  goldDark: 0xb8862e,
  cloth: 0xf2e6cc,
  clothShade: 0xcdbd9c,
  soil: 0x7a5034,
  soilDark: 0x5a3a26,
  coal: 0x4a2418,
  ember: 0xff8a3d,
  emberCore: 0xffe2a0,
  plotLine: 0xfff2d6,
  // NPCs: robe, robe shade, trim, hat, skin
  spindlewright: { robe: 0xc9783e, shade: 0x9a5528, trim: 0xffd166, hat: 0x7f4f26, skin: 0xf2c9a0 },
  runekeeper: { robe: 0x3f8f7a, shade: 0x2c6656, trim: 0xb4f0d8, hat: 0x2a4f46, skin: 0xe8bf98 },
  cartographer: { robe: 0x4e64b8, shade: 0x35478a, trim: 0xf2e6cc, hat: 0x6b4a2e, skin: 0xd9a77e },
  // Prompt plate
  plate: 0x2a1c1f,
  plateText: 0xfff2d6,
  key: 0xffd166,
} as const;

export const HUB_FEEL = {
  /** A building's look steps up at these fractions of its max level (level 1 is always stage 1). */
  stageAt: [0.25, 0.5, 1] as readonly number[],
  /** NPC idle bob (cells, Hz), and how near (cells) the player must be for them to turn. */
  npcBob: 0.12,
  npcBobHz: 0.7,
  npcFaceRange: 24,
  /** Hearth fire: flame scale, glow radius (cells) and alpha, embers rising per second. */
  fireScale: 2.1,
  fireGlow: 9,
  fireGlowAlpha: 0.42,
  fireEmbers: 6,
  /** Kindling Pit flame scale per stage. */
  pitFlame: [0.55, 0.7, 0.85, 1.0] as readonly number[],
  /** Ready expedition markers glint at this rate (Hz). */
  glintHz: 1.6,
  /** Prompt: text height (cells) and gap above the station art. */
  promptText: 1.5,
  promptGap: 0.6,
  promptFade: 0.12,
  /** Above this y (cells) the prompt would leave the screen at the room's top: it shows over the player. */
  promptMinY: 6,
  /** Prompt height over the player's center (cells) when it can't go over the station. */
  promptOverPlayer: 3.4,
} as const;
