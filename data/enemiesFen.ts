/**
 * The Glasswater Fen enemy kinds (M8, CONTENT §5): Glasspike, Copperback, Spark Heron, Slagshell,
 * Sparkfly, Mirebull, Bellows Toad and Bellshell. Life and damage are at area level 1 and scale per
 * DESIGN §7; Fen and Foundry rooms add the tier 8 rift scaling (data/progression.ts
 * regionDifficulty). Part of `enemies` (data/enemies.ts); types in data/enemyTypes.ts and
 * data/enemyTypesM8.ts.
 *
 * CONTENT gives life, speed, resistances, attack damage, windups and the chemistry numbers.
 * Values it doesn't give (radii, recover, cooldowns, attack ranges and shapes, knockback the row
 * doesn't name, aggro ranges, kiter strafing) are first guesses, listed in the M8 report.
 */
import type { EnemyDef } from './enemyTypes';

/** cos 30°: the half angle of a 60° cone. */
const COS_30 = 0.8660254037844387;
/** cos 53°: claw and horn cones about 106° wide. */
const COS_53 = 0.6;

/** Grounds whose slow a wading kind ignores (Spark Heron). */
export const wadeGrounds = ['shallow_water'] as const;

export const fenEnemies = {
  glasspike: {
    name: 'Glasspike',
    life: 45,
    speed: 18,
    radius: 1.3,
    resist: { physical: 0, fire: 0, frost: 0, storm: -0.3 },
    knockbackScale: 0,
    aggroRange: 30,
    attack: {
      name: 'pike_leap',
      damage: 16,
      damageType: 'physical',
      // The 0.8 s flash with the landing circle, then a 0.5 s leap; the bite lands on touchdown.
      windup: 0.8,
      active: 0.5,
      recover: 0.6,
      cooldown: 3,
      // Leaps when the player is within about 16 cells (centers) of it, at the water's edge.
      range: 13,
      knockback: 2,
      // The 3-cell landing circle, placed where it will land (ai/leaper.ts).
      shape: { kind: 'circle', r: 3, offset: 0 },
      targeted: true,
      leap: { seconds: 0.5 },
    },
    behavior: { kind: 'leaper', driftSpeed: 1, landReach: 4 },
    locomotion: 'swim',
    chemistry: { alwaysWet: true, ignoresHazards: true },
  },
  copperback: {
    name: 'Copperback',
    life: 110,
    speed: 12,
    radius: 1.8,
    resist: { physical: 0, fire: 0, frost: -0.25, storm: 0.75 },
    knockbackScale: 0.4,
    aggroRange: 36,
    attack: {
      name: 'copper_pinch',
      damage: 12,
      damageType: 'physical',
      // The 0.5 s claw raise.
      windup: 0.5,
      active: 0.1,
      recover: 0.5,
      cooldown: 1.8,
      // 3-cell reach past its body.
      range: 3,
      knockback: 1,
      shape: { kind: 'cone', r: 4.8, halfAngleCos: COS_53, offset: 0 },
    },
    behavior: { kind: 'swarm', offsetPerCell: 0.2, offsetMax: 4 },
    chemistry: { conductorBody: { seconds: 3, attackStorm: 12, pulseEvery: 1, pulseDamage: 12 } },
  },
  spark_heron: {
    name: 'Spark Heron',
    life: 55,
    speed: 15,
    radius: 1.6,
    resist: { physical: 0, fire: 0, frost: 0, storm: 0.5 },
    knockbackScale: 0.8,
    aggroRange: 45,
    preferredRange: { min: 18, max: 28 },
    attack: {
      name: 'heron_beak',
      damage: 18,
      damageType: 'storm',
      // 1.0 s of beak glow, with a ring on the target water.
      windup: 1,
      active: 0.15,
      recover: 0.5,
      cooldown: 3.2,
      range: 32,
      knockback: 0,
      shape: { kind: 'circle', r: 3, offset: 0 },
      targeted: true,
      terrain: { kind: 'element', element: 'storm' },
    },
    extraAttacks: [
      {
        // Every 5 s a lobbed puddle at a dry player, with a 0.8 s landing marker.
        name: 'puddle_spit',
        damage: 6,
        damageType: 'physical',
        windup: 0.8,
        active: 0.1,
        recover: 0.4,
        cooldown: 5,
        every: 5,
        range: 30,
        knockback: 0,
        shape: { kind: 'circle', r: 3, offset: 0 },
        targeted: true,
        terrain: { kind: 'water', radius: 3, seconds: 6 },
        onlyDryTarget: true,
      },
    ],
    behavior: {
      kind: 'kite',
      panicRange: 10,
      strafeSpeed: 0.5,
      retreatSpeed: 1,
      strafeFlipMin: 1.4,
      strafeFlipMax: 3,
      wallProbe: 4,
    },
    // The Stormcaller's rule, reaching 10 cells from the player; shallow water doesn't slow it.
    chemistry: { conductorTarget: 10, wades: true },
  },
  slagshell: {
    name: 'Slagshell',
    life: 180,
    speed: 9,
    radius: 2.4,
    resist: { physical: 0, fire: 0.75, frost: -0.25, storm: 0 },
    knockbackScale: 0.3,
    aggroRange: 36,
    attack: {
      name: 'slag_slam',
      damage: 24,
      damageType: 'fire',
      windup: 0.9,
      active: 0.15,
      recover: 0.9,
      cooldown: 3,
      range: 2.5,
      knockback: 3,
      shape: { kind: 'circle', r: 5, offset: 0 },
      // Placed fire in the circle (rule 26).
      terrain: { kind: 'element', element: 'fire' },
    },
    behavior: { kind: 'swarm', offsetPerCell: 0.1, offsetMax: 3 },
    chemistry: { hotShell: { hotTaken: 0.3, crackedTaken: 1.25, crackedSpeed: 0.7, crackedSeconds: 6 } },
  },
  sparkfly: {
    name: 'Sparkfly',
    life: 8,
    speed: 24,
    radius: 0.7,
    resist: { physical: 0, fire: -0.25, frost: 0, storm: 0.75 },
    knockbackScale: 1,
    aggroRange: 36,
    attack: {
      name: 'spark_zap',
      damage: 3,
      damageType: 'storm',
      // The 0.25 s flicker.
      windup: 0.25,
      active: 0.1,
      recover: 0.3,
      cooldown: 0.9,
      range: 0.8,
      knockback: 0,
      shape: { kind: 'circle', r: 1.2, offset: 0.7 },
    },
    behavior: { kind: 'swarm', offsetPerCell: 0.4, offsetMax: 6 },
    locomotion: 'float',
    chemistry: {
      deathCharge: { damage: 6, reach: 8, seconds: 0.5 },
      lightLure: { range: 12, seconds: 3, orbit: 3 },
      chargeFromBelow: true,
    },
  },
  mire_bull: {
    name: 'Mirebull',
    life: 140,
    speed: 11,
    radius: 2.2,
    resist: { physical: 0, fire: 0, frost: 0, storm: 0 },
    knockbackScale: 0.3,
    aggroRange: 40,
    attack: {
      name: 'bull_gore',
      damage: 14,
      damageType: 'physical',
      windup: 0.5,
      active: 0.1,
      recover: 0.6,
      cooldown: 1.8,
      range: 2.5,
      knockback: 2,
      shape: { kind: 'cone', r: 5, halfAngleCos: COS_53, offset: 0 },
    },
    extraAttacks: [
      {
        name: 'bull_charge',
        damage: 22,
        damageType: 'physical',
        // The 0.9 s line telegraph; its length is set to the planned run (ai/charger.ts).
        windup: 0.9,
        active: 0.4,
        recover: 0.8,
        cooldown: 5,
        range: 36,
        knockback: 5,
        shape: { kind: 'line', length: 36, width: 4.4, offset: 0 },
        dash: { speed: 38, maxLength: 36, reach: 0.6 },
      },
    ],
    behavior: {
      kind: 'charger',
      charge: 'bull_charge',
      chargeMin: 10,
      chargeMax: 36,
      overshoot: 6,
      minLength: 8,
      iceLengthMult: 1.5,
      wallStun: 1.5,
      bogSeconds: 2.5,
      boggedTaken: 1.5,
    },
  },
  bellows_toad: {
    name: 'Bellows Toad',
    life: 70,
    speed: 10,
    radius: 1.8,
    resist: { physical: 0, fire: -0.25, frost: 0, storm: 0 },
    knockbackScale: 0.6,
    aggroRange: 36,
    // Keeps 10–16 cells away (CONTENT §5).
    preferredRange: { min: 10, max: 16 },
    attack: {
      name: 'croak',
      damage: 10,
      damageType: 'physical',
      // Inflates for 1.0 s, visibly swelling, over the cone telegraph.
      windup: 1,
      active: 0.2,
      recover: 0.6,
      cooldown: 3.5,
      range: 10,
      knockback: 6,
      shape: { kind: 'cone', r: 14, halfAngleCos: COS_30, offset: 0 },
      // A 2 s enemy gust over the cone (rule 21).
      terrain: { kind: 'gust', seconds: 2, angleDeg: 60 },
    },
    behavior: {
      kind: 'kite',
      panicRange: 6,
      strafeSpeed: 0.5,
      retreatSpeed: 1,
      strafeFlipMin: 1.4,
      strafeFlipMax: 3,
      wallProbe: 3,
    },
    chemistry: { gasbag: { attack: 'croak', radius: 4, damage: 20, lifeLoss: 0.15, stun: 1.5 } },
  },
  bellshell: {
    name: 'Bellshell',
    life: 150,
    speed: 8,
    radius: 2.2,
    resist: { physical: 0, fire: 0.25, frost: 0.25, storm: 0.5 },
    knockbackScale: 0.2,
    aggroRange: 30,
    attack: {
      name: 'bell_bite',
      damage: 16,
      damageType: 'physical',
      windup: 0.7,
      active: 0.1,
      recover: 0.7,
      cooldown: 2.2,
      range: 2,
      knockback: 2,
      shape: { kind: 'cone', r: 4.5, halfAngleCos: COS_53, offset: 0 },
    },
    behavior: { kind: 'swarm', offsetPerCell: 0.1, offsetMax: 3 },
    chemistry: { bell: { shelledTaken: 0.1, stun: 2.5, openSeconds: 5, openTaken: 1.25, cooldown: 6 } },
  },
} satisfies Record<string, EnemyDef>;
