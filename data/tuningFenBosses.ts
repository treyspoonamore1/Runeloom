/**
 * The Drowned Foundry's boss fights (M8; DESIGN §10.5, CONTENT §5, §13.2): pacing and rule numbers
 * of the Old Bellwether and the Glasswater Coil, part of data/tuning.ts `bosses` (so
 * tuning.bosses.coilSubmergedTaken is the name DESIGN §10.5 uses). Attack numbers are in
 * data/bossesFen.ts. Values the docs don't give are first guesses, editable in the F2 panel.
 */
export const fenBossTuning = {
  /** Old Bellwether: phase 2 (it tolls the Foundry) starts at this fraction of life. */
  bellwetherPhase2At: 0.5,
  /** Phase 2: seconds from one self-toll to the next. */
  bellwetherTollEvery: 7,
  /** Phase 2: seconds from tolling the Foundry (phase 2 begins) to the first self-toll. */
  bellwetherTollFirst: 3,
  /** Toll ring: it tolls at a player within this many cells (centers). */
  bellwetherRingRange: 16,
  /** Shell roll: only at a player at least this many cells away (centers). */
  bellwetherRollMinDistance: 10,
  /** Shell roll: it rolls this many cells past where the player stood (walls permitting). */
  bellwetherRollOvershoot: 6,
  /** Shell roll: shortest roll worth starting, cells. */
  bellwetherRollMinLength: 10,
  /** Phase 2: cells from its center the summoned Sparkflies appear. */
  bellwetherSummonDistance: 8,
  /** Glasswater Coil: phase 2 starts at this fraction of life. */
  coilPhase2At: 0.66,
  /** Glasswater Coil: phase 3 starts at this fraction of life. */
  coilPhase3At: 0.33,
  /** Submerged in phase 1: fraction of damage it still takes (0.25 = 75% less). */
  coilSubmergedTaken: 0.25,
  /** Submerged in phases 2–3 (it dives deeper): fraction of damage it still takes (90% less). */
  coilDiveTaken: 0.1,
  /** Phase 1: it hunts and lunges at a player within this many cells of its water. */
  coilLungeReach: 14,
  /** Phases 2–3: it lunges only at a player within this many cells of its water. */
  coilLungeReachDeep: 8,
  /** It spits at a player farther than this many cells from its water. */
  coilSpitBeyond: 14,
  /** Phases 2–3: spits per volley, and seconds between them. */
  coilVolley: 3,
  coilVolleyGap: 0.3,
  /** Phase 1: it circles the Eye at this fraction of its speed, this many cells from its home. */
  coilPatrolSpeed: 0.6,
  coilPatrolRadius: 14,
  /**
   * It leaves deep water only for shallow water that gets it at least this many cells closer to
   * where it is going (a lure path; the Eye's 4-cell rim isn't worth it).
   */
  coilLeaveDeep: 7,
  /** ... and for borrowed water (Tide, puddles) this many: borrowed water lures it out. */
  coilLeaveDeepBorrowed: 2,
  /** Water cells one route plan of the Coil searches (the Eye, its channels and lure paths). */
  coilPlanCells: 6000,
  /** Eye pulse (phases 1–2): electrifies the water body it is in (rule 11 with this reach). */
  coilPulse: {
    reach: 80,
    maxCells: 4000,
    /** Storm damage (absolute). */
    damage: 120,
    /** Seconds all its water brightens before the pulse. */
    glowSeconds: 1.2,
    /** Seconds from one pulse to the next: phase 1, phase 2. */
    every: 7,
    everyPhase2: 5,
    /** Seconds from waking to the first glow. */
    firstDelay: 4,
  },
  /** Body pulse (phase 3): its water within `reach` cells, every `every` s while it is in water. */
  coilBodyPulse: {
    reach: 20,
    maxCells: 4000,
    damage: 110,
    glowSeconds: 1,
    every: 4,
    /** Seconds from calling the pylons to the first glow. */
    firstDelay: 2,
    /** Overloaded (player charge in its water during the glow): stunned this long ... */
    overloadStun: 2,
    /** ... and this many seconds before the next Body pulse glows. */
    overloadDelay: 6,
  },
  /** Pylon storm (phase 3): the pylons glow, then electrify their pads and the water touching them. */
  coilPylonStorm: {
    damage: 90,
    glowSeconds: 1.2,
    every: 6,
    /** Seconds from calling the pylons to the first glow. */
    firstDelay: 3,
  },
  /** Iced (the cell under it froze): held this long, then the ice within breakRadius cells breaks. */
  coilIced: {
    holdSeconds: 2.5,
    breakRadius: 6,
    /** Seconds after breaking out in which ice it touches breaks (freezing doesn't hold it). */
    immuneSeconds: 10,
  },
};
