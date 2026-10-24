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
    /**
     * "Closer pays more" (DESIGN §2.1, CONTENT §1.2): Strike and Nova restore mana for each enemy
     * they hit within `range` cells of the player (centers, at hit time), at most
     * `capPerInstance` per spell instance, however the spell was cast.
     */
    manaOnHit: {
      /** Mana per enemy a Strike hits. */
      strike: 2,
      /** Mana per enemy a Nova hits. */
      nova: 1,
      /** The enemy must be within this many cells of the player. */
      range: 8,
      /** Most mana one spell instance restores. */
      capPerInstance: 6,
    },
  },
  /** Hit feel (DESIGN §4). */
  feel: {
    /** Seconds the sim freezes on a crit. */
    hitstopCrit: 0.03,
    /** Seconds the sim freezes when Strike kills. */
    hitstopStrikeKill: 0.06,
    /** Seconds the sim freezes when a Frozen enemy is killed by a hit (Shatter). Never from damage over time. */
    hitstopShatter: 0.08,
    /**
     * Knockback decay time constant in seconds. Velocity loses DT/knockbackTime of itself per tick,
     * so an impulse of distance/knockbackTime travels the full knockback distance (CONTENT values
     * are distances). Must be longer than one tick.
     */
    knockbackTime: 0.08,
    /** Knockback velocity (cells/s) below which it stops. Leaves at most this × knockbackTime untravelled. */
    knockbackStopSpeed: 0.5,
  },
  /**
   * Entity ailments (DESIGN §6.4; src/sim/combat/ailments.ts). Magnitudes are computed from the
   * hit's damage of the matching type after resistance and before Shock. Durations from hits are
   * multiplied by the hit's DamagePacket.ailmentDuration (Lingering).
   */
  ailments: {
    /** Ignite damage per second as a fraction of the triggering hit's fire damage. */
    igniteDpsFraction: 0.5,
    /** Seconds an Ignite lasts. */
    igniteDuration: 3,
    /** Chill points per (frost damage ÷ max life): 200 means a hit for 50% of max life adds 100. */
    chillPerLifeFraction: 200,
    /** Slow (fraction of movement and action speed) per chill point: 0.003 = 0.3%. */
    chillSlowPerPoint: 0.003,
    /** Highest slow from chill. */
    chillSlowMax: 0.3,
    /** Chill points lost per second. */
    chillDecay: 25,
    /** Chill points that freeze; chill never goes above this. Freezing consumes the chill. */
    freezeThreshold: 100,
    /** Seconds a Freeze lasts. */
    freezeDuration: 1.2,
    /** Boss chill rule: flat chill points per frost hit, whatever its damage. */
    bossChillPerHit: 12,
    /** Boss chill rule: chill points lost per second. */
    bossChillDecay: 10,
    /** Boss chill rule: highest slow from chill. */
    bossChillSlowMax: 0.15,
    /** Boss chill rule: seconds a Freeze lasts. */
    bossFreezeDuration: 0.8,
    /** Boss chill rule: seconds after a Freeze ends during which the boss can't be frozen. */
    bossFreezeImmunity: 6,
    /** Chill gain multiplier while Wet (DESIGN §6.4). */
    wetChillMultiplier: 1.5,
    /** Shock effect (fraction of increased damage taken) per (storm damage ÷ max life). */
    shockPerLifeFraction: 1,
    /** Weakest Shock: 5% increased damage taken. */
    shockMin: 0.05,
    /** Strongest Shock: 50% increased damage taken. */
    shockMax: 0.5,
    /** Seconds a Shock lasts. */
    shockDuration: 4,
    /** Player-side limit: longest Freeze on the player, seconds. */
    playerFreezeMax: 0.6,
    /** Player-side limit: strongest Shock on the player. */
    playerShockMax: 0.3,
    /** Seconds between 'dot' events per target while it burns (damage numbers without spam). */
    dotReportInterval: 0.5,
  },
  enemies: {
    /** Soft separation: push speed (cells/s) per cell of overlap between two bodies. */
    separationStiffness: 12,
    /** Cap on the separation push speed, cells/s. */
    separationMaxSpeed: 20,
    /** Grid spacing in cells when a room @spawn places several enemies on one marker. */
    spawnSpacing: 3,
  },
  /**
   * Boss fights (DESIGN §10.3, CONTENT §5; src/sim/ai/bosses). Attack numbers are in
   * data/bosses.ts; these are the fight's pacing and rule numbers.
   */
  bosses: {
    /** Tar Matriarch: summons her Tar Hulks when her life falls to this fraction. */
    matriarchSummonAt: 0.5,
    /** Tar Matriarch: Tar Hulks she summons. */
    matriarchSummonCount: 2,
    /** Tar Matriarch: cells from her center the summoned Hulks appear. */
    matriarchSummonDistance: 8,
    /** Tar Matriarch: Tinderlings she summons with her Hulks (their fire lights her tar). */
    matriarchSummonTinderlings: 4,
    /** Tar Matriarch: cells from her center the summoned Tinderlings appear (on her tar, which they light). */
    matriarchTinderlingDistance: 6,
    /** Tar Matriarch phase 2: she walks this many times faster. */
    matriarchPhase2Speed: 1.35,
    /** Tar Matriarch phase 2: her slam and glob cooldowns are this many times as long. */
    matriarchPhase2Cooldown: 0.75,
    /** Tar Matriarch phase 2: rushes only at a player at least this many cells away (centers). */
    matriarchRushMinDistance: 9,
    /** Tar Matriarch phase 2: the rush runs this many cells past where the player stood (walls permitting). */
    matriarchRushOvershoot: 6,
    /** Tar Matriarch phase 2: shortest rush worth starting, cells. */
    matriarchRushMinLength: 10,
    /** Cinder Warden: phase 2 starts at this fraction of life. */
    wardenPhase2At: 0.66,
    /** Cinder Warden: phase 3 starts at this fraction of life. */
    wardenPhase3At: 0.33,
    /** Superheated (phases 2–3): fraction of damage he still takes (0.3 = 70% less). */
    superheatDamageTaken: 0.3,
    /** Seconds a Freeze breaks Superheat for, counted from the moment he freezes. */
    superheatBreakSeconds: 4,
    /** Phase 2 flood: the water spreads from the channels until this fraction of the floor is water. */
    floodFraction: 0.5,
    /** Phase 3: seconds from one brazier storm to the next. */
    brazierStormPeriod: 5,
    /** Phase 3: seconds the braziers glow before the lightning lands. */
    brazierGlowSeconds: 1.2,
    /** Phase 3: seconds from the storm call to the first glow. */
    brazierFirstDelay: 1.5,
    /** Phase 3: Storm damage the brazier lightning electrifies water and metal with (absolute). */
    brazierStormDamage: 35,
    /** Bosses walk at least this many seconds between attacks (keeps a readable rhythm). */
    attackGap: 0.6,
    /** Cinder Warden: charges only at a player at least this many cells away (centers). */
    wardenChargeMinDistance: 14,
    /** Cinder Warden: the charge runs this many cells past where the player stood (walls permitting). */
    wardenChargeOvershoot: 10,
    /** Cinder Warden: shortest charge worth starting, cells (a wall closer than this: no charge). */
    wardenChargeMinLength: 12,
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
  /**
   * Chemistry grid rules (DESIGN §6.3; src/sim/grid). Per-material numbers live in
   * data/materials.ts. Seconds are converted to 20 Hz grid ticks.
   */
  grid: {
    /** Rule 2 wind factor on spread chance. 1 until Gale and rule 21 arrive (M8). */
    windFactor: 1,
    /** Scales every fire spread roll (rule 2): the fire-speed knob. 0.85 after the M3 playtest ("a little too fast"). */
    spreadMult: 0.85,
    /** Burn intensity (0–255) by what burns: flammable materials, oil (rule 6 "hot"), placed fire (rule 26). */
    fireIntensity: { material: 192, oil: 255, placed: 128 },
    /** Rule 26: seconds placed fire burns on walkable non-flammable ground (× Lingering). */
    placedFireSeconds: 1,
    /** Rule 14: chance per hit cell that Storm ignites a dry flammable cell. */
    stormIgniteChance: 0.15,
    /** Rule 4: steam covers every hit water cell plus this many cells around it (1 = 3×3). */
    steamRadius: 1,
    /** Dense smoke fills cells within this many steps (4-neighbor) of the burning cell; light smoke only the cell. */
    denseSmokeRadius: 1,
    /** Rule 11: electrified water. */
    water: {
      chargeSeconds: 1,
      maxCells: 600,
      /** Flood-fill steps from the hit; also the falloff distance (1 − d / maxDistance). */
      maxDistance: 40,
      minFalloff: 0.25,
      /** Fraction of the triggering hit's Storm damage per entity (before falloff). */
      damageMult: 1,
    },
    /** Rule 12: electrified metal networks (no falloff). */
    metal: { chargeSeconds: 1.5, maxCells: 2000, damageMult: 0.6 },
    /** Rule 13: most water ↔ metal hand-offs one Storm hit can chain through. */
    chargeMaxHops: 4,
    /** Oil barrel explosion (DESIGN §6.2): world-owned fire burst, damage scaled like enemy damage (§7). */
    explosion: { radius: 4, damage: 30, oilRadius: 3 },
    /** DESIGN §6.4: terrain-fire ignite DPS = this fraction of refLife(area level) per second. */
    terrainFireLifeFraction: 0.1,
    /**
     * Above this area level terrain fire grows like monster damage (enemyDamageGrowth), not like
     * monster life (M6.5): rifts reach level 30, where life growth made burning ground outpace
     * everything else. The region (levels 1–10) is unchanged.
     */
    terrainFireKneeLevel: 10,
    /** DESIGN §7: refLife(L) = refLifeBase × enemyLifeGrowth^(L − 1). */
    refLifeBase: 50,
  },
  /**
   * How entities (player and enemies) read the chemistry grid (DESIGN §6.3 rules 15–20, 22, 25;
   * §6.4 Wet, Oiled, Blind; src/sim/actors/terrain.ts). Per-material slows live in
   * data/materials.ts (moveMult), per-enemy chemistry in data/enemies.ts.
   */
  terrain: {
    /** Rule 15: seconds an entity stays Wet after leaving shallow water. */
    wetSeconds: 3,
    /** Rule 17: seconds an entity stays Oiled after leaving oil. */
    oiledSeconds: 5,
    /** Rule 18: Ignite damage multiplier while Oiled. */
    oiledIgniteMult: 2,
    /** Rule 19: a Shock landing on a Wet entity arcs to other Wet entities. */
    arc: {
      /** Most other Wet entities one shock arcs to. */
      maxTargets: 5,
      /** Arc reach in cells (centers). */
      range: 6,
      /** Fraction of the hit's damage each arc deals (Storm). */
      damageFraction: 0.3,
    },
    /** Rule 25: falling when the ground drops away (ice bridge breaks, bridge burns). */
    fall: {
      /** Damage as a fraction of max life. */
      lifeFraction: 0.1,
      /** Cells searched for safe ground when no safe spot was recorded. */
      searchRadius: 16,
    },
    /** Rule 20: radius in cells of a Shatter's frost burst (applies rules 7 and 8). */
    shatterRadius: 4,
    /** Hydromancer keystone (M4): radius in cells of the shallow water painted around the player each dodge tick. */
    hydromancerTrailRadius: 1.5,
    /** DESIGN §6.4 Blind: enemies in smoke or steam (or whose target is) can't see farther than this. */
    blindRange: 4,
    /** Slippery ice (feel): seconds from standstill to top speed on ice, player and enemies. */
    iceAccelTime: 0.45,
    /** Slippery ice (feel): seconds from top speed to standstill on ice. */
    iceDecelTime: 0.9,
    /**
     * Enemies avoid hazards that hurt them (burning or charged cells of another team or the
     * world): extra flow-field cost per hazardous tile (a straight tile step costs 2).
     */
    hazardTileCost: 8,
    /** Enemies look this many cells past their body edge for a hazard before stepping on it. */
    hazardProbe: 1.5,
    /** Knockback in cells from an explosion (grid.blasts), away from its center (feel). */
    blastKnockback: 3,
  },
  /** Floor loot (M4, src/sim/items/loot.ts). */
  loot: {
    /** Seconds after dropping before a drop can be picked up (so it is seen landing). */
    pickupDelay: 0.5,
    /** Pickup range from the player's center, cells. */
    pickupRadius: 4,
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
    /**
     * Fraction of the screen height the bottom HUD covers. The view may scroll this far past a
     * room's bottom edge, and small rooms center above it, so nothing hides behind the hotbar.
     */
    hudInset: 0.28,
  },
  /** Rooms, exits and puzzle objects (M4, src/sim/world). */
  world: {
    /** Seconds of walking into a push or ice block before it moves one tile (feel). */
    pushTime: 0.4,
    /** How far a pushed block travels per second, tiles (visual; the block occupies its new tile at once). */
    blockMoveSpeed: 5,
    /** How fast an ice block slides on ice, tiles per second (feel). */
    iceSlideSpeed: 9,
    /** Pushing counts only when the move input along the block's axis is at least this (0–1). */
    pushInputMin: 0.6,
    /** Cells of slack beyond the player's radius that still count as touching a solid object (chest, door). */
    touchSlack: 0.35,
    /** Cells from a pickup's or Loom Stone's tile center that count as touching it. */
    pickupRadius: 2.5,
    /** Cells from a Loom Stone's tile center within which the player can rest or fast travel. */
    loomStoneRange: 4,
    /** Cells from a Hearth station tile's center within which Interact (F) uses it (M7, about 1.5 tiles). */
    stationReach: 6,
    /** An exit triggers when the player's center is within radius + this many cells of the room edge, facing out. */
    exitSlack: 0.3,
  },
  rift: {
    /**
     * Fraction of max life and mana restored when a rift room is cleared (M6). Rifts have no
     * Loom Stones and the player has no life regeneration, so without it 6–10 rooms and a boss
     * would be one life bar (feel).
     */
    roomClearHeal: 0.3,
  },
};

export type Tuning = typeof defaultTuning;

/**
 * A deep copy of `t`. Values missing from `t` (tuning saved before a section existed, e.g. an
 * old replay) are filled in from the defaults.
 */
export function cloneTuning(t: Tuning = defaultTuning): Tuning {
  const copy = JSON.parse(JSON.stringify(t)) as Tuning;
  if (t !== defaultTuning) fillMissing(copy as unknown as Obj, defaultTuning as unknown as Obj);
  return copy;
}

type Obj = Record<string, unknown>;

function fillMissing(dst: Obj, defaults: Obj): void {
  for (const [k, v] of Object.entries(defaults)) {
    const cur = dst[k];
    if (cur === undefined) dst[k] = JSON.parse(JSON.stringify(v)) as unknown;
    else if (v !== null && typeof v === 'object' && cur !== null && typeof cur === 'object')
      fillMissing(cur as Obj, v as Obj);
  }
}
