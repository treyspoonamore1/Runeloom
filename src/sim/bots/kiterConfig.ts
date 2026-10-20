/**
 * Heuristic weights for the kiter bot (bots/kiter.ts). These steer a test bot, not the game, so
 * they live beside it rather than in data/tuning.ts. Distances in cells, times in seconds.
 */
export const kiterConfig = {
  /** Seconds ahead each candidate move is scored at. */
  lookahead: 0.3,
  /** Samples along the lookahead when checking telegraphs and arrows. */
  samples: 6,
  /** Extra clearance around the player's body when testing telegraphs and arrows. */
  dangerMargin: 0.6,
  /** Score lost for ending a sample inside a telegraph or an arrow's path. */
  dangerPenalty: 5000,
  /** M4: score lost for a move that ends (or passes halfway) on fire or charge that would hurt. */
  hazardPenalty: 600,
  /** M4: while Ignited, run to water within this many cells (Wet puts it out). */
  waterSearch: 16,
  /** M4: against a Superheated Warden, fight from water within this many cells. */
  bossWaterSearch: 40,
  /** Melee enemies closer than this are pushed away (centers, cells). */
  keepTinderling: 5,
  keepShieldbearer: 5,
  /** While out of mana, keep this far from every melee enemy instead. */
  keepFleeing: 14,
  /** Penalty per squared cell inside a keep distance. */
  keepWeight: 6,
  /** In front of a Shieldbearer (dot with its facing above this), keep this far away. */
  shieldFrontDot: 0.3,
  keepShieldFront: 9,
  /** Penalty per squared cell closer to a wall than wallMargin. */
  wallMargin: 10,
  wallWeight: 1.5,
  /** Score per cell of getting closer to the engage point. */
  goalWeight: 3,
  /** Engage-distance multipliers: lower is preferred. */
  archerPreference: 0.6,
  shieldPreference: 1.6,
  /** M4: Brood Kilns first: killing the kiln ends the stream of mites. */
  spawnerPreference: 0.25,
  /** M4: wallMargin while going for a Brood Kiln (its tile counts as a wall). */
  wallMarginAtSpawner: 3,
  /** Engage-distance multiplier for an enemy at 0 life, rising linearly to 1 at full life. */
  hurtPreference: 0.4,
  /** Cells behind a Shieldbearer the bot tries to stand. */
  behindShield: 5,
  /** Strike when an enemy body is within this many cells of the arc's reach. */
  strikeSlack: 0,
  /**
   * While at least packCount enemies are within packRadius, wait for a Strike worth packMinDamage
   * (useful damage, overkill excluded): cleaving saves mana, the bottleneck. A melee telegraph on
   * the player overrides the wait.
   */
  packCount: 2,
  packRadius: 9,
  packMinDamage: 20,
  /**
   * Fire bolts only at full mana with every melee enemy farther than boltSafeDistance: mana that
   * would otherwise be lost to the cap. Strike deals ~4× the damage per mana here.
   */
  boltManaFraction: 0.999,
  boltSafeDistance: 20,
  /** Longest bolt shot, cells. */
  boltRange: 55,
  /** M4 Tar Matriarch: light her from this many cells beyond her flare's reach (bots/kiterTar.ts). */
  flareStandoffMargin: 3,
  /** Shoot once within this many cells of the standoff distance. */
  flareShotSlack: 1.5,
  /** Oil within this many cells of a burning cell counts as a hazard in her fight. */
  tarFireReach: 10,
  /** Her fight: hazards are checked at this many points along each move's lookahead run. */
  hazardSteps: 6,
  /** Her fight: hazardPenalty becomes this (burning oil costs the Oiled more than a slam). */
  tarHazardPenalty: 5000,
  /** Dodge when a hit lands within this many seconds and walking can't clear it. */
  dodgeWithin: 0.12,
} as const;
