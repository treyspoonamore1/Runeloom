/**
 * Bosses (CONTENT §5, DESIGN §10.3): the Tar Matriarch (mini-boss, K5) and the Cinder Warden
 * (K10); M8's Old Bellwether and Glasswater Coil are in data/bossesFen.ts. Their life and attack damage are absolute: no area-level scaling and no monster rarity.
 * Part of `enemies` (data/enemies.ts). Their state machines are in src/sim/ai/bosses; the
 * fight's feel numbers (phase thresholds, Superheat, flood, brazier storm timing) are in
 * data/tuning.ts `bosses`. Values CONTENT doesn't give (speeds, radii, recover, cooldowns,
 * ranges, the breath cone's width, the charge's speed) are first guesses, listed in the M4 report.
 */
import type { EnemyDef } from './enemyTypes';
import { fenBosses } from './bossesFen';

/** cos 30°: the fire breath is a 60° cone. */
const COS30 = 0.8660254037844387;

const m4Bosses = {
  tar_matriarch: {
    name: 'Tar Matriarch',
    life: 5000,
    speed: 10,
    radius: 3.6,
    resist: { physical: 0, fire: -0.3, frost: 0, storm: 0 },
    knockbackScale: 0,
    aggroRange: 60,
    isBoss: true,
    level: 8,
    attack: {
      name: 'matriarch_slam',
      damage: 30,
      damageType: 'physical',
      windup: 1,
      active: 0.15,
      recover: 1,
      cooldown: 3.5,
      range: 3,
      knockback: 4,
      shape: { kind: 'circle', r: 6, offset: 0 },
    },
    extraAttacks: [
      {
        // Lobbed: the 0.8 s windup is the flight; the landing marker is the hit and the splat.
        // Her splats are tar: fire on them is world-owned and hurts everyone (CONTENT §5).
        name: 'tar_glob',
        damage: 15,
        damageType: 'physical',
        windup: 0.8,
        active: 0.1,
        recover: 0.5,
        cooldown: 2.6,
        range: 36,
        knockback: 0,
        shape: { kind: 'circle', r: 4, offset: 0 },
        targeted: true,
        terrain: { kind: 'oil', radius: 4, tar: true },
      },
      {
        // Phase 2: a rush at where the player stood (like the Warden's charge, shorter), 25 on
        // contact, smearing her tar along the way (ai/bosses/matriarch.ts).
        name: 'tar_rush',
        damage: 25,
        damageType: 'physical',
        windup: 0.9,
        active: 1,
        recover: 0.8,
        cooldown: 6,
        range: 40,
        knockback: 4,
        // Width covers her body plus the contact reach; length is set to the dash at windup.
        shape: { kind: 'line', length: 32, width: 8.6, offset: 0 },
        dash: { speed: 40, maxLength: 32, reach: 0.5, tarTrailRadius: 2.4 },
      },
      {
        // At 50% life: calls her tar crew, 2 Tar Hulks and 4 Tinderlings (ai/bosses/hooks.ts). No damage.
        name: 'summon_hulks',
        damage: 0,
        damageType: 'physical',
        windup: 1.2,
        active: 0.2,
        recover: 0.6,
        cooldown: 0,
        range: 999,
        knockback: 0,
        shape: { kind: 'circle', r: 5, offset: 0 },
      },
    ],
    behavior: { kind: 'boss', boss: 'tar_matriarch' },
    // The Tar Hulk's blast, but she lives through it (ai/bosses/flare.ts): lit while Oiled, she
    // flares after the Hulk's 1.5 s fuse in its 6-cell world-owned burst and burns herself.
    chemistry: {
      flare: { fuse: 1.5, radius: 6, damage: 35, selfDamage: 250, cooldown: 10 },
    },
  },
  cinder_warden: {
    name: 'Cinder Warden',
    life: 5000,
    speed: 13,
    radius: 4,
    resist: { physical: 0, fire: 0.75, frost: -0.25, storm: 0.25 },
    knockbackScale: 0,
    aggroRange: 90,
    isBoss: true,
    level: 10,
    attack: {
      name: 'fire_slam',
      damage: 40,
      damageType: 'fire',
      windup: 0.8,
      active: 0.15,
      recover: 0.9,
      cooldown: 3.5,
      range: 3,
      knockback: 3,
      shape: { kind: 'circle', r: 6, offset: 0 },
      terrain: { kind: 'element', element: 'fire' },
    },
    extraAttacks: [
      {
        // A straight run at where the player stood, 30 on contact, leaving placed fire.
        name: 'charge',
        damage: 30,
        damageType: 'physical',
        windup: 1,
        active: 1,
        recover: 0.9,
        cooldown: 6.5,
        range: 60,
        knockback: 4,
        // Width covers his body plus the contact reach; length is set to the dash at windup.
        shape: { kind: 'line', length: 44, width: 9, offset: 0 },
        dash: { speed: 46, maxLength: 44, reach: 0.5, fireTrailRadius: 1.6 },
      },
      {
        // Phases 2–3. Fire on water makes steam (rule 4).
        name: 'fire_breath',
        damage: 18,
        damageType: 'fire',
        windup: 0.6,
        active: 0.3,
        recover: 0.6,
        cooldown: 4.5,
        range: 9,
        knockback: 0,
        shape: { kind: 'cone', r: 12, halfAngleCos: COS30, offset: 0 },
        terrain: { kind: 'element', element: 'fire' },
      },
      {
        // Phase 2 begins: the channels overflow (ai/bosses/flood.ts). No damage.
        name: 'flood',
        damage: 0,
        damageType: 'physical',
        windup: 1.5,
        active: 0.3,
        recover: 0.8,
        cooldown: 0,
        range: 999,
        knockback: 0,
        shape: { kind: 'circle', r: 8, offset: 0 },
      },
      {
        // Phase 3 begins: he calls lightning onto the braziers (ai/bosses/braziers.ts). No damage.
        name: 'call_storm',
        damage: 0,
        damageType: 'physical',
        windup: 1.2,
        active: 0.3,
        recover: 0.8,
        cooldown: 0,
        range: 999,
        knockback: 0,
        shape: { kind: 'circle', r: 8, offset: 0 },
      },
    ],
    behavior: { kind: 'boss', boss: 'cinder_warden' },
  },
} satisfies Record<string, EnemyDef>;

/**
 * Rift bosses (M6, "variants are fine"): the Matriarch and the Warden in rift arenas, with the
 * same fights. Their numbers are the M4 ones at their own `level`; a rift scales them to its area
 * level (actors/enemies.ts spawnEnemy, world/rift/rules.ts). Separate kinds so a rift kill never
 * counts as the region's boss kill.
 */
export const bosses = {
  ...m4Bosses,
  rift_matriarch: { ...m4Bosses.tar_matriarch, name: 'Rift Matriarch', lookAs: 'tar_matriarch' },
  rift_warden: { ...m4Bosses.cinder_warden, name: 'Rift Warden', lookAs: 'cinder_warden' },
  // M8: the Old Bellwether and the Glasswater Coil, and their rift versions (data/bossesFen.ts).
  ...fenBosses,
} satisfies Record<string, EnemyDef>;
