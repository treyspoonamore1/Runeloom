/**
 * M8 (Glasswater Fen) additions to the enemy table types (data/enemyTypes.ts): the new behaviors,
 * attack parts and chemistry of the Fen enemies (CONTENT §5). Units: cells, seconds, cells per
 * second; damage at area level 1 (scaled per DESIGN §7).
 */

/**
 * A leap attack (Glasspike): on landing (the end of the windup) the enemy flies in a straight
 * line to the shape's origin over `seconds` (render draws the arc), ignoring terrain, and the
 * hit lands when it touches down, over the attack's shape at the landing point.
 */
export interface LeapDef {
  seconds: number;
}

/**
 * Glasspike (M8): hides submerged in water, swimming toward the water nearest the player
 * (actors/swim.ts) at `driftSpeed` × its speed. When the player is within the leap attack's
 * range with line of sight it leaps (AttackDef.leap) to the water cell nearest the player within
 * `landReach` cells, else to the player's spot.
 */
export interface LeaperBehavior {
  kind: 'leaper';
  driftSpeed: number;
  landReach: number;
}

/**
 * Mirebull (M8, ai/charger.ts): walks at the player and gores up close (its primary attack).
 * Off cooldown, with line of sight and the player `chargeMin`–`chargeMax` cells away (centers),
 * it charges (`charge`, a dash attack) to `overshoot` cells past where the player stood, at most
 * the dash's maxLength; cells on ice cost 1 / iceLengthMult of that length. A charge planned
 * into something solid stuns it `wallStun` s when it ends there. Entering mud ends the charge:
 * bogged for `bogSeconds` (it can't act) and it takes `boggedTaken` × damage meanwhile.
 */
export interface ChargerBehavior {
  kind: 'charger';
  /** Name of the dash attack in extraAttacks. */
  charge: string;
  chargeMin: number;
  chargeMax: number;
  overshoot: number;
  /** Shortest charge worth starting, cells. */
  minLength: number;
  iceLengthMult: number;
  wallStun: number;
  bogSeconds: number;
  boggedTaken: number;
}

/** M8 attack terrain: borrowed (temporary) shallow water, or an enemy gust (rule 21). */
export type FenAttackTerrainDef =
  /**
   * Spark Heron's spit: shallow water for `seconds` on dry ground within `radius` of the shape's
   * origin (grid/tempWater.ts now; borrowed water once Tide lands).
   */
  | { kind: 'water'; radius: number; seconds: number }
  /**
   * Bellows Toad's croak: an enemy gust (grid/wind.ts writeGust) over the attack's cone, `angleDeg`
   * wide (the full angle), blowing along it for `seconds`.
   */
  | { kind: 'gust'; seconds: number; angleDeg: number };

/** Chemistry of the Fen kinds (CONTENT §5 "Chemistry"); part of EnemyChemistry. */
export interface FenChemistry {
  /**
   * Copperback: charge of any team reaching it through water or metal (rules 11–12) makes it
   * Charged for `seconds` (freezing ends it): its attacks add `attackStorm` Storm, and every
   * `pulseEvery` s it electrifies the water or metal under it as enemy charge for `pulseDamage`
   * Storm. Charge from conductor bodies' own pulses never charges one.
   */
  conductorBody?: { seconds: number; attackStorm: number; pulseEvery: number; pulseDamage: number };
  /**
   * Slagshell: Hot (takes `hotTaken` × damage, can't be chilled or frozen) until it gets Wet,
   * which quenches it in steam: Cracked (takes `crackedTaken` ×, moves at `crackedSpeed` ×, chill
   * works), held while Wet, until it has been dry for `crackedSeconds`; then Hot again. While Hot
   * it steers away from water.
   */
  hotShell?: { hotTaken: number; crackedTaken: number; crackedSpeed: number; crackedSeconds: number };
  /**
   * Sparkfly: dying over water it pops, electrifying its water as enemy charge for `damage` Storm,
   * `reach` cells of water (falloff over that reach) for `seconds`.
   */
  deathCharge?: { damage: number; reach: number; seconds: number };
  /**
   * Sparkfly: a lit brazier or burning cell within `range` cells pulls it to circle there at
   * `orbit` cells for `seconds` instead of chasing the player (it still zaps a player in reach).
   */
  lightLure?: { range: number; seconds: number; orbit: number };
  /**
   * Bellows Toad: a hit with Fire damage during the windup of attack `attack` (the inflated croak)
   * lights its marsh gas, unless it is Wet: a `radius`-cell world-owned fire burst for `damage`
   * Fire (scaled like enemy damage) that hurts everyone else, it loses `lifeLoss` of its max
   * life and is stunned `stun` s (the croak is lost).
   */
  gasbag?: { attack: string; radius: number; damage: number; lifeLoss: number; stun: number };
  /**
   * Bellshell: shelled, it takes `shelledTaken` × damage. Charge of another team or the world
   * reaching it through water or metal (rules 11–12) rings it: stunned `stun` s and open for
   * `openSeconds` (takes `openTaken` ×), then it can't ring for `cooldown` s. Its own charge never
   * rings it, and neither do direct Storm hits.
   */
  bell?: { shelledTaken: number; stun: number; openSeconds: number; openTaken: number; cooldown: number };
  /** Spark Heron: shallow water doesn't slow it. */
  wades?: boolean;
  /**
   * Sparkfly: floats (ignores the ground) but hovers low, so charge in the water or metal under
   * it still reaches it (rules 11–12).
   */
  chargeFromBelow?: boolean;
}

/**
 * Per-kind overrides of rule 31 (tuning.swim): the Glasswater Coil crawls after 5 s at 6 cells/s
 * (DESIGN §10.5). Missing fields use the tuning values.
 */
export interface SwimmerDef {
  crawlDelay?: number;
  crawlSpeed?: number;
}
