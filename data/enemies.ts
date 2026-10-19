/**
 * Enemy kinds (CONTENT §5). Life and damage are at area level 1 and scale per DESIGN §7.
 * Units: cells, seconds, cells per second; resistances are fractions (0.75 = 75%).
 *
 * Values CONTENT doesn't give (radii, recover, cooldown, attack shapes and ranges, knockback,
 * arrow speed and radius) are first guesses, listed in the M1 and M4 reports. Types are in
 * data/enemyTypes.ts.
 */
import type { DamageAmounts } from './combatTypes';
import type { AttackDef, EnemyDef } from './enemyTypes';
import { bosses } from './bosses';
import { m4Enemies } from './enemiesM4';

export type {
  AttackDef,
  AttackShapeDef,
  AttackTerrainDef,
  BehaviorDef,
  DashDef,
  EnemyChemistry,
  EnemyDef,
  Locomotion,
} from './enemyTypes';

const NO_RESIST: DamageAmounts = { physical: 0, fire: 0, frost: 0, storm: 0 };

/** The M1 kinds. */
const m1Enemies = {
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
    // Always burning (CONTENT §5).
    immune: ['ignite'],
    chemistry: {
      alwaysBurning: { dousedStun: 2, dousedDamageTaken: 1.5, deathFireRadius: 1.5 },
      ignoresHazards: true,
    },
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
    // Missed arrows ignite flammable cells where they land (CONTENT §5).
    chemistry: { missIgniteRadius: 1.2 },
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

/**
 * Every enemy kind: the M1 kinds, the M4 kinds (data/enemiesM4.ts) and the bosses
 * (data/bosses.ts). Ids are exactly CONTENT §5's (Fuse parts drop by kind, CONTENT §4).
 */
export const enemies = { ...m1Enemies, ...m4Enemies, ...bosses } satisfies Record<string, EnemyDef>;

export type EnemyKind = keyof typeof enemies;

export function isEnemyKind(id: string): id is EnemyKind {
  return Object.prototype.hasOwnProperty.call(enemies, id);
}

export function enemyDef(kind: EnemyKind): EnemyDef {
  return enemies[kind];
}

// Attack lookup by name: the kind's primary attack and its extraAttacks.
const attackIndex = new Map<string, Map<string, AttackDef>>();
for (const [kind, def] of Object.entries(enemies) as [string, EnemyDef][]) {
  const m = new Map<string, AttackDef>();
  if (def.attack) m.set(def.attack.name, def.attack);
  for (const a of def.extraAttacks ?? []) m.set(a.name, a);
  attackIndex.set(kind, m);
}

/** The kind's attack called `name` (its primary attack or one of its extraAttacks), or null. */
export function attackByName(kind: EnemyKind, name: string): AttackDef | null {
  return attackIndex.get(kind)?.get(name) ?? null;
}
