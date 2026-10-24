/**
 * The Hearth (DESIGN §11, M7): the hub, Embers, the four buildings, expeditions, offline
 * progress, Rekindle, Ash and Mutations (CONTENT §11). Every number here is a balance input; the
 * M7 progression sim (npm run sim -- --progression) tunes them toward the first Rekindle in 6 to
 * 10 hours of play.
 *
 * CONTRACT (M7): the meta agent owns the numbers and the systems that read them
 * (src/sim/meta/*); the hub agent owns the room file and keeps `hearthStone` in sync with it.
 */
import type { CurrencyId } from './currency';
import type { RuneId } from './runes';

/** The hub's room id (data/rooms/hearth/hearth.txt). */
export const hearthRoom = 'hearth/hearth';

/**
 * The Hearth's Loom Stone (WorldObject.key of its `x` tile in the room file): lighting the Hearth
 * activates it, so fast travel reaches the Hearth from any Loom Stone. A test checks it matches
 * the file.
 */
export const hearthStone = { roomId: hearthRoom, key: 'loom_stone@14,9' } as const;

export const BUILDING_IDS = ['kindling_pit', 'rune_garden', 'expedition_board', 'salvage_loom'] as const;
export type BuildingId = (typeof BUILDING_IDS)[number];

/** Who and what in the hub the player can use with Interact (F). */
export const STATION_IDS = [
  'spindlewright',
  'runekeeper',
  'cartographer',
  'hearth_fire',
  ...BUILDING_IDS,
] as const;
export type StationId = (typeof STATION_IDS)[number];

export const stations: Readonly<Record<StationId, { name: string; text: string }>> = {
  spindlewright: {
    name: 'The Spindlewright',
    text: 'Crafting bench, and crafting currencies for Thread Scrap',
  },
  runekeeper: { name: 'The Runekeeper', text: 'Keeps runes in the Rune Garden, where they grow' },
  cartographer: { name: 'The Cartographer', text: 'Opens rifts with your Rift Sigils' },
  hearth_fire: { name: 'The Hearth', text: 'Rekindle, and spend Ash on Mutations' },
  kindling_pit: { name: 'Kindling Pit', text: 'Makes Thread Scrap every minute' },
  rune_garden: { name: 'Rune Garden', text: 'Runes planted here gain XP every minute' },
  expedition_board: {
    name: 'Expedition Board',
    text: 'Send hired Weavers on timed rifts for Fuse parts and currency',
  },
  salvage_loom: { name: 'Salvage Loom', text: 'Salvages gear you pick up below a rarity into Thread Scrap' },
};

/** Embers (DESIGN §11): drop from everything once the Hearth is lit. */
export const embers = {
  /** Embers the Cinder Warden's death gives when it lights the Hearth (a first purchase or two). */
  onLit: 150,
  /** Per kill by monster rarity, at area level 1 (bosses use `boss`). */
  perKill: { normal: 1, magic: 3, rare: 8, unique: 8, boss: 60 },
  /** × this per area level above 1, like kill XP. */
  growth: 1.1,
  /** A chest opening. */
  chest: 10,
  /** A completed rift, × its tier. */
  riftPerTier: 30,
};

export interface BuildingDef {
  id: BuildingId;
  maxLevel: number;
  /** Embers to go from level L to L + 1: round(costBase × costGrowth^L). */
  costBase: number;
  costGrowth: number;
}

export const buildings: Readonly<Record<BuildingId, BuildingDef>> = {
  kindling_pit: { id: 'kindling_pit', maxLevel: 25, costBase: 50, costGrowth: 1.35 },
  rune_garden: { id: 'rune_garden', maxLevel: 20, costBase: 80, costGrowth: 1.4 },
  expedition_board: { id: 'expedition_board', maxLevel: 15, costBase: 120, costGrowth: 1.5 },
  salvage_loom: { id: 'salvage_loom', maxLevel: 10, costBase: 60, costGrowth: 1.6 },
};

/** Kindling Pit: Thread Scrap per minute at level L ≥ 1 = perMinute × growth^(L − 1). */
export const kindlingPit = { perMinute: 0.5, growth: 1.25 };

/**
 * Rune Garden: plots at level L ≥ 1 = min(maxPlots, 1 + floor(L / plotEvery)); XP per minute for
 * each planted rune = xpPerMinute × growth^(L − 1).
 */
export const runeGarden = { plotEvery: 4, maxPlots: 6, xpPerMinute: 20, growth: 1.22 };

/**
 * Expedition Board: Weavers (expeditions out at once) at level L ≥ 1 = min(maxWeavers,
 * 1 + floor((L − 1) / weaverEvery)). An expedition runs a rift tier from 1 up to the best tier
 * completed this cycle (at least 1); it takes baseSeconds + perTierSeconds × tier, and returns
 * with rolled rewards.
 */
export const expeditionBoard = {
  weaverEvery: 5,
  maxWeavers: 3,
  baseSeconds: 600,
  perTierSeconds: 120,
  rewards: {
    /** Fuse parts per expedition: min + floor(tier / perTier). Tier by the tier's area level. */
    parts: { min: 1, perTier: 4 },
    /** Crafting currencies per expedition: min + floor(tier / perTier). */
    currency: { min: 1, perTier: 3 },
    /** Embers: perTier × tier. */
    embersPerTier: 15,
  },
};

/**
 * Salvage Loom: from level `normalAt` it salvages Normal gear, from `magicAt` Magic, from
 * `rareAt` Rare (never uniques), up to the hero's setting. Scrap × (1 + bonusPerLevel × L).
 */
export const salvageLoom = { normalAt: 1, magicAt: 4, rareAt: 8, bonusPerLevel: 0.1 };

/** The Spindlewright sells crafting currencies for Thread Scrap. */
export const spindlewrightPrices: Readonly<Record<CurrencyId, number>> = {
  weavers_knot: 4,
  spool_of_change: 6,
  loom_shuttle: 10,
  chaos_skein: 25,
  golden_needle: 40,
  unpick: 30,
  rune_polish: 20,
};

/** Offline progress (DESIGN §11): the app counts wall-clock time since the save, capped here. */
export const offline = { capSeconds: 8 * 3600, minSeconds: 60 };

/** Rekindle (DESIGN §11). */
export const rekindle = {
  /** The best rift tier completed this cycle that unlocks Rekindle. */
  unlockTier: 8,
  /** The highest rift tier that can be opened before the first Rekindle. */
  baseMaxTier: 10,
  /** Each Rekindle raises the highest openable tier by this (up to data/rift.ts's last tier). */
  maxTierPerRekindle: 2,
  /** Ash = tierAsh × (best tier − unlockTier + 1) + floor(sqrt(Embers spent this cycle / emberDivisor)). */
  tierAsh: 1,
  emberDivisor: 2000,
};

export const MUTATION_IDS = [
  'deeper_weave',
  'shatterpoint',
  'stormglass_memory',
  'bright_hearth',
  'sigil_cache',
  'twin_threads',
  'kindred_flame',
  'swift_expeditions',
] as const;
export type MutationId = (typeof MUTATION_IDS)[number];

export interface MutationDef {
  id: MutationId;
  name: string;
  ash: number;
  /** Times it can be bought. */
  max: number;
  text: string;
}

/** CONTENT §11. */
export const mutations = {
  deeper_weave: {
    id: 'deeper_weave',
    name: 'Deeper Weave',
    ash: 3,
    max: 1,
    text: 'Branches can nest 4 deep',
  },
  shatterpoint: {
    id: 'shatterpoint',
    name: 'Shatterpoint',
    ash: 2,
    max: 1,
    text: 'Unlocks the Shatter trigger rune in drops: fires when you shatter an enemy',
  },
  stormglass_memory: {
    id: 'stormglass_memory',
    name: 'Stormglass Memory',
    ash: 3,
    max: 1,
    text: 'Ice conducts Storm, as the Stormglass keystone',
  },
  bright_hearth: {
    id: 'bright_hearth',
    name: 'Bright Hearth',
    ash: 1,
    max: 10,
    text: '+10% Hearth production',
  },
  sigil_cache: {
    id: 'sigil_cache',
    name: 'Sigil Cache',
    ash: 1,
    max: 1,
    text: 'Start each Rekindle with five tier 3 Rift Sigils',
  },
  twin_threads: {
    id: 'twin_threads',
    name: 'Twin Threads',
    ash: 4,
    max: 1,
    text: 'A fifth weave slot, bound to R',
  },
  kindred_flame: {
    id: 'kindred_flame',
    name: 'Kindred Flame',
    ash: 2,
    max: 1,
    text: 'Fire you create also spreads to adjacent Oiled or Ignited enemies',
  },
  swift_expeditions: {
    id: 'swift_expeditions',
    name: 'Swift Expeditions',
    ash: 2,
    max: 1,
    text: 'Expeditions return 50% faster',
  },
} as const satisfies Record<MutationId, MutationDef>;

/** Mutation effect sizes. */
export const mutationEffects = {
  /** Bright Hearth: Kindling Pit Scrap and Rune Garden XP × (1 + this × purchases). */
  brightHearthPer: 0.1,
  /** Swift Expeditions: an expedition's duration ÷ this. */
  swiftSpeed: 1.5,
  /** Sigil Cache: sigils of this tier, this many, after each Rekindle. */
  sigilCache: { tier: 3, count: 5 },
  /** Deeper Weave: the deepest branch allowed. */
  deeperDepth: 4,
  /** Shatterpoint: runes that join rune discovery (data/progression.ts runeDiscovery), by the area level they start at. */
  shatterpointRunes: { shatter: 1 } as Readonly<Partial<Record<RuneId, number>>>,
};
