/**
 * Feel values (DESIGN §4). Every number here is a starting guess, editable live
 * in the F2 tuning panel. When the designer pastes tuning JSON back, apply it
 * here exactly.
 */
export const defaultTuning = {
  player: {
    /** Collision radius in cells. */
    radius: 1.5,
    /** Top speed, cells per second. */
    moveSpeed: 26,
    /** Seconds from standstill to top speed. */
    accelTime: 0.06,
    /** Seconds from top speed to standstill. */
    decelTime: 0.05,
    /** Cells travelled by one dodge. */
    dodgeDistance: 12,
    /** Seconds one dodge takes. */
    dodgeDuration: 0.18,
    /** Invulnerable seconds from dodge start. */
    dodgeIframes: 0.15,
    dodgeCharges: 2,
    /** Seconds to regain one dodge charge. */
    dodgeRecharge: 1.4,
    /** Cast time divisor (DESIGN §5.4); spindles change it from M2. */
    castSpeed: 1,
    /** Fraction of a spell's cast time after which it releases (mana is paid then). */
    castReleaseFraction: 0.25,
    /** Seconds dead before respawning at the room's Loom Stone. */
    respawnDelay: 2,
    /** Invulnerable seconds after respawning, so a camped spawn can't chain-kill. */
    respawnIframes: 1,
  },
  /** DESIGN §7 formulas. Balance values the balance sim tunes. */
  combat: {
    /** Base crit multiplier (150%). */
    critMultiplier: 1.5,
    /** Highest resistance any target can have (player cap 75%; enemy data stays within it). */
    resistCap: 0.75,
    /** Enemy life multiplier per area level above 1. */
    enemyLifeGrowth: 1.12,
    /** Enemy damage multiplier per area level above 1. */
    enemyDamageGrowth: 1.09,
    playerBaseLife: 80,
    playerLifePerLevel: 12,
    playerBaseMana: 50,
    playerManaPerLevel: 4,
    /** Mana regenerated per second, as a fraction of max mana. */
    manaRegen: 0.03,
  },
  /** Hit feel (DESIGN §4). */
  feel: {
    /** Seconds the sim freezes on a crit. */
    hitstopCrit: 0.03,
    /** Seconds the sim freezes when Strike kills. */
    hitstopStrikeKill: 0.06,
    /**
     * Knockback decay time constant in seconds. Velocity loses DT/knockbackTime of itself per tick,
     * so an impulse of distance/knockbackTime travels the full knockback distance (CONTENT values
     * are distances). Must be longer than one tick.
     */
    knockbackTime: 0.08,
    /** Knockback velocity (cells/s) below which it stops. Leaves at most this × knockbackTime untravelled. */
    knockbackStopSpeed: 0.5,
  },
  enemies: {
    /** Soft separation: push speed (cells/s) per cell of overlap between two bodies. */
    separationStiffness: 12,
    /** Cap on the separation push speed, cells/s. */
    separationMaxSpeed: 20,
    /** Grid spacing in cells when a room @spawn places several enemies on one marker. */
    spawnSpacing: 3,
  },
  camera: {
    /** Look-ahead toward the cursor as a fraction of the screen size. */
    lookAhead: 0.15,
    /** Seconds for the camera to close most of the gap to its target (lower is snappier). */
    smoothing: 0.1,
    /** Extra zoom on top of resolution scaling. */
    zoom: 1,
  },
};

export type Tuning = typeof defaultTuning;

export function cloneTuning(t: Tuning = defaultTuning): Tuning {
  return JSON.parse(JSON.stringify(t)) as Tuning;
}
