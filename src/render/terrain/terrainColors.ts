import { MAT, type MaterialId } from '../../../data/materials';
import { ELEMENT, TELEGRAPH } from '../combatPalette';
import { FLAT_GROUND, LINE, PAL } from '../palette';

/**
 * Terrain shader look (DESIGN §14, §15). Purely visual: colors, line weights and animation
 * numbers. Lengths are in cells, times in seconds. Colors reuse the M0 palette where M0 had them.
 */
export const TERRAIN = {
  stone: PAL.stone,
  stoneGrout: PAL.stoneGrout,
  stoneChip: PAL.stoneChip,
  dirt: PAL.dirt,
  dirtPebble: PAL.dirtPebble,
  dirtEdge: PAL.dirtEdge,
  grass: PAL.grass,
  grassBlade: PAL.grassBlade,
  grassBladeLight: PAL.grassBladeLight,
  grassEdge: PAL.grassEdge,
  bramble: 0x3f6e33,
  brambleLight: 0x5f9446,
  brambleDark: 0x2a4a26,
  thorn: 0xe8d9a8,
  wood: 0xc48d55,
  woodLight: 0xd29d63,
  woodDark: 0xa8733f,
  woodGap: 0x5b3a22,
  shallow: PAL.shallow,
  shallowShade: PAL.shallowShade,
  shallowRipple: PAL.shallowRipple,
  deep: PAL.deep,
  deepShade: PAL.deepShade,
  deepRipple: PAL.deepRipple,
  foam: PAL.foam,
  ice: FLAT_GROUND.ice!,
  iceBridge: 0xaee6f7,
  iceShade: 0x9fd8ee,
  iceSheen: 0xffffff,
  iceEdge: 0x5fb2d6,
  crack: 0x2d6f9e,
  mud: FLAT_GROUND.mud!,
  mudDark: 0x6f4e31,
  mudGloss: 0xc4a07a,
  metal: FLAT_GROUND.metal_floor!,
  metalLight: 0xc9d1d7,
  metalDark: 0x7c8790,
  rivet: 0x5d6770,
  ash: 0x9c9599,
  ashDark: 0x6f686d,
  ashLight: 0xc2bcbf,
  ember: 0xff8a3a,
  pit: FLAT_GROUND.pit!,
  pitWall: 0x7a5646,
  wallTop: PAL.wallTop,
  pylon: 0x9aa6b2,
  oil: 0x3a2a4a,
  oilEdge: 0x1e1428,
  ink: PAL.ink,
  scorch: 0x3a2018,

  fireDeep: 0xc8331c,
  fireOuter: ELEMENT.fire,
  fireInner: 0xffd75a,
  fireCore: 0xfff4c4,
  fireGlow: 0xff8a3a,
  stormCore: ELEMENT.storm,
  stormGlow: ELEMENT.stormGlow,
  smoke: 0x5a5260,
  smokeLight: 0x8c8392,
  oilSmoke: 0x2e2633,
  steam: 0xf2f8fb,
  steamShade: 0xc9dce6,
  hazard: TELEGRAPH.edge,
} as const;

/** Edge line widths (cells) between materials, reusing M0's line weights. */
export const TERRAIN_LINE = {
  ground: LINE.groundEdge,
  shore: LINE.groundEdge * 1.3,
  deep: LINE.outline,
  detail: LINE.detail,
  hazard: 0.2,
} as const;

/** Animation and readability numbers for the terrain shader and packer. */
export const TERRAIN_FX = {
  /** Seconds for one water ripple loop (M0: 3). */
  ripplePeriod: 3,
  /** Ice shows thaw (glossier, bluer) in its last seconds. */
  thawShowSeconds: 2,
  /** Embers glow on burnt-out cells for this long. */
  emberSeconds: 3,
  /** Charge fades out over its last grid ticks. */
  chargeFadeTicks: 6,
  /** Floor for an external charge-strength field, so the far end of a pool still crackles. */
  chargeMinStrength: 70,
  /** Smoke/steam density = remaining grid ticks × this (fades over the last ~1.6 s). */
  airFadeScale: 8,
  /** Wet = remaining grid ticks × this (fades over the last ~1.6 s). */
  wetFadeScale: 8,
  /** Per-tile glow gain (the average over a tile is low at a fire front). */
  glowGain: 2.2,
  /** Hostile-hazard edge pulse (Hz) and alpha range. Slower than telegraphs (7 Hz). */
  hazardHz: 1.6,
  hazardAlphaMin: 0.25,
  hazardAlphaMax: 0.85,
  /** Smoke and steam opacity at full density. */
  smokeAlpha: 0.42,
  steamAlpha: 0.45,
  /** Extra flame tongue height at full intensity, cells. */
  flameRise: 1.7,
  /** Flame tongues sit on a jittered lattice this many cells apart. */
  tongueSpacing: 1.6,
  /** Burning oil is drawn this much hotter (taller, more yellow-white core). */
  oilFireHeat: 1.35,
  /** Smoke and steam are drawn this many cells north of their cells (they rise). */
  airLift: 1.5,
  /** Additive glow strength around fire and charge. */
  fireGlow: 0.45,
  stormGlow: 0.3,
} as const;

/** F1 material overlay colors, by material id (also the legend in the overlay menu). */
export const DEBUG_MATERIAL: Record<MaterialId, number> = {
  stone: 0xbdb5a6,
  dirt: 0xa0703d,
  grass: 0x58c43a,
  bramble: 0x1f6b2a,
  wood: 0xd08a3c,
  crate: 0xf0b030,
  barricade: 0x9a5b2a,
  oil_barrel: 0x7a3fa0,
  shallow_water: 0x4fd0ff,
  deep_water: 0x1f4fd0,
  ice: 0xc8f4ff,
  ice_bridge: 0x8fd0ff,
  mud: 0x6a4428,
  metal_floor: 0x8c9aa6,
  metal_pylon: 0x4a5a6a,
  ash: 0x5c5c5c,
  wall: 0x30202a,
  pit: 0x000000,
  brazier: 0xff5030,
  object: 0xff40c0,
};

/** Debug colors indexed by material code. */
export const DEBUG_MATERIAL_BY_CODE: readonly number[] = (() => {
  const out: number[] = [];
  for (const [id, color] of Object.entries(DEBUG_MATERIAL)) out[MAT[id as MaterialId]] = color;
  return out;
})();

/** F1 owner overlay colors (world, player, enemy). */
export const DEBUG_OWNER = [0xffffff, 0x3ad0ff, 0xff3050] as const;

/** One-shot terrain effects from grid events (terrainFx.ts). Times in seconds, sizes in cells. */
export const TERRAIN_ONESHOT = {
  /** Particles per layer (four layers). */
  capacity: 400,
  /** Ignition flares per event, and ignited cells per flare (a big hit makes a few, not hundreds). */
  igniteMax: 6,
  ignitePerFlare: 3,
  flareLife: 0.28,
  burntMax: 4,
  steamMax: 8,
  bloomLife: 0.45,
  glintMax: 6,
  chipMax: 4,
  shatterMax: 10,
  shatterShake: 1.4,
  /** Electrify pulse: lifetime, racing speed (cells/s), band width; networks this big pulse at full strength. */
  pulseLife: 0.7,
  pulseSpeed: 70,
  pulseWidth: 2.5,
  bigNetwork: 400,
  flashLife: 0.22,
  ringLife: 0.4,
  explosionShake: 3,
} as const;
