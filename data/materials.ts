/**
 * Grid materials (DESIGN §6.2) and the surface and air layers. Every number the chemistry rules
 * need about a material lives here; rule-wide numbers (spread falloff, charge ranges, …) live in
 * the `grid` section of data/tuning.ts.
 *
 * Codes are the values stored in Grid.ground / Grid.under (u8). Never renumber them: replays and
 * hashes depend on the codes.
 */

export const MAT = {
  stone: 0,
  dirt: 1,
  grass: 2,
  bramble: 3,
  wood: 4,
  crate: 5,
  barricade: 6,
  oil_barrel: 7,
  shallow_water: 8,
  deep_water: 9,
  ice: 10,
  ice_bridge: 11,
  mud: 12,
  metal_floor: 13,
  metal_pylon: 14,
  ash: 15,
  wall: 16,
  pit: 17,
  brazier: 18,
  /** Puzzle objects and doors until M4 gives them their own behavior: solid and inert. */
  object: 19,
} as const;

export type MaterialId = keyof typeof MAT;
export type MaterialCode = (typeof MAT)[MaterialId];

export interface Flammability {
  /** Chance per grid tick that a burning 4-neighbor ignites this cell (rule 2). */
  spreadChance: number;
  /** Seconds a cell of this material burns once lit (its fuel). */
  burnSeconds: number;
  /** What the cell becomes when its fuel runs out (rule 3). 'under' = the cell's `under` material. */
  burntTo: MaterialId | 'under';
  /** Smoke while burning (DESIGN §6.2 air layer). */
  smoke: 'none' | 'light' | 'dense';
  /** Oil barrels explode this many seconds after igniting (DESIGN §6.2). */
  explodeAfter?: number;
}

export interface MaterialDef {
  id: MaterialId;
  code: MaterialCode;
  walk: boolean;
  blocksShots: boolean;
  /** Movement speed multiplier for entities standing on it (1 = normal; shallow water 0.8, mud 0.6). */
  moveMult: number;
  /** Entities slide: lower acceleration and deceleration (ice). */
  slippery: boolean;
  flammable: Flammability | null;
  /** How Storm charge spreads through it (rules 11–13). */
  conducts: 'none' | 'falloff' | 'full';
  /** Water wets entities standing in it (rule 15) and turns fire into steam (rule 4). */
  water: 'shallow' | 'deep' | null;
  /** Frost turns it into this (rules 7, 8, 10). */
  frostTo?: MaterialId;
  /** Fire turns it into this (rule 5: ice melts). */
  fireTo?: MaterialId;
  /** Fire burning on it for this many seconds turns it into `driesTo` (rule 23: mud dries). */
  driesAfter?: number;
  driesTo?: MaterialId;
  /** Frozen water reverts after this many seconds (ice 15 s, ice bridge 8 s), unless placed by a map. */
  revertSeconds?: number;
  /** Ice bridge: seconds of visible cracking before it breaks (rule 25). */
  crackSeconds?: number;
}

const base = {
  walk: true,
  blocksShots: false,
  moveMult: 1,
  slippery: false,
  flammable: null,
  conducts: 'none',
  water: null,
} as const;

export const materials: Readonly<Record<MaterialId, MaterialDef>> = {
  stone: { ...base, id: 'stone', code: MAT.stone },
  dirt: { ...base, id: 'dirt', code: MAT.dirt },
  grass: {
    ...base,
    id: 'grass',
    code: MAT.grass,
    flammable: { spreadChance: 0.2, burnSeconds: 2, burntTo: 'ash', smoke: 'light' },
  },
  bramble: {
    ...base,
    id: 'bramble',
    code: MAT.bramble,
    walk: false,
    flammable: { spreadChance: 0.45, burnSeconds: 1, burntTo: 'ash', smoke: 'dense' },
  },
  wood: {
    ...base,
    id: 'wood',
    code: MAT.wood,
    flammable: { spreadChance: 0.08, burnSeconds: 6, burntTo: 'under', smoke: 'light' },
  },
  crate: {
    ...base,
    id: 'crate',
    code: MAT.crate,
    walk: false,
    blocksShots: true,
    flammable: { spreadChance: 0.1, burnSeconds: 3, burntTo: 'ash', smoke: 'light' },
  },
  barricade: {
    ...base,
    id: 'barricade',
    code: MAT.barricade,
    walk: false,
    blocksShots: true,
    flammable: { spreadChance: 0.1, burnSeconds: 4, burntTo: 'stone', smoke: 'light' },
  },
  oil_barrel: {
    ...base,
    id: 'oil_barrel',
    code: MAT.oil_barrel,
    walk: false,
    blocksShots: true,
    flammable: { spreadChance: 0.3, burnSeconds: 1, burntTo: 'stone', smoke: 'dense', explodeAfter: 1 },
  },
  shallow_water: {
    ...base,
    id: 'shallow_water',
    code: MAT.shallow_water,
    moveMult: 0.8,
    conducts: 'falloff',
    water: 'shallow',
    frostTo: 'ice',
  },
  deep_water: {
    ...base,
    id: 'deep_water',
    code: MAT.deep_water,
    walk: false,
    conducts: 'falloff',
    water: 'deep',
    frostTo: 'ice_bridge',
  },
  ice: {
    ...base,
    id: 'ice',
    code: MAT.ice,
    slippery: true,
    fireTo: 'shallow_water',
    revertSeconds: 15,
  },
  ice_bridge: {
    ...base,
    id: 'ice_bridge',
    code: MAT.ice_bridge,
    slippery: true,
    fireTo: 'deep_water',
    revertSeconds: 8,
    crackSeconds: 1.5,
  },
  mud: { ...base, id: 'mud', code: MAT.mud, moveMult: 0.6, frostTo: 'dirt', driesAfter: 1, driesTo: 'dirt' },
  metal_floor: { ...base, id: 'metal_floor', code: MAT.metal_floor, conducts: 'full' },
  metal_pylon: {
    ...base,
    id: 'metal_pylon',
    code: MAT.metal_pylon,
    walk: false,
    blocksShots: true,
    conducts: 'full',
  },
  ash: { ...base, id: 'ash', code: MAT.ash },
  wall: { ...base, id: 'wall', code: MAT.wall, walk: false, blocksShots: true },
  pit: { ...base, id: 'pit', code: MAT.pit, walk: false },
  brazier: { ...base, id: 'brazier', code: MAT.brazier, walk: false, blocksShots: true, conducts: 'full' },
  object: { ...base, id: 'object', code: MAT.object, walk: false, blocksShots: true },
};

/** Material definitions indexed by code, for per-cell lookups. */
export const materialByCode: readonly MaterialDef[] = (() => {
  const out: MaterialDef[] = [];
  for (const def of Object.values(materials)) out[def.code] = def;
  return out;
})();

/** Grid.surface values. */
export const SURFACE = { none: 0, oil: 1 } as const;

/** Grid.air values. */
export const AIR = { none: 0, smoke: 1, steam: 2 } as const;

/** Grid.owner values: the team whose effect is on the cell (DESIGN §6.3 hazard ownership). */
export const OWNER = { world: 0, player: 1, enemy: 2 } as const;

/** Seconds smoke and steam last (DESIGN §6.2). */
export const airSeconds = { smoke: 4, steam: 3 } as const;

/** Oil surface (DESIGN §6.2): slows, applies Oiled, burns hot. */
export const oil = {
  moveMult: 0.85,
  spreadChance: 0.7,
  burnSeconds: 2,
  /** Terrain-fire DPS multiplier on burning oil. */
  fireDpsMult: 2,
} as const;
