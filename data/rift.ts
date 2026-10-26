/**
 * Rifts (DESIGN §10.4, CONTENT §10, M6): the tier ladder, the room-chunk templates rifts are
 * built from, what spawns in them, and the Rift Sigil modifiers. The generator is
 * src/sim/world/rift/generate.ts; templates are room files under data/rooms/rift/ (chunks have an
 * exit on every edge: those are the sockets; spawn markers 1–3 get their @spawn from here).
 */
import type { EnemyKind } from './enemies';
import type { PackId } from './packs';

/** Tiers 1 to 16 (DESIGN §10.4). */
export const RIFT_TIERS = 16;

/** Area level of a rift tier: tier 1 is 11 (just past the Cinder Warden), tier 16 is 30. */
export function riftAreaLevel(tier: number): number {
  return 10 + Math.round(tier * 1.25);
}

export const riftLayout = {
  /** Rooms before the boss room, the entry included (BUILD_PLAN M6: 6–10). */
  minRooms: 6,
  maxRooms: 10,
  /** Chance a new room hangs off the room added last rather than any room (long rifts with side rooms). */
  chainChance: 0.6,
};

/** Room-chunk templates (data/rooms/rift/chunks/<id>.txt), all with sockets on every edge. */
export const riftChunks = [
  'glade',
  'ruins',
  'river',
  'foundry',
  'bog',
  'thicket',
  'oilworks',
  'frostcave',
  'pithall',
  'plaza',
  // M8 (CONTENT §10.1): the Fen's chunks, from tier 9 (riftChunkFromTier).
  'reedmarsh',
  'pylon_flats',
  'sluiceworks',
] as const;
export type RiftChunkId = (typeof riftChunks)[number];

/** The lowest tier a chunk appears at (default 1). M8: the Fen's from tier 9, after the Coil. */
export const riftChunkFromTier: Readonly<Partial<Record<RiftChunkId, number>>> = {
  reedmarsh: 9,
  pylon_flats: 9,
  sluiceworks: 9,
};

/** The chunks a rift of `tier` picks rooms from, in table order. */
export function riftChunksAt(tier: number): readonly RiftChunkId[] {
  return riftChunks.filter((c) => (riftChunkFromTier[c] ?? 1) <= tier);
}

/** The room a rift starts in. Its south socket is the way home. */
export const riftEntryChunk = 'entry';

/**
 * Boss arenas (data/rooms/rift/bosses/<arena>.txt): a south socket from the rift and, behind a
 * door that opens when the boss dies, a north exit home. Marker 1 is the boss.
 */
export const riftBosses = [
  { arena: 'tar_pit', boss: 'rift_matriarch' },
  { arena: 'ember_hearth', boss: 'rift_warden' },
  // M8 (CONTENT §10.1): the Fen bosses from tier 9. The Coil's arena keeps its water whatever the
  // suffixes say (Drought and Permafrost would strand or ice it for good).
  { arena: 'belfry', boss: 'rift_bellwether', fromTier: 9 },
  { arena: 'glass_eye', boss: 'rift_coil', fromTier: 9, keepsWater: true },
] as const satisfies readonly RiftBossDef[];

/** A rift boss and its arena (data/rooms/rift/bosses/<arena>.txt). */
export interface RiftBossDef {
  arena: string;
  boss: EnemyKind;
  /** The lowest tier it appears at (default 1). At its tier and up all eligible bosses are equally likely. */
  fromTier?: number;
  /** Its arena ignores the suffixes that remove or freeze water (Drought, Permafrost). */
  keepsWater?: boolean;
}

/** The rift bosses a rift of `tier` picks from, in table order. */
export function riftBossesAt(tier: number): readonly RiftBossDef[] {
  return riftBosses.filter((b: RiftBossDef) => (b.fromTier ?? 1) <= tier);
}

/**
 * What a spawn marker in a rift chunk holds, picked by weight among those the tier and chunk
 * allow. `notIn`: chunks it never spawns in.
 */
export type RiftSpawn =
  | { pack: PackId; weight: number; fromTier?: number; notIn?: readonly RiftChunkId[] }
  | { enemy: EnemyKind; count: number; weight: number; fromTier?: number; notIn?: readonly RiftChunkId[] };

/**
 * Burning Tinderlings set oil lines and bramble ablaze before the player can act (the M5 Thicket
 * playtest note), so their packs stay out of the oil and bramble chunks.
 */
const FIRE_PRONE: readonly RiftChunkId[] = ['oilworks', 'thicket'];

export const riftSpawns: readonly RiftSpawn[] = [
  { pack: 'tinderling_swarm', weight: 100, notIn: FIRE_PRONE },
  { pack: 'archer_line', weight: 80 },
  { pack: 'tar_crew', weight: 70, notIn: FIRE_PRONE },
  { pack: 'wisp_flight', weight: 60 },
  { pack: 'caller_guard', weight: 60, fromTier: 2 },
  { enemy: 'shieldbearer', count: 3, weight: 50 },
  { enemy: 'tar_hulk', count: 2, weight: 40, fromTier: 3 },
  { enemy: 'stormcaller', count: 2, weight: 40, fromTier: 4 },
  { enemy: 'frost_wisp', count: 3, weight: 40, fromTier: 5 },
  // M8 (CONTENT §10.1): the Fen's packs from tier 9. Water-only packs (pike_shoal) are only picked
  // for markers that sit in water once the suffixes have rewritten the room (generate.ts).
  { pack: 'pike_shoal', weight: 50, fromTier: 9 },
  { pack: 'crab_cast', weight: 60, fromTier: 9 },
  { pack: 'heron_wade', weight: 60, fromTier: 9 },
  { pack: 'sparkfly_cloud', weight: 70, fromTier: 9, notIn: FIRE_PRONE },
  { pack: 'mire_herd', weight: 50, fromTier: 9 },
  { pack: 'foundry_crew', weight: 50, fromTier: 9, notIn: FIRE_PRONE },
  { pack: 'toad_chorus', weight: 40, fromTier: 9 },
  { enemy: 'slagshell', count: 2, weight: 30, fromTier: 10 },
  { enemy: 'bellshell', count: 2, weight: 30, fromTier: 9 },
];

/** Chance a spawn marker's group is Magic or Rare, by tier: base + perTier × (tier − 1). */
export const riftRarity = {
  magic: { base: 0.25, perTier: 0.01 },
  rare: { base: 0.08, perTier: 0.012 },
};

export type RiftModKind = 'prefix' | 'suffix';

export interface RiftModDef {
  id: string;
  kind: RiftModKind;
  name: string;
  text: string;
  /** Loot bonuses, as fractions (0.15 = +15%). */
  quantity: number;
  rarity: number;
  /** Prefixes: monster numbers. */
  monsterDamageMore?: number;
  packSizeMore?: number;
  monsterLifeMore?: number;
  monsterResistAdd?: number;
  monsterSpeedMore?: number;
  /** Suffixes: chemistry. Terrain rewrites happen when the rift is built (world/rift/terrain.ts). */
  terrain?: 'drought' | 'floodplain' | 'live_wires' | 'permafrost' | 'tinderbox';
  /** Fire spreads this many times as fast (Drought 2). */
  fireSpreadMult?: number;
  /** Ice from any source lasts this many times as long (Permafrost 2). */
  iceDurationMult?: number;
  /** Smoke lasts this many times as long (Choking Smoke 2). */
  smokeDurationMult?: number;
  /** Monsters aren't Blinded by smoke (Choking Smoke). */
  monstersSeeInSmoke?: boolean;
  /** All monsters are Oiled (Tinderbox). */
  monstersOiled?: boolean;
  /** Every metal pylon pulses world-owned Storm charge this often, in seconds (Live Wires 4). */
  pylonPulseSeconds?: number;
  /** Floor share that becomes shallow water (Floodplain 0.4). */
  floodShare?: number;
  /** Extra metal pylons placed in each room (Live Wires). */
  extraPylons?: number;
  /** M8: room wind in every rift room, the way it blows (of the Gale: 'e', from the west). */
  wind?: 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
  /** M8: the lowest sigil tier it rolls on (default 1). */
  fromTier?: number;
}

/** CONTENT §10. The Gale suffix (M8) rolls from tier 9 (CONTENT §10.1). */
export const riftMods = {
  brutal: {
    id: 'brutal',
    kind: 'prefix',
    name: 'Brutal',
    text: 'Monsters deal 25% more damage',
    quantity: 0.15,
    rarity: 0,
    monsterDamageMore: 0.25,
  },
  teeming: {
    id: 'teeming',
    kind: 'prefix',
    name: 'Teeming',
    text: '+40% pack size',
    quantity: 0.2,
    rarity: 0,
    packSizeMore: 0.4,
  },
  hardened: {
    id: 'hardened',
    kind: 'prefix',
    name: 'Hardened',
    text: 'Monsters have 40% more life',
    quantity: 0,
    rarity: 0.15,
    monsterLifeMore: 0.4,
  },
  resolute: {
    id: 'resolute',
    kind: 'prefix',
    name: 'Resolute',
    text: 'Monsters have +20% to all resistances',
    quantity: 0,
    rarity: 0.15,
    monsterResistAdd: 0.2,
  },
  hasty: {
    id: 'hasty',
    kind: 'prefix',
    name: 'Hasty',
    text: 'Monsters are 20% faster',
    quantity: 0.15,
    rarity: 0,
    monsterSpeedMore: 0.2,
  },
  drought: {
    id: 'drought',
    kind: 'suffix',
    name: 'of Drought',
    text: 'No water spawns. Fire spreads twice as fast',
    quantity: 0,
    rarity: 0.2,
    terrain: 'drought',
    fireSpreadMult: 2,
  },
  floodplain: {
    id: 'floodplain',
    kind: 'suffix',
    name: 'of the Floodplain',
    text: '40% of floor tiles become shallow water',
    quantity: 0.15,
    rarity: 0,
    terrain: 'floodplain',
    floodShare: 0.4,
  },
  live_wires: {
    id: 'live_wires',
    kind: 'suffix',
    name: 'of Live Wires',
    text: 'Extra metal pylons. All pylons pulse charge every 4 s',
    quantity: 0,
    rarity: 0.2,
    terrain: 'live_wires',
    extraPylons: 3,
    pylonPulseSeconds: 4,
  },
  permafrost: {
    id: 'permafrost',
    kind: 'suffix',
    name: 'of Permafrost',
    text: 'Water starts frozen. Ice from any source lasts twice as long',
    quantity: 0.15,
    rarity: 0,
    terrain: 'permafrost',
    iceDurationMult: 2,
  },
  tinderbox: {
    id: 'tinderbox',
    kind: 'suffix',
    name: 'of the Tinderbox',
    text: 'Floors become grass. All monsters are Oiled',
    quantity: 0,
    rarity: 0.25,
    terrain: 'tinderbox',
    monstersOiled: true,
  },
  choking_smoke: {
    id: 'choking_smoke',
    kind: 'suffix',
    name: 'of Choking Smoke',
    text: "Smoke lasts twice as long. Monsters aren't Blinded by smoke",
    quantity: 0.2,
    rarity: 0,
    smokeDurationMult: 2,
    monstersSeeInSmoke: true,
  },
  gale: {
    id: 'gale',
    kind: 'suffix',
    name: 'of the Gale',
    text: 'Constant wind from the west: fire spreads ×2 eastward and ×0.25 westward; smoke and steam drift east',
    quantity: 0.15,
    rarity: 0,
    wind: 'e',
    fromTier: 9,
  },
} satisfies Record<string, RiftModDef>;

export type RiftModId = keyof typeof riftMods;

export function isRiftModId(id: string): id is RiftModId {
  return Object.prototype.hasOwnProperty.call(riftMods, id);
}

/**
 * Rift Sigils (DESIGN §10.4): tier 1–16, 0–4 modifiers (at most 2 prefixes and 2 suffixes).
 * Modifier count weights by tier band; higher tiers roll more.
 */
export const sigilRolls = {
  maxPrefixes: 2,
  maxSuffixes: 2,
  /** Weights of 0, 1, 2, 3, 4 modifiers: low tiers (1–5), mid (6–10), high (11–16). */
  modCountWeights: [
    [40, 35, 20, 5, 0],
    [20, 30, 30, 15, 5],
    [10, 20, 30, 25, 15],
  ],
};

/** Sigils from rifts (M6). */
export const riftDrops = {
  /** Chance per drop roll (data/loot.ts rolls) in a rift that a Rift Sigil drops. */
  sigilChance: 0.006,
  /** A dropped sigil is the rift's tier, or one tier higher with this chance (at most 16). */
  tierUpChance: 0.05,
  /**
   * M7: the rift boss's sigil is one tier higher with chance max(min, base − perTier × (tier − 1))
   * + perClear × the best tier's earlier completions (hero.riftBestClears; only when the rift is
   * the best tier), else the rift's own tier (riftBossTierUpChance). Sigil supply paces the climb;
   * perClear keeps every rift a step toward the next tier.
   */
  bossTierUp: { base: 0.1, perTier: 0.012, min: 0.01, perClear: 0.009 },
  /**
   * M7 re-climb: below the highest tier ever completed (hero.hearth.bestEverTier, kept through
   * Rekindles) the next tier's sigil comes with this chance instead, so a new cycle climbs back
   * fast and only new territory is slow.
   */
  reclimbTierUp: 0.75,
  /** The first sigil: the Cinder Warden drops a tier-1 sigil the first time he dies. */
  wardenSigilTier: 1,
  /** With no sigils left (after the Warden), the map offers a free one of this tier (M6.5). */
  freeSigilTier: 1,
};

/**
 * Rift tiers grow harder than their area level alone (M7 balance): monster life and monster hit
 * damage × (1 + perTier)^(tier − 1), on top of the area level's growth and the sigil's prefixes.
 * Kill XP and Embers don't change (they follow the area level), so climbing needs the power gear,
 * crafting and the Hearth give, not only levels.
 */
export const riftTierScaling = { lifeMorePerTier: 0.06, damageMorePerTier: 0.04 };

/**
 * The chance a rift boss of `tier` drops the next tier's sigil: riftDrops.reclimbTierUp below
 * `bestEverTier` (the highest tier ever completed, M7 re-climb), else riftDrops.bossTierUp after
 * `bestClears` earlier completions of it as the best tier (0 below the best).
 */
export function riftBossTierUpChance(tier: number, bestClears = 0, bestEverTier = 0): number {
  if (tier < bestEverTier) return riftDrops.reclimbTierUp;
  const b = riftDrops.bossTierUp;
  return Math.min(1, Math.max(b.min, b.base - b.perTier * (tier - 1)) + b.perClear * Math.max(0, bestClears));
}

/** Live Wires pylon pulses (CONTENT §10): every pylon zaps what stands near it and electrifies its metal. */
export const pylonPulse = {
  /** Reach from the pylon's center, cells (a pylon is one 4-cell tile). */
  radius: 7,
  /** Storm damage at area level 1, × tuning.combat.enemyDamageGrowth^(level − 1); world-owned, so it hurts monsters too. */
  damage: 6,
};

/**
 * Completing a rift (its boss dies, M6): the tier ladder moves up to its tier, and its boss
 * drops, besides its usual boss loot, a sigil (M7: one tier higher with riftBossTierUpChance,
 * else its own tier; never above the Rekindle cap) and
 * `currencyBase + floor(tier / currencyPerTiers)` crafting currencies.
 */
export const riftRewards = {
  currencyBase: 1,
  currencyPerTiers: 3,
};
