/**
 * Drop rates, XP per kill and item economy (M4). Balance inputs: the M4 balance pass tunes them.
 * Loot rolls use their own RNG stream (GameState.lootRng), so changing these never shifts combat
 * or AI rolls.
 */

/** Per kill. Each roll checks every category once, in this order: rune, gear, spindle, part, scrap. */
export const dropRates = {
  /** Drop rolls per kill by monster rarity ("quantity"); bosses use `bossRolls`. */
  rolls: { normal: 1, magic: 2, rare: 4 },
  bossRolls: 6,
  /** Chance per roll of each category. */
  chance: {
    /** A random rune item, from the runes the hero has unlocked (CONTENT §9.1). */
    rune: 0.05,
    /** A Magic cloak, hood, boots or charm. */
    gear: 0.03,
    /** A spindle base the area level allows (data/progression.ts spindleDropFrom). */
    spindle: 0.012,
    /** The enemy kind's Fuse part (data/fuseParts.ts), if it has one. */
    part: 0.05,
    /** Thread Scrap. */
    scrap: 0.12,
  },
  /** Thread Scrap per scrap drop, inclusive. */
  scrapAmount: { min: 1, max: 2 },
  /** Chance a dropped spindle is Magic rather than Normal, by monster rarity ("quality"). */
  magicSpindleChance: { normal: 0.35, magic: 0.55, rare: 0.8, boss: 1 },
  /** Drop chances × this per enemy kind (Brood Kilns spawn Kiln Mites without end). */
  kindMult: { kiln_mite: 0.25, brood_kiln: 1, dummy: 0 } as Readonly<Record<string, number>>,
  /** Bosses always drop their Fuse part. */
  bossPartChance: 1,
} as const;

/** Fuse part tier by the area level it dropped at (DESIGN §8.4): tier II from 5, tier III from 9. */
export const partTierFrom = { 2: 5, 3: 9 } as const;

/** Floor loot behavior (items/loot.ts). Cells and seconds. */
export const lootFloor = {
  /** Seconds after dropping before a drop can be picked up (so it is seen landing). */
  pickupDelay: 0.5,
  /** Pickup range from the player's center, cells. */
  pickupRadius: 3,
  /** Drops land this far from the body, spread around it. */
  dropSpread: 2,
};

/**
 * XP per kill (DESIGN §7): base XP × xpGrowth^(area level − 1) × rarity multiplier, rounded, at
 * least 1. Base XP is the kind's base life × perBaseLife unless `baseOverride` names it (bosses,
 * whose life numbers are absolute). Socketed runes gain the same XP.
 */
export const killXp = {
  perBaseLife: 1,
  growth: 1.12,
  rarity: { normal: 1, magic: 1.7, rare: 4 },
  baseOverride: { tar_matriarch: 400, cinder_warden: 1200, dummy: 0 } as Readonly<Record<string, number>>,
};

/** Thread Scrap from salvaging (DESIGN §8.5), and the cost to keep a part when unfusing (§8.4). */
export const scrapValues = {
  item: { normal: 1, magic: 2, rare: 4, unique: 6 },
  /** By part tier I, II, III. */
  part: [1, 2, 3] as const,
  unfuseKeepCost: 5,
};
