/**
 * Enemy kinds (CONTENT §5). Life and damage are at area level 1 and scale per DESIGN §7.
 * Units: cells, seconds, cells per second; resistances are fractions (0.75 = 75%).
 *
 * Values CONTENT doesn't give (radii, recover, cooldown, attack shapes and ranges, knockback,
 * arrow speed and radius) are first guesses, listed in the M1 report.
 */
import type { DamageAmounts, DamageType, ProjectileDef } from './combatTypes';

/**
 * Attack area relative to the attacker. `offset` is how far forward of the enemy's center the
 * shape's origin sits: the circle's center, the cone's apex or the line's start.
 * Cone and arc widths are stored as the cosine of the half angle, so the sim needs no trig.
 */
export type AttackShapeDef =
  | { kind: 'circle'; r: number; offset: number }
  | { kind: 'cone'; r: number; halfAngleCos: number; offset: number }
  | { kind: 'line'; length: number; width: number; offset: number };

export interface AttackDef {
  /** Id shown in events ('telegraph', 'attack'), e.g. for sounds. */
  name: string;
  /** Hit damage at area level 1. */
  damage: number;
  damageType: DamageType;
  /** Telegraph seconds before the attack lands (DESIGN §14: ≥ 0.4 s if damage ≥ 15% of player life). */
  windup: number;
  /** Seconds the attack shows as landing. The hit itself happens once, as it starts. */
  active: number;
  /** Seconds after `active` before the enemy is free again. */
  recover: number;
  /** AI hint: seconds from one attack's start to the next. */
  cooldown: number;
  /** AI hint: start attacking when the gap between the two bodies' edges is at most this. */
  range: number;
  /** Knockback distance applied to the player, cells. */
  knockback: number;
  /** Telegraph and hit area. For projectile attacks it shows the flight path. */
  shape: AttackShapeDef;
  /** If set, the attack fires this projectile along its direction instead of hitting its shape. */
  projectile?: ProjectileDef;
}

/**
 * How the AI (src/sim/ai) drives a kind. Distances in cells, times in seconds, speeds as a
 * fraction of the kind's `speed`, turn rates in radians per second.
 */
export type BehaviorDef =
  /** Never moves or attacks (dummies). */
  | { kind: 'none' }
  /**
   * Rushes the player. Each enemy aims at the player plus its own random offset of
   * min(distance × offsetPerCell, offsetMax) cells, so a pack fans out and surrounds instead of
   * queueing in a line.
   */
  | { kind: 'swarm'; offsetPerCell: number; offsetMax: number }
  /**
   * Advances with its shield up. Facing turns toward the player at most `turnRate`, so a player
   * circling fast enough gets behind it. Bashes only when the player is in range and within
   * ±acos(bashArcCos) of its facing; never turns while attacking.
   */
  | { kind: 'shield'; turnRate: number; bashArcCos: number }
  /**
   * Holds `preferredRange` with line of sight: backs off at `retreatSpeed` when the player is
   * closer than its min (without stopping to shoot inside `panicRange`, unless a wall is behind
   * it), strafes sideways at `strafeSpeed` inside the band while drifting toward its middle
   * (switching side every strafeFlipMin–strafeFlipMax s, or when a wall is within `wallProbe`
   * cells ahead), closes in when farther, and follows the flow field to regain line of sight.
   */
  | {
      kind: 'kite';
      panicRange: number;
      strafeSpeed: number;
      retreatSpeed: number;
      strafeFlipMin: number;
      strafeFlipMax: number;
      wallProbe: number;
    };

export interface EnemyDef {
  name: string;
  /** Max life at area level 1. */
  life: number;
  /** Top move speed, cells per second (AI hint; the AI sets the velocity). */
  speed: number;
  /** Body radius in cells. */
  radius: number;
  resist: DamageAmounts;
  /** Multiplier on knockback this enemy receives (0: never moved by hits). */
  knockbackScale: number;
  /** AI hint: notices the player within this many cells. */
  aggroRange: number;
  /** AI hint for kiters: preferred distance band to the player, cells. */
  preferredRange?: { min: number; max: number };
  attack: AttackDef | null;
  behavior: BehaviorDef;
  /** Front-arc shield that blocks projectiles (Shieldbearer). */
  shield?: { halfAngleCos: number; burnTime: number };
  /** Training dummies: at 0 life they reset to full instead of dying (DESIGN §5.5). */
  immortal?: boolean;
}

const NO_RESIST: DamageAmounts = { physical: 0, fire: 0, frost: 0, storm: 0 };

export const enemies = {
  tinderling: {
    name: 'Tinderling',
    life: 14,
    speed: 22,
    radius: 1,
    resist: { physical: 0, fire: 0.75, frost: -0.25, storm: 0 },
    knockbackScale: 1,
    aggroRange: 40,
    attack: {
      name: 'nip',
      damage: 4,
      damageType: 'physical',
      windup: 0.3,
      active: 0.1,
      recover: 0.3,
      cooldown: 1,
      range: 1.5,
      knockback: 0,
      shape: { kind: 'circle', r: 1.5, offset: 1.5 },
    },
    behavior: { kind: 'swarm', offsetPerCell: 0.35, offsetMax: 7 },
  },
  shieldbearer: {
    name: 'Shieldbearer',
    life: 90,
    speed: 15,
    radius: 2,
    resist: { physical: 0, fire: 0.25, frost: 0.25, storm: 0.25 },
    knockbackScale: 0.5,
    aggroRange: 40,
    attack: {
      name: 'shield_bash',
      damage: 12,
      damageType: 'physical',
      windup: 0.5,
      active: 0.1,
      recover: 0.6,
      cooldown: 2,
      range: 3,
      knockback: 3,
      // 90° cone (cos 45°).
      shape: { kind: 'cone', r: 5.5, halfAngleCos: 0.7071067811865476, offset: 0 },
    },
    // ~86°/s: a player circling at run speed within ~15 cells outpaces it. Bash only if the
    // player is within ±37° (cos 0.8) of the shield's facing, inside the bash cone's ±45°.
    behavior: { kind: 'shield', turnRate: 1.5, bashArcCos: 0.8 },
    // 100° front arc (cos 50°). 4 s of total burning destroys it (M3).
    shield: { halfAngleCos: 0.6427876096865394, burnTime: 4 },
  },
  ember_archer: {
    name: 'Ember Archer',
    life: 40,
    speed: 16,
    radius: 1.4,
    resist: { physical: 0, fire: 0.5, frost: 0, storm: 0 },
    knockbackScale: 1,
    aggroRange: 40,
    preferredRange: { min: 20, max: 30 },
    attack: {
      name: 'fire_arrow',
      damage: 10,
      damageType: 'fire',
      windup: 0.4,
      active: 0.1,
      recover: 0.3,
      cooldown: 1.4,
      range: 30,
      knockback: 0,
      // The aim line covers the arrow's whole flight: speed × life, arrow-wide.
      shape: { kind: 'line', length: 45, width: 1.2, offset: 1.4 },
      projectile: { kind: 'ember_arrow', speed: 45, radius: 0.6, life: 1, pierce: 0 },
    },
    behavior: {
      kind: 'kite',
      panicRange: 8,
      strafeSpeed: 0.6,
      retreatSpeed: 1,
      strafeFlipMin: 1.2,
      strafeFlipMax: 2.8,
      wallProbe: 4,
    },
  },
  dummy: {
    name: 'Training Dummy',
    life: 500,
    speed: 0,
    radius: 1.5,
    resist: NO_RESIST,
    knockbackScale: 0,
    aggroRange: 0,
    attack: null,
    behavior: { kind: 'none' },
    immortal: true,
  },
} satisfies Record<string, EnemyDef>;

export type EnemyKind = keyof typeof enemies;

export function isEnemyKind(id: string): id is EnemyKind {
  return Object.prototype.hasOwnProperty.call(enemies, id);
}

export function enemyDef(kind: EnemyKind): EnemyDef {
  return enemies[kind];
}
