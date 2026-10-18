/**
 * The Chemistry Lab (BUILD_PLAN M3 task 9, `?scene=lab`): one labeled station per chemistry rule
 * (DESIGN §6.3). Each station is an area of the lab room plus a short script of element
 * applications; running a station resets its area to the room's original terrain, then plays the
 * script.
 *
 * CONTRACT (M3): the content agent fills `labStations`; the renderer draws each station's label
 * above its area; the sim runs scripts deterministically (so lab tests run headless).
 */
import type { Footprint, TerrainElement } from '../src/sim/grid/paint';

export interface LabStep {
  /** Seconds after the station starts. */
  at: number;
  element: TerrainElement;
  /** In cells, RELATIVE to the station area's top-left corner (rect.tx × 4, rect.ty × 4). */
  shape: Footprint;
  /** Team that applies it (default 'player'). */
  owner?: 'player' | 'enemy' | 'world';
  /** Damage of the "hit" for rules that deal damage through terrain (Storm charge). Default 0. */
  hitDamage?: number;
}

export interface LabStation {
  /** Rule number in DESIGN §6.3, or 0 for a station that shows several rules together. */
  rule: number;
  /** Shown above the station, e.g. "07 · Frost on shallow water → ice". */
  label: string;
  /** The station's area in room TILES. Running the station restores this area first. */
  rect: { tx: number; ty: number; w: number; h: number };
  script: LabStep[];
  /** Entities placed when the station runs (entity rules, e.g. a dummy standing in water), in cells relative to the area. */
  spawns?: { kind: string; x: number; y: number }[];
}

/** Filled by the M3 content task. */
export const labStations: LabStation[] = [];
