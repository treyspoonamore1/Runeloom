/**
 * Monster rarity and mods (CONTENT §5). Magic packs (blue) have 1–2 mods and ×1.7 life; Rares
 * (yellow) have 2–4 mods, ×4 life and 2 minions. Mods ship in M5; M4 ships only Hasted,
 * Incendiary and Thick-skinned, so a Rare rolls 2–3 of them. Bosses never get a rarity or mods.
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
  waterlogged: { name: 'Waterlogged', description: 'Always Wet: immune to Ignite, conductive', ships: 'M5' },
  frostbound: { name: 'Frostbound', description: "Can't be chilled or frozen", ships: 'M5' },
  grounded: { name: 'Grounded', description: 'Immune to Shock and arcs', ships: 'M5' },
  volatile: {
    name: 'Volatile',
    description: 'Explodes 1 s after death in a 4-cell radius for 20% of its life as Fire damage',
    ships: 'M5',
  },
  swarming: { name: 'Swarming', description: 'Brings 2 extra minions of a weaker type', ships: 'M5' },
} satisfies Record<string, MonsterModDef>;

export type MonsterModId = keyof typeof monsterMods;

export function isMonsterMod(id: string): id is MonsterModId {
  return Object.prototype.hasOwnProperty.call(monsterMods, id);
}

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
