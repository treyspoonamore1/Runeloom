/**
 * Wind (M8, DESIGN §6.6): the room's wind direction plus transient gust cells, rule 21 (wind over
 * fire), smoke and steam drift, and rule 29 (gusts clear fog).
 *
 * CONTRACT (M8 phase 1). The chemistry agent owns this file and implements everything here; the
 * enemies agent calls `writeGust` for the Bellows Toad's croak (an enemy gust, same rule as a
 * Gale gust). Directions are 0 (none) or 1–8: E, NE, N, NW, W, SW, S, SE.
 */
import type { GameState } from '../state';

export type WindDir = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Who made a gust: each team keeps at most tuning.wind.maxGusts live gusts (the oldest ends early). */
export type GustTeam = 'player' | 'enemy';

export interface GustCone {
  /** Apex of the cone, cells. */
  x: number;
  y: number;
  /** Direction it blows (any length; quantized to 8 directions for the cells). */
  dirX: number;
  dirY: number;
  /** Reach, cells. */
  radius: number;
  /** Full cone angle, degrees (DESIGN §6.6: 60 for Gale's cones). */
  angleDeg: number;
  /** How long the gust cells last, seconds. */
  seconds: number;
  team: GustTeam;
}

/** Writes a cone of gust cells (gustDir, gustTimer) onto the grid. Chemistry agent. */
export function writeGust(state: GameState, gust: GustCone): void {
  void state;
  void gust;
}

/** The wind direction acting on cell `i`: its gust while gustTimer > 0, else the room wind. Chemistry agent. */
export function windAt(state: GameState, i: number): WindDir {
  void state;
  void i;
  return 0;
}
