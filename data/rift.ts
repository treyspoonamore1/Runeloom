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
] as const;
export type RiftChunkId = (typeof riftChunks)[number];

/** The room a rift starts in. Its south socket is the way home. */
export const riftEntryChunk = 'entry';

/**
 * Boss arenas (data/rooms/rift/bosses/<arena>.txt): a south socket from the rift and, behind a
 * door that opens when the boss dies, a north exit home. Marker 1 is the boss.
 */
export const riftBosses = [
  { arena: 'tar_pit', boss: 'rift_matriarch' },
  { arena: 'ember_hearth', boss: 'rift_warden' },
] as const satisfies readonly { arena: string; boss: EnemyKind }[];

/** What a spawn marker in a rift chunk holds, picked by weight among those the tier allows. */
export type RiftSpawn =
  | { pack: PackId; weight: number; fromTier?: number }
  | { enemy: EnemyKind; count: number; weight: number; fromTier?: number };

export const riftSpawns: readonly RiftSpawn[] = [
  { pack: 'tinderling_swarm', weight: 100 },
  { pack: 'archer_line', weight: 80 },
  { pack: 'tar_crew', weight: 70 },
  { pack: 'wisp_flight', weight: 60 },
  { pack: 'caller_guard', weight: 60, fromTier: 2 },
  { enemy: 'shieldbearer', count: 3, weight: 50 },
  { enemy: 'tar_hulk', count: 2, weight: 40, fromTier: 3 },
  { enemy: 'stormcaller', count: 2, weight: 40, fromTier: 4 },
  { enemy: 'frost_wisp', count: 3, weight: 40, fromTier: 5 },
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
}

/** CONTENT §10. The Gale suffix arrives in M8. */
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
  sigilChance: 0.012,
  /** A dropped sigil is the rift's tier, or one tier higher with this chance (at most 16). */
  tierUpChance: 0.25,
  /** The first sigil: the Cinder Warden drops a tier-1 sigil the first time he dies. */
  wardenSigilTier: 1,
};

/** Live Wires pylon pulses (CONTENT §10): every pylon zaps what stands near it and electrifies its metal. */
export const pylonPulse = {
  /** Reach from the pylon's center, cells (a pylon is one 4-cell tile). */
  radius: 7,
  /** Storm damage at area level 1, × tuning.combat.enemyDamageGrowth^(level − 1); world-owned, so it hurts monsters too. */
  damage: 6,
};
