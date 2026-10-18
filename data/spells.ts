/**
 * M1 hardcoded spells (CONTENT §1.2). M2 replaces these with compiled weaves; until then the
 * player's loadout names these ids. Damage is at rune level 1.
 */
import type { DamageAmounts, ProjectileDef } from './combatTypes';

export interface SpellDef {
  name: string;
  form: 'bolt' | 'strike';
  /** Form base damage at rune level 1. */
  baseDamage: number;
  /** Element share of the base damage per type; sums to 1. */
  shares: Partial<DamageAmounts>;
  /** Form base mana. */
  baseMana: number;
  /** Element and modifier mana multipliers (DESIGN §5.4). */
  manaMultipliers: readonly number[];
  /** Form cast time in seconds, before cast speed. */
  castTime: number;
  /** Base crit chance, 0–1. */
  critChance: number;
  /** Knockback distance in cells. */
  knockback: number;
  /** Bolt: the projectile it fires toward the aim point. */
  projectile?: ProjectileDef;
  /** Strike: melee arc from the caster's center in the aim direction. */
  arc?: { halfAngleCos: number; reach: number };
}

export const spells = {
  /** `Cast > Bolt[Fire]`: 12 Fire, 6 mana × 1.10 (Fire), 0.45 s, 6% crit. */
  fire_bolt: {
    name: 'Fire Bolt',
    form: 'bolt',
    baseDamage: 12,
    shares: { fire: 1 },
    baseMana: 6,
    manaMultipliers: [1.1],
    castTime: 0.45,
    critChance: 0.06,
    knockback: 1,
    projectile: { kind: 'fire_bolt', speed: 70, radius: 1, life: 0.9, pierce: 0 },
  },
  /** `Cast > Strike[]`: 16 Physical (the Twig Spindle adds no Strike bonus), 4 mana, 0.40 s, 7% crit. */
  strike: {
    name: 'Strike',
    form: 'strike',
    baseDamage: 16,
    shares: { physical: 1 },
    baseMana: 4,
    manaMultipliers: [],
    castTime: 0.4,
    critChance: 0.07,
    knockback: 3,
    // 120° arc (cos 60°), 5 cells from the caster's center.
    arc: { halfAngleCos: 0.5, reach: 5 },
  },
} satisfies Record<string, SpellDef>;

export type SpellId = keyof typeof spells;

export function isSpellId(id: string): id is SpellId {
  return Object.prototype.hasOwnProperty.call(spells, id);
}

/** Mana cost: base mana × product of mana multipliers (DESIGN §5.4). */
export function spellManaCost(def: SpellDef): number {
  let m = def.baseMana;
  for (const k of def.manaMultipliers) m *= k;
  return m;
}
