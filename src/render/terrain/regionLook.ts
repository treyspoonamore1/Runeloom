/**
 * Region looks (CONTENT §13): "The renderer draws Fen grass as reeds, metal as rusted teal and
 * water as glass, by region." Region 1 (Emberwood, the Kiln, the Hearth, rifts) keeps its M0–M7
 * look; Glasswater Fen and the Drowned Foundry recolor the same materials. Purely visual.
 */

/** 0 the default look, 1 Glasswater Fen, 2 the Drowned Foundry (the Fen's look, darker metal and soot). */
export type RegionLook = 0 | 1 | 2;

export const REGION = { base: 0, fen: 1, foundry: 2 } as const;

/**
 * The look of a room: its `@look` header when it has one (rift chunks and arenas built from Fen
 * rooms), else by its id: `fen/…` and `foundry/…`; test rooms named `test/fen_…` and
 * `test/foundry_…` (render test rooms) and the Fen enemy test room look the same. Everything else is region 1.
 */
export function regionOf(roomId: string, look?: 'fen' | 'foundry'): RegionLook {
  if (look === 'fen') return REGION.fen;
  if (look === 'foundry') return REGION.foundry;
  if (roomId.startsWith('fen/') || roomId.startsWith('test/fen_') || roomId === 'test/enemies_fen')
    return REGION.fen;
  if (roomId.startsWith('foundry/') || roomId.startsWith('test/foundry_')) return REGION.foundry;
  return REGION.base;
}

/** Fen and Foundry colors for the terrain shader and the baked blocks. */
export const FEN = {
  /** Reed beds: muted marsh greens with tall blades and brown cattail heads. */
  reed: [0x7d9a5a, 0x83a05e, 0x779455] as const,
  reedBlade: 0x4d6b3c,
  reedBladeLight: 0xb5c47a,
  reedHead: 0x7a4a2c,
  reedEdge: 0x4a6638,
  /** Rusted teal metal: verdigris plates with orange-brown rust blooms. */
  metal: 0x6a9c90,
  metalLight: 0x9cc9b8,
  metalDark: 0x3f6660,
  rivet: 0x34524d,
  rust: 0xa8633a,
  rustDark: 0x7a4428,
  /** Foundry metal: darker, sooted. */
  foundryMetal: 0x4f6b66,
  foundryMetalLight: 0x75938b,
  foundryMetalDark: 0x2c3f3b,
  soot: 0x241e22,
  /** Glassy water: clearer teal, mirror highlights of the overcast sky. */
  shallow: 0x7cc7cf,
  shallowShade: 0x5fb0bd,
  deep: 0x2b6f86,
  deepShade: 0x215a70,
  sky: 0xf2fbff,
  /** Cool marsh flagstones (Fen) and soot-dark foundry flags. */
  stone: [0xd9dccb, 0xd5d9c6, 0xdde1d0, 0xd2d6c2] as const,
  stoneGrout: 0xb9bea8,
  foundryStone: [0xb5aca0, 0xb0a79b, 0xbab1a5, 0xaba296] as const,
  foundryGrout: 0x8f877d,
  /** Walls: lichen slate in the Fen, sooted brick in the Foundry. */
  wallTop: 0x8aa69a,
  wallTopLight: 0xb2cbbd,
  wallFront: 0x4b6660,
  wallSeam: 0x2f4542,
  wallChip: 0x7a958a,
  foundryWallTop: 0x8a6e60,
  foundryWallTopLight: 0xab8a76,
  foundryWallFront: 0x4a3430,
  foundryWallSeam: 0x2a1c1a,
  foundryWallChip: 0x765848,
  /** Rusted pylons. */
  pylon: 0x5f8f86,
  /** Furnace vents (DESIGN rule 30): a grate over a glowing pit, or the bare grate when doused. */
  grate: 0x3a3634,
  grateBar: 0x6b625c,
  grateBarLight: 0x9a8f86,
  ventGlow: 0xff8a3a,
  ventHot: 0xffd27a,
  ventCold: 0x2a2f33,
} as const;

/** Raised-block colors per region (walls, pylons). Region 1 entries are null: keep PAL. */
export function wallColors(region: RegionLook): {
  top: number;
  light: number;
  front: number;
  seam: number;
  chip: number;
  pylon: number;
} | null {
  if (region === REGION.fen)
    return {
      top: FEN.wallTop,
      light: FEN.wallTopLight,
      front: FEN.wallFront,
      seam: FEN.wallSeam,
      chip: FEN.wallChip,
      pylon: FEN.pylon,
    };
  if (region === REGION.foundry)
    return {
      top: FEN.foundryWallTop,
      light: FEN.foundryWallTopLight,
      front: FEN.foundryWallFront,
      seam: FEN.foundryWallSeam,
      chip: FEN.foundryWallChip,
      pylon: FEN.foundryMetal,
    };
  return null;
}

/** Fog, wind and firefly colors (DESIGN §6.6, §14: Gale is `#E8F4F0` streaks). */
export const ATMO = {
  gale: 0xe8f4f0,
  /** The dark under-stroke that keeps a pale streak readable on pale stone. */
  galeShadow: 0x2f4542,
  fogLight: 0xe4ece8,
  fogShade: 0xa9bab6,
  fogWarm: 0xffd9a0,
  firefly: 0xf4ff9a,
  fireflyCore: 0xffffe8,
} as const;
