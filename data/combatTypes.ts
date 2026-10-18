/** Shared shapes for combat content (enemies.ts, spells.ts). Units: cells, seconds, fractions. */

/** Damage types (DESIGN §7). Tide and Gale (M8) deal physical. */
export const damageTypes = ['physical', 'fire', 'frost', 'storm'] as const;
export type DamageType = (typeof damageTypes)[number];

/** One number per damage type: amounts, shares or resistances (0.75 = 75%, negatives allowed). */
export type DamageAmounts = Record<DamageType, number>;

/** A projectile a spell or an enemy attack fires. */
export interface ProjectileDef {
  /** Projectile kind id, carried into events so render and audio can pick visuals. */
  kind: string;
  /** Cells per second. */
  speed: number;
  /** Collision radius in cells, against walls and bodies. */
  radius: number;
  /** Seconds before it expires. Range = speed × life. */
  life: number;
  /** Extra targets it passes through before stopping (0: stops on the first hit). */
  pierce: number;
}
