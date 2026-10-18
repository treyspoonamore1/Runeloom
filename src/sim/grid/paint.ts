/**
 * How elements reach the grid: spells' terrain footprints (CONTENT §1.2), enemy attacks, death
 * bursts, explosions and the Chemistry Lab all call `applyElement` with a shape.
 *
 * CONTRACT (M3): callers use only `applyElement` and the `Footprint` / `ElementApplication` types.
 * The rules agent implements it (rules 1–14, 26 of DESIGN §6.3); until then it's a no-op STUB.
 */
import type { GameState } from '../state';

/** Elements that change terrain. Tide and Gale arrive in M8. */
export type TerrainElement = 'fire' | 'frost' | 'storm' | 'tide' | 'gale';

/** An area on the grid in world cells. Every cell whose center is inside is affected. */
export type Footprint =
  | { kind: 'circle'; x: number; y: number; r: number }
  /** A segment with thickness (Beam lines, Bolt trails). */
  | { kind: 'line'; x0: number; y0: number; x1: number; y1: number; width: number }
  /** An oriented rectangle starting at (x, y) and extending `length` along (dirX, dirY) (Swath). */
  | { kind: 'strip'; x: number; y: number; dirX: number; dirY: number; length: number; width: number }
  /** A circular sector around (x, y) facing (dirX, dirY) (Strike). */
  | { kind: 'arc'; x: number; y: number; dirX: number; dirY: number; r: number; halfAngleCos: number };

export interface ElementApplication {
  element: TerrainElement;
  shape: Footprint;
  /** OWNER code of the team applying it (data/materials.ts OWNER). */
  owner: number;
  /** Entity id of the source (PLAYER_ID for the player), for damage attribution. */
  sourceId: number;
  /**
   * Strength of the triggering hit for rules that deal damage through terrain (rule 11/12 storm
   * damage). 0 when there's no hit (lab, ambient effects).
   */
  hitDamage: number;
  /** Lingering: terrain effects last this much longer (1 = normal). */
  durationMult: number;
}

/** Applies an element to every cell in the footprint (DESIGN §6.3). STUB: no-op until the rules land. */
export function applyElement(_state: GameState, _app: ElementApplication): void {}
