/**
 * Monster rarity and mods (CONTENT §5). Magic packs (blue) have 1–2 mods and ×1.7 life; Rares
 * (yellow) have 2–4 mods, ×4 life and 2 minions. M4 shipped Hasted, Incendiary and Thick-skinned;
 * M5 adds the other five. Bosses never get a rarity or mods.
 *
 * Rolls use state.aiRng (src/sim/actors/rarity.ts).
 */
export interface MonsterModDef {
  name: string;
  /** Shown in tooltips and the enemy name plate. */
  description: string;
  /** The milestone it arrives in; only shipped mods roll. */
  ships: 'M4' | 'M5';
  /** Multiplier on move speed (Hasted 1.3). */
  moveSpeed?: number;
  /** Multiplier on attack speed: recover, active and cooldowns (Hasted 1.3). Windups see minTelegraph. */
  attackSpeed?: number;
  /** Multiplier on max life (Thick-skinned 1.4), after the rarity's. */
  life?: number;
  /** On death, enemy-owned fire in a square of this many cells per side, centered on its cell (Incendiary 5). */
  deathFireSquare?: number;
  /** Ailments it never suffers (Frostbound: chill and freeze; Grounded: shock). */
  immune?: readonly ('chill' | 'freeze' | 'shock' | 'ignite')[];
  /** Rule 19 arcs never reach it (Grounded). */
  noArcs?: boolean;
  /** Always Wet, as if standing in water (Waterlogged): Ignite can't take, Shock arcs to it. */
  alwaysWet?: boolean;
  /**
   * `delay` s after death, an enemy-owned Fire blast of `radius` cells (Volatile). Damage:
   * `hitMult` × the monster's own attack at its area level (`noAttackDamage` at level 1 for kinds
   * without one), so it scales like a hit, never with rarity or life mods. A blast armed within
   * `stackRadius` cells and `stackWindow` s of one still armed deals no damage (no stacking).
   */
  volatile?: {
    delay: number;
    radius: number;
    hitMult: number;
    noAttackDamage: number;
    stackRadius: number;
    stackWindow: number;
  };
  /** Extra minions of a weaker kind (swarmMinion) its group brings (Swarming 2). */
  swarm?: number;
  /** Kinds it never rolls on, where it would mean nothing or break the kind (always-burning, always-wet). */
  excludeKinds?: readonly string[];
}

export const monsterMods = {
  hasted: {
    name: 'Hasted',
    description: '+30% move and attack speed',
    ships: 'M4',
    moveSpeed: 1.3,
    attackSpeed: 1.3,
  },
  incendiary: {
    name: 'Incendiary',
    description: 'On death, 5×5 enemy-owned fire',
    ships: 'M4',
    deathFireSquare: 5,
  },
  thick_skinned: {
    name: 'Thick-skinned',
    description: '+40% life',
    ships: 'M4',
    life: 1.4,
  },
  waterlogged: {
    name: 'Waterlogged',
    description: 'Always Wet: immune to Ignite, conductive',
    ships: 'M5',
    alwaysWet: true,
    excludeKinds: ['tinderling', 'bog_lurker'],
  },
  frostbound: {
    name: 'Frostbound',
    description: "Can't be chilled or frozen",
    ships: 'M5',
    immune: ['chill', 'freeze'],
  },
  grounded: {
    name: 'Grounded',
    description: 'Immune to Shock and arcs',
    ships: 'M5',
    immune: ['shock'],
    noArcs: true,
  },
  volatile: {
    name: 'Volatile',
    description: 'Explodes 1 s after death in a 4-cell radius for 3× its attack as Fire damage',
    ships: 'M5',
    volatile: { delay: 1, radius: 4, hitMult: 3, noAttackDamage: 10, stackRadius: 2, stackWindow: 0.5 },
  },
  swarming: {
    name: 'Swarming',
    description: 'Brings 2 extra minions of a weaker type',
    ships: 'M5',
    swarm: 2,
  },
} satisfies Record<string, MonsterModDef>;

export type MonsterModId = keyof typeof monsterMods;

export function isMonsterMod(id: string): id is MonsterModId {
  return Object.prototype.hasOwnProperty.call(monsterMods, id);
}

/**
 * Swarming's "weaker type" per enemy kind (CONTENT §5): the kind its extra minions are. Kinds with
 * nothing weaker that fits bring their own kind (Tinderlings, Kiln Mites, Bog Lurkers in water).
 */
export const swarmMinion: Readonly<Record<string, string>> = {
  tinderling: 'tinderling',
  shieldbearer: 'tinderling',
  ember_archer: 'tinderling',
  bog_lurker: 'bog_lurker',
  tar_hulk: 'tinderling',
  frost_wisp: 'kiln_mite',
  stormcaller: 'kiln_mite',
  kiln_mite: 'kiln_mite',
};

/** Rarity numbers (CONTENT §5). */
export const rarities = {
  magic: { lifeMult: 1.7, modsMin: 1, modsMax: 2, minions: 0 },
  rare: { lifeMult: 4, modsMin: 2, modsMax: 4, minions: 2 },
} as const;

/**
 * DESIGN §14: a Hasted attack's windup never drops below this (or below its own windup if that
 * is shorter), so big hits keep a readable telegraph.
 */
export const minTelegraph = 0.4;
