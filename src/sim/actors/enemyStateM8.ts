/**
 * M8 (Glasswater Fen) per-enemy state: swimmer routes and rule 31 Stranded for every swimmer,
 * and the chemistry state of the Fen kinds (CONTENT §5). Part of EnemySpecial
 * (actors/enemyState.ts); plain data, hashed. Render reads these for looks and status icons.
 */
import type { Hasher } from '../core/hash';

export interface FenSpecial {
  /** Rule 31 (swimmers): its cell stopped being water (not by freezing). Can't attack, takes more damage. */
  stranded: boolean;
  /** Seconds since it stranded (it starts crawling at the kind's crawl delay). */
  strandTime: number;
  /** Stranded, crawling, with no water in reach: drying out (loses life each second; never bosses). */
  drying: boolean;
  /** Swimmers: the cell it is swimming (or crawling) toward, -1 for none. */
  routeCell: number;
  /** Ticks until it re-plans its route. */
  routeReplan: number;
  /** Glasspike: seconds left in the air (0: not leaping), the leap's length and its ends. */
  leapLeft: number;
  leapTime: number;
  leapFromX: number;
  leapFromY: number;
  leapToX: number;
  leapToY: number;
  /** Copperback: seconds of Charged left (0: not charged), and until its next pulse. */
  chargedLeft: number;
  pulseLeft: number;
  /** Slagshell: Hot (its crust shrugs off damage). False while Cracked. */
  hot: boolean;
  /** Slagshell: seconds of Cracked left (held full while Wet). */
  crackedLeft: number;
  /** Sparkfly: who killed it (credited for the Sparkflies its pop pops in turn); -1 alive. */
  popKiller: number;
  /** Sparkfly: seconds left circling a light, and the light's position. */
  lureLeft: number;
  lureX: number;
  lureY: number;
  /** Mirebull: seconds bogged in mud left (it takes more damage); its current charge was planned into a wall. */
  boggedLeft: number;
  chargeWall: boolean;
  /** Bellshell: seconds its shell is open after a ring, and before it can ring again. */
  openLeft: number;
  ringCooldown: number;
}

export function createFenSpecial(): FenSpecial {
  return {
    stranded: false,
    strandTime: 0,
    drying: false,
    routeCell: -1,
    routeReplan: 0,
    leapLeft: 0,
    leapTime: 0,
    leapFromX: 0,
    leapFromY: 0,
    leapToX: 0,
    leapToY: 0,
    chargedLeft: 0,
    pulseLeft: 0,
    hot: false,
    crackedLeft: 0,
    popKiller: -1,
    lureLeft: 0,
    lureX: 0,
    lureY: 0,
    boggedLeft: 0,
    chargeWall: false,
    openLeft: 0,
    ringCooldown: 0,
  };
}

export function hashFenSpecial(h: Hasher, s: FenSpecial): void {
  h.bool(s.stranded).num(s.strandTime).bool(s.drying).num(s.routeCell).num(s.routeReplan);
  h.num(s.leapLeft).num(s.leapTime).num(s.leapFromX).num(s.leapFromY).num(s.leapToX).num(s.leapToY);
  h.num(s.chargedLeft).num(s.pulseLeft).bool(s.hot).num(s.crackedLeft);
  h.num(s.popKiller).num(s.lureLeft).num(s.lureX).num(s.lureY).num(s.boggedLeft).bool(s.chargeWall);
  h.num(s.openLeft).num(s.ringCooldown);
}
