/**
 * The Drowned Foundry's bosses (M8; CONTENT §5, §13.2, DESIGN §10.5): the Old Bellwether
 * (mini-boss, F5) and the Glasswater Coil (F10), and their rift versions (CONTENT §10.1). Life and
 * attack damage are absolute, at their own levels (22 and 24); the Fen's tier 8 region difficulty
 * doesn't apply to bosses. Their state machines are src/sim/ai/bosses/bellwether.ts and coil.ts;
 * the fights' pacing and rule numbers are data/tuningFenBosses.ts (tuning.bosses). Values CONTENT
 * doesn't give (speeds, radii, recover, cooldowns, ranges, the lunge's contact reach, the wave's
 * thickness) are first guesses, listed in the M8 report.
 */
import type { RuneId } from './runes';
import type { EnemyDef } from './enemyTypes';

/** cos 35°: the Snap is a 70° cone. */
const COS35 = 0.8191520442889918;

const fenBossDefs = {
  bellwether: {
    name: 'Old Bellwether',
    // CONTENT §5 says 20,000; 18,000 brings the boss bot's kill into 60–100 s (DECISIONS).
    life: 18000,
    speed: 9,
    radius: 4.5,
    resist: { physical: 0, fire: 0.25, frost: 0.25, storm: 0.5 },
    knockbackScale: 0,
    aggroRange: 70,
    isBoss: true,
    level: 22,
    attack: {
      name: 'bell_snap',
      damage: 110,
      damageType: 'physical',
      windup: 0.8,
      active: 0.15,
      recover: 0.8,
      cooldown: 3,
      range: 4,
      knockback: 3,
      shape: { kind: 'cone', r: 9, halfAngleCos: COS35, offset: 0 },
    },
    extraAttacks: [
      {
        // The shell glows 1.2 s with a ring marker out to 18 cells, then a ring wave expands from
        // it to 18 cells over the 0.4 s active phase (combat/enemyWave.ts).
        name: 'toll_ring',
        damage: 90,
        damageType: 'physical',
        windup: 1.2,
        active: 0.4,
        recover: 0.8,
        cooldown: 8,
        range: 16,
        knockback: 0,
        shape: { kind: 'circle', r: 18, offset: 0 },
        wave: { width: 3 },
      },
      {
        // At a far player: tucks in and rolls (CONTENT §5), 50% farther on ice, stunned on a wall.
        name: 'shell_roll',
        damage: 120,
        damageType: 'physical',
        windup: 0.9,
        active: 1,
        recover: 1,
        cooldown: 7,
        range: 60,
        knockback: 5,
        // Width covers its body plus the contact reach; length is set to the roll at windup.
        shape: { kind: 'line', length: 36, width: 10, offset: 0 },
        dash: { speed: 40, maxLength: 36, reach: 0.5 },
        roll: { iceLengthMult: 1.5, wallStun: 1 },
      },
      {
        // Phase 2, every tuning.bosses.bellwetherTollEvery s: the shell glows violet 1.2 s, then
        // enemy charge in the water and metal under it (rules 11–13). It never rings itself.
        name: 'self_toll',
        damage: 90,
        damageType: 'storm',
        windup: 1.2,
        active: 0.2,
        recover: 0.6,
        cooldown: 0,
        range: 999,
        knockback: 0,
        shape: { kind: 'circle', r: 4.5, offset: 0 },
        terrain: { kind: 'element', element: 'storm' },
      },
      {
        // At half life it tolls the Foundry (phase 2): calls a sparkfly_cloud. No damage.
        name: 'toll_foundry',
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
    behavior: { kind: 'boss', boss: 'bellwether' },
    // The Bellshell's bell (actors/fenShells.ts), a bigger one: 80% less damage while shelled.
    chemistry: { bell: { shelledTaken: 0.2, stun: 1.5, openSeconds: 5, openTaken: 1.25, cooldown: 8 } },
  },
  glasswater_coil: {
    name: 'Glasswater Coil',
    // CONTENT §5 says 32,000; 48,000 brings the boss bot's Tide-strand kill into 120–180 s (DECISIONS).
    life: 48000,
    speed: 16,
    // Its head circle: its hits and the hits it takes use it; the trailing body is drawn only.
    radius: 5,
    resist: { physical: 0, fire: 0, frost: 0, storm: 0.75 },
    knockbackScale: 0,
    aggroRange: 200,
    isBoss: true,
    level: 24,
    locomotion: 'swim',
    // Rule 31 for the Coil (DESIGN §10.5): after 5 s it crawls back at 6 cells/s, from as far as
    // any lure path reaches.
    swimmer: { crawlDelay: 5, crawlSpeed: 6, crawlReach: 48 },
    chemistry: { alwaysWet: true },
    attack: {
      // From water, at a player near its water: a 1.0 s ripple line, then a dash through the water
      // that stops at its edge; its head reaches `reach` past the bodies' edges.
      name: 'coil_lunge',
      damage: 150,
      damageType: 'physical',
      windup: 1,
      active: 0.5,
      recover: 0.9,
      cooldown: 6,
      range: 999,
      knockback: 4,
      shape: { kind: 'line', length: 27, width: 10, offset: 0 },
      // Its head strikes `reach` past the bodies' edges: from the water's edge it reaches a player
      // about 9 cells up the shore (phases 2–3 lunge only at one within 8).
      dash: { speed: 44, maxLength: 22, reach: 3 },
    },
    extraAttacks: [
      {
        // At a player far from its water: 0.6 s mouth glow and aim line, then a glass bolt that
        // lands where the player stood (ai/bosses/coilSpit.ts), leaving a puddle. Volleys of 3 in
        // phases 2–3.
        name: 'glass_spit',
        damage: 70,
        damageType: 'storm',
        windup: 0.6,
        active: 0.1,
        recover: 0.6,
        cooldown: 4,
        range: 80,
        knockback: 0,
        shape: { kind: 'line', length: 30, width: 2, offset: 0 },
        projectile: {
          kind: 'glass_spit',
          speed: 50,
          radius: 1,
          life: 2,
          pierce: 0,
          landWater: { radius: 2, seconds: 6 },
        },
      },
      {
        // Its only attack while Stranded.
        name: 'tail_thrash',
        damage: 100,
        damageType: 'physical',
        windup: 0.7,
        active: 0.15,
        recover: 0.8,
        cooldown: 2.5,
        range: 2,
        knockback: 5,
        shape: { kind: 'circle', r: 7, offset: 0 },
      },
      {
        // Phase 2 begins: it dives deeper. No damage.
        name: 'coil_dive',
        damage: 0,
        damageType: 'physical',
        windup: 1,
        active: 0.3,
        recover: 0.6,
        cooldown: 0,
        range: 999,
        knockback: 0,
        shape: { kind: 'circle', r: 6, offset: 0 },
      },
      {
        // Phase 3 begins: it calls the pylons. No damage.
        name: 'call_pylons',
        damage: 0,
        damageType: 'physical',
        windup: 1.2,
        active: 0.3,
        recover: 0.6,
        cooldown: 0,
        range: 999,
        knockback: 0,
        shape: { kind: 'circle', r: 6, offset: 0 },
      },
    ],
    behavior: { kind: 'boss', boss: 'glasswater_coil' },
  },
} satisfies Record<string, EnemyDef>;

/**
 * The Fen bosses and their rift versions (CONTENT §10.1): the same fights in the rift arenas
 * `belfry` and `glass_eye`, drawn and heard as their region originals, separate kinds so a rift
 * kill never counts as the region's boss kill.
 */
export const fenBosses = {
  ...fenBossDefs,
  rift_bellwether: { ...fenBossDefs.bellwether, name: 'Rift Bellwether', lookAs: 'bellwether' },
  rift_coil: { ...fenBossDefs.glasswater_coil, name: 'Rift Coil', lookAs: 'glasswater_coil' },
} satisfies Record<string, EnemyDef>;

/**
 * What the Fen bosses pay when they die, once per save (CONTENT §13.1–13.3, DESIGN §10.5): rune
 * copies at the Fen's rune level (the first Gale is an element "item get"), Pattern Seeds, and a
 * Rift Sigil (the Coil's tier 9, the first of the deep rifts). Their Fuse parts (data/fuseParts.ts)
 * and loot drop as every boss's do. Paid by src/sim/world/fenBossRewards.ts.
 */
export interface FenBossReward {
  runes: readonly RuneId[];
  runeLevel: number;
  patternSeeds: number;
  sigilTier: number | null;
}

export const fenBossRewards: Readonly<Record<'bellwether' | 'glasswater_coil', FenBossReward>> = {
  bellwether: { runes: ['on_hit', 'infuse'], runeLevel: 10, patternSeeds: 0, sigilTier: null },
  glasswater_coil: { runes: ['gale', 'nova'], runeLevel: 10, patternSeeds: 1, sigilTier: 9 },
};
