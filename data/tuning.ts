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
    manaRegen: 0.08,
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
  /** Enemy AI shared by every kind (per-kind behavior lives in data/enemies.ts). */
  ai: {
    /** Aggroed enemies farther than this many cells from the player give up and go idle. */
    leashRange: 200,
    /** An enemy that notices the player alerts idle enemies within this many cells of it. */
    alertRadius: 12,
    /** Each enemy re-checks line of sight every this many ticks (staggered by id). */
    losCheckTicks: 4,
    /** The flow field toward the player is rebuilt at least every this many ticks. */
    flowRecomputeTicks: 10,
    /** Most seconds of random delay added to the first attack after aggro (reaction time). */
    reactionJitter: 0.3,
    /** Most seconds of random delay added to every attack cooldown, so packs don't sync up. */
    cooldownJitter: 0.2,
  },
  /** Arena waves (src/sim/world/waves.ts); composition tables are in data/waves.ts. */
  arena: {
    /** Seconds from the start of an arena game to wave 1. */
    firstWaveDelay: 2,
    /** Seconds between clearing a wave and the next one starting. */
    intermission: 3,
    /** Seconds over which a wave's enemies trickle in. */
    spawnStagger: 1.5,
    /** Spawn points are at least this many cells from the player. */
    minSpawnDistance: 25,
    /** Spawn points lie within this many tiles of the room's outer edge. */
    spawnEdgeTiles: 4,
    /** Most cells a spawn is jittered from its tile center, each axis. */
    spawnJitter: 1,
  },
  camera: {
    /** Look-ahead toward the cursor as a fraction of the screen size. */
    lookAhead: 0.15,
    /**
     * Follow smoothing time constant in seconds: the camera closes 63% of the gap
     * to its target in this time, 95% in three times it (lower is snappier, 0 locks on).
     */
    smoothing: 0.1,
    /** Extra zoom on top of resolution scaling. */
    zoom: 1,
    /** Cells of void the view may show beyond the room edge when the room is larger than the view. */
    edgeMargin: 2,
  },
};

export type Tuning = typeof defaultTuning;

export function cloneTuning(t: Tuning = defaultTuning): Tuning {
  return JSON.parse(JSON.stringify(t)) as Tuning;
}
