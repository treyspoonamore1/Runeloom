/**
 * How elements reach the grid: spells' terrain footprints (CONTENT §1.2), enemy attacks, death
 * bursts, explosions and the Chemistry Lab all call `applyElement` with a shape.
 *
 * CONTRACT (M3): callers use only `applyElement` and the `Footprint` / `ElementApplication` types.
 * It runs rules 1, 4–14 and 26 of DESIGN §6.3 at once on every cell of the footprint (see
 * elements.ts and charge.ts); spread, burning out, thawing and charge timing happen in the 20 Hz
 * grid tick (tick.ts). Safe to call any number of times per sim tick.
 */
import type { GameState } from '../state';
import { newBatch } from './cells';
import { electrify } from './charge';
import { fireCell, frostCell, steamAround, stormCell, type CellContext } from './elements';
import { flush, flushFx } from './fx';
import { rasterize } from './raster';
import { materialByCode } from '../../../data/materials';
import { elementOnObjects } from '../world/objectHits';

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
  | { kind: 'arc'; x: number; y: number; dirX: number; dirY: number; r: number; halfAngleCos: number }
  /**
   * The cells of a disc around (x, y) with r0 < distance ≤ r1 (an expanding Nova paints each
   * tick's new band). r0 = 0 includes the center (and, like a circle, the origin cell when
   * nothing else is covered); a band covering no cell center affects nothing.
   */
  | { kind: 'ring'; x: number; y: number; r0: number; r1: number };

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

/**
 * Applies an element to every cell whose center is in the footprint (DESIGN §6.3; a footprint
 * covering no cell center reaches the cell under its origin). Effects record `owner`;
 * `durationMult` (Lingering) lengthens placed and ignited fire, ice, charge and steam.
 * Sends 'cellIgnited', 'steam', 'iceFormed' and 'water/metalElectrified' events as they happen.
 */
export function applyElement(state: GameState, app: ElementApplication): void {
  paintElement(state, app);
  flushFx(state);
}

let cells = new Int32Array(1024);
let water = new Int32Array(256);
let metal = new Int32Array(256);
const steamBatch = newBatch();
const iceBatch = newBatch();

/** applyElement without flushing the batched events (the grid tick flushes once at its end). */
export function paintElement(state: GameState, app: ElementApplication): void {
  if (app.element === 'tide' || app.element === 'gale') return; // TODO(M8): rules 21 and 24.
  const g = state.grid;
  const list = rasterize(g, app.shape);
  const n = list.len;
  if (n === 0) return;
  if (cells.length < n) cells = new Int32Array(n * 2);
  cells.set(list.cells.subarray(0, n));
  const c: CellContext = { owner: app.owner, durationMult: app.durationMult };
  g.version++;
  // M4 puzzle objects: Fire lights braziers and melts ice blocks, Storm powers switches.
  elementOnObjects(state, app.element, cells, n);
  switch (app.element) {
    case 'fire':
      for (let k = 0; k < n; k++) {
        const i = cells[k]!;
        if (fireCell(state, i, c)) steamAround(state, i, app.durationMult, steamBatch);
      }
      flush(state, 'steam', steamBatch);
      return;
    case 'frost':
      for (let k = 0; k < n; k++) frostCell(state, cells[k]!, c, iceBatch);
      flush(state, 'iceFormed', iceBatch);
      return;
    case 'storm': {
      if (water.length < n) water = new Int32Array(n);
      if (metal.length < n) metal = new Int32Array(n);
      let nw = 0;
      let nm = 0;
      for (let k = 0; k < n; k++) {
        const i = cells[k]!;
        const conducts = materialByCode[g.ground[i]!]!.conducts;
        if (conducts === 'falloff') water[nw++] = i;
        else if (conducts === 'full') metal[nm++] = i;
        stormCell(state, i, c);
      }
      if (nw + nm > 0)
        electrify(state, water, nw, metal, nm, {
          owner: app.owner,
          sourceId: app.sourceId,
          hitDamage: app.hitDamage,
          durationMult: app.durationMult,
        });
      return;
    }
  }
}
