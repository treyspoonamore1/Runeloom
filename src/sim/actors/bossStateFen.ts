/**
 * The Fen bosses' fight state (M8; ai/bosses/bellwether.ts, coil.ts): BossState.fen, created for
 * the Old Bellwether and the Glasswater Coil (and their rift versions), null for the M4 bosses.
 * Plain data, hashed; render reads `coil` (the Coil's state, DESIGN §10.5), the pulse and pylon
 * glows, and the Bellwether's wave front.
 */
import type { Hasher } from '../core/hash';

/**
 * The Glasswater Coil's state (DESIGN §10.5), from its ground and what it is doing:
 * - submerged: center on deep water and not attacking (takes much less damage);
 * - surfaced: winding up, attacking or recovering in deep water;
 * - exposed: center on shallow water (rim, flats, borrowed water); it can't dive;
 * - stranded: rule 31, its water went away under it;
 * - iced: the cell under its center froze;
 * - overloaded: phase 3, player charge reached its water during a Body pulse glow (stunned).
 */
export type CoilMode = 'submerged' | 'surfaced' | 'exposed' | 'stranded' | 'iced' | 'overloaded';

export const COIL_MODES: readonly CoilMode[] = [
  'submerged',
  'surfaced',
  'exposed',
  'stranded',
  'iced',
  'overloaded',
];

/** A distance farther than any room. */
export const FAR = 1e9;

export interface FenBossState {
  /** Old Bellwether, phase 2: seconds until it self-tolls again (it waits for conducting ground). */
  tollLeft: number;
  /** Old Bellwether: the toll ring's front radius while it expands, cells; 0 = no wave. */
  waveR: number;
  /** The current wave already passed (hit or dodged) the player. */
  waveHit: boolean;
  /** Old Bellwether: the current shell roll was planned into a wall (it is stunned where it ends). */
  rollWall: boolean;
  /** Glasswater Coil: its state (see CoilMode). */
  coil: CoilMode;
  /** Where it spawned (the Eye's middle): its patrol circles here. */
  homeX: number;
  homeY: number;
  /** Phase 1 patrol: the waypoint it swims to (index around its home). */
  patrol: number;
  /** Cells from the player to the nearest water its route reaches (FAR before the first plan). */
  waterGap: number;
  /** Ticks until it plans its route again. */
  planLeft: number;
  /** Eye pulse (phases 1–2) or Body pulse (phase 3): seconds until the glow, or (glowing) until it lands. */
  pulseLeft: number;
  pulseGlowing: boolean;
  /** Phase 3 pylon storm: seconds until the pylons glow, or (glowing) until it lands. */
  pylonLeft: number;
  pylonGlowing: boolean;
  /** Seconds it has been Iced (held by ice under its center). */
  icedTime: number;
  /** Seconds left in which ice it touches breaks (after breaking out). */
  iceImmuneLeft: number;
  /** Seconds left of an Overload's stun (phase 3; it is 'overloaded' meanwhile). */
  overloadLeft: number;
  /** Spits of the current volley still to come, and seconds until the next. */
  volleyLeft: number;
  volleyTimer: number;
}

export function createFenBossState(x: number, y: number): FenBossState {
  return {
    tollLeft: 0,
    waveR: 0,
    waveHit: false,
    rollWall: false,
    coil: 'submerged',
    homeX: x,
    homeY: y,
    patrol: 0,
    waterGap: FAR,
    planLeft: 0,
    pulseLeft: 0,
    pulseGlowing: false,
    pylonLeft: 0,
    pylonGlowing: false,
    icedTime: 0,
    iceImmuneLeft: 0,
    overloadLeft: 0,
    volleyLeft: 0,
    volleyTimer: 0,
  };
}

export function hashFenBossState(h: Hasher, f: FenBossState): void {
  h.num(f.tollLeft).num(f.waveR).bool(f.waveHit).bool(f.rollWall).u32(COIL_MODES.indexOf(f.coil));
  h.num(f.homeX).num(f.homeY).u32(f.patrol).num(Number.isFinite(f.waterGap) ? f.waterGap : -1);
  h.u32(f.planLeft).num(f.pulseLeft).bool(f.pulseGlowing).num(f.pylonLeft).bool(f.pylonGlowing);
  h.num(f.icedTime).num(f.iceImmuneLeft).num(f.overloadLeft).u32(f.volleyLeft).num(f.volleyTimer);
}
