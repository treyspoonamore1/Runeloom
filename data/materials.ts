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
  /** Frost on dry ground (Rimewalkers' dodge trail, M5): slippery, reverts to `under`. */
  rime: 20,
  /** M8: a lit furnace vent, solid flame on a metal grate (DESIGN §6.2, rule 30). */
  vent_lit: 21,
  /** M8: a doused furnace vent, the bare grate: walkable, conducts like metal floor, borrowed (relights). */
  vent_doused: 22,
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
  /**
   * Temporary copies (Hydromancer's water, grid/tempWater.ts; Rimewalkers' rime) turn back into the cell's `under`
   * when their material timer runs out. Map-placed cells have timer 0 and stay.
   */
  revertsToUnder?: boolean;
  /**
   * Rule 30 (M8): entities touching a cell of this material (within tuning.tide.ventTouch cells of
   * its tile) are Ignited as by rule 16, world-owned (the lit furnace vent).
   */
  ignitesTouching?: boolean;
  /**
   * Rule 24 (M8, DESIGN §6.5 Tide table): what Tide does to a cell of this material, after putting
   * out any fire on it. `to`: the material it becomes, `borrowed` for tuning.tide.floodSeconds
   * (ventSeconds for a vent) with `under` = what it was; without `borrowed` the change is
   * permanent (dirt → mud). `wet`: the cell is wet for tuning.tide.wetSeconds (can't ignite).
   * Absent: no change (water, ice, mud, rime, metal, walls, objects). Borrowed water gets its
   * timer back (grid/elements.ts tideCell).
   */
  tide?: { to?: MaterialId; borrowed?: true; vent?: true; wet?: true };
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
  stone: { ...base, id: 'stone', code: MAT.stone, tide: { to: 'shallow_water', borrowed: true } },
  dirt: { ...base, id: 'dirt', code: MAT.dirt, tide: { to: 'mud' } },
  grass: {
    ...base,
    id: 'grass',
    code: MAT.grass,
    tide: { wet: true },
    flammable: { spreadChance: 0.2, burnSeconds: 2, burntTo: 'ash', smoke: 'light' },
  },
  bramble: {
    ...base,
    id: 'bramble',
    code: MAT.bramble,
    tide: { wet: true },
    walk: false,
    flammable: { spreadChance: 0.45, burnSeconds: 1, burntTo: 'ash', smoke: 'dense' },
  },
  wood: {
    ...base,
    id: 'wood',
    code: MAT.wood,
    tide: { wet: true },
    flammable: { spreadChance: 0.08, burnSeconds: 6, burntTo: 'under', smoke: 'light' },
  },
  crate: {
    ...base,
    id: 'crate',
    code: MAT.crate,
    tide: { wet: true },
    walk: false,
    blocksShots: true,
    flammable: { spreadChance: 0.1, burnSeconds: 3, burntTo: 'ash', smoke: 'light' },
  },
  barricade: {
    ...base,
    id: 'barricade',
    code: MAT.barricade,
    tide: { wet: true },
    walk: false,
    blocksShots: true,
    flammable: { spreadChance: 0.1, burnSeconds: 4, burntTo: 'stone', smoke: 'light' },
  },
  oil_barrel: {
    ...base,
    id: 'oil_barrel',
    code: MAT.oil_barrel,
    tide: { wet: true },
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
    revertsToUnder: true,
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
  ash: { ...base, id: 'ash', code: MAT.ash, tide: { to: 'shallow_water', borrowed: true } },
  wall: { ...base, id: 'wall', code: MAT.wall, walk: false, blocksShots: true },
  pit: { ...base, id: 'pit', code: MAT.pit, walk: false, tide: { to: 'deep_water', borrowed: true } },
  brazier: { ...base, id: 'brazier', code: MAT.brazier, walk: false, blocksShots: true, conducts: 'full' },
  object: { ...base, id: 'object', code: MAT.object, walk: false, blocksShots: true },
  rime: { ...base, id: 'rime', code: MAT.rime, slippery: true, revertsToUnder: true },
  // M8 furnace vents (DESIGN §6.2): the lit one is fire, not fuel, so it never burns out or spreads.
  vent_lit: {
    ...base,
    id: 'vent_lit',
    code: MAT.vent_lit,
    walk: false,
    ignitesTouching: true,
    tide: { to: 'vent_doused', borrowed: true, vent: true },
  },
  // Fire on a doused vent relights it at once (rule 30): fireTo, like ice melting.
  vent_doused: { ...base, id: 'vent_doused', code: MAT.vent_doused, conducts: 'full', fireTo: 'vent_lit' },
};

/** Material definitions indexed by code, for per-cell lookups. */
export const materialByCode: readonly MaterialDef[] = (() => {
  const out: MaterialDef[] = [];
  for (const def of Object.values(materials)) out[def.code] = def;
  return out;
})();

/** Grid.surface values. */
export const SURFACE = { none: 0, oil: 1 } as const;

/**
 * Grid.air values. Fog (M8) is placed by a room's `@fog` headers (Grid.fogMask) and never times
 * out; smoke and steam replace it while they last (DESIGN §6.2).
 */
export const AIR = { none: 0, smoke: 1, steam: 2, fog: 3 } as const;

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
  /** Smoke while burning. */
  smoke: 'dense',
} as const satisfies { smoke: Flammability['smoke'] } & Record<string, unknown>;
