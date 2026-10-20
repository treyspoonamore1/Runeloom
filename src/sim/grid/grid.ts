/**
 * The chemistry grid (DESIGN §6.1): one cell per room cell, stored as typed arrays (struct of
 * arrays), row-major, index = cy * width + cx.
 *
 * CONTRACT (M3): this file defines the data the rules engine (src/sim/grid/*), the renderer and the
 * entity code share. Fields may be added; don't change the meaning of existing ones.
 * Units: timers are in GRID TICKS (20 Hz; DESIGN §6.1), not sim ticks or seconds.
 */
import {
  MAT,
  OWNER,
  SURFACE,
  materialByCode,
  type MaterialCode,
  type MaterialDef,
  type MaterialId,
} from '../../../data/materials';
import { tileGround, type TileGround } from '../../../data/tileGround';
import { tileForChar } from '../../../data/tiles';
import { TILE_CELLS } from '../core/constants';
import type { Room } from '../world/room';
import { createActiveSet, type ActiveSet } from './active';

export interface Grid {
  /** Size in cells (same as the room). */
  width: number;
  height: number;
  /** Material code (data/materials.ts MAT). */
  ground: Uint8Array;
  /** SURFACE code: none or oil. */
  surface: Uint8Array;
  /** AIR code: none, smoke or steam. */
  air: Uint8Array;
  /** Burn intensity 0–255; 0 = not burning. */
  fire: Uint8Array;
  /** Remaining burn time in grid ticks while burning; kept after Frost puts a fire out (rule 9). */
  fuel: Uint16Array;
  /** Remaining electrified grid ticks; 0 = not charged. */
  charge: Uint8Array;
  /** Remaining smoke/steam grid ticks. */
  airTimer: Uint8Array;
  /** Material timer in grid ticks: thaw, crack, dry, temporary terrain. 0 = none (permanent). */
  timer: Uint16Array;
  /** Remaining grid ticks a non-water cell stays wet (Tide, Hydromancer). Wet cells can't ignite. */
  wet: Uint8Array;
  /** Material code the cell becomes when its ground burns away or its timer ends. */
  under: Uint8Array;
  /** OWNER code of the team whose effect is on the cell (fire, charge, smoke). */
  owner: Uint8Array;
  /**
   * 1 if the cell's oil is the Tar Matriarch's tar (M4, CONTENT §5): fire on it is world-owned
   * whoever lit it (cells.ts lightCell, elements.ts fireCell). 0 otherwise; cleared when the oil
   * burns away or other oil is spilled over it.
   */
  tar: Uint8Array;
  /**
   * Charge event id on charged cells (0 = none). An entity takes rule 11/12 damage once per id;
   * look the event up with `chargeEventInfo` (grid/query.ts).
   */
  chargeId: Uint32Array;
  /** Rule 11 falloff on charged cells: 1 − d / maxDistance, at least minFalloff; 1 on metal; 0 when uncharged. */
  chargeFalloff: Float32Array;
  /** Charge events with charged cells left, oldest first (grid/charge.ts). */
  chargeEvents: ChargeEvent[];
  /** Next charge event id (ids start at 1 and are never reused). */
  nextChargeId: number;
  /**
   * Explosions in the latest grid tick (oil barrels), for the entity code to damage entities.
   * Cleared at the start of every grid tick.
   */
  blasts: Blast[];
  /** Grid ticks run so far (20 Hz; hitstop doesn't advance it). Render interpolates between grid ticks. */
  tick: number;
  /** Sim ticks since the last grid tick (0 to GRID_EVERY − 1). Hitstop ticks don't count. */
  clock: number;
  /** Increments whenever any cell field changes, so the renderer knows when to re-upload. */
  version: number;
  /**
   * Increments whenever a cell's walkability or shot blocking changes (room.solid / shotSolid
   * are kept in sync with the material table); the AI flow field rebuilds when it changes.
   */
  walkVersion: number;
  /**
   * Cells the grid tick visits (grid/active.ts). Derived, not hashed: quiet cells in it do
   * nothing, and it is visited in ascending index order.
   */
  active: ActiveSet;
}

/** One electrify event (rules 11–13). */
export interface ChargeEvent {
  id: number;
  /** Id of the first event of the Storm hit that started it (rule 13 hand-offs share it). */
  chain: number;
  medium: 'water' | 'metal';
  /** Damage per entity before falloff: the hit's Storm damage × the medium's damageMult. */
  damage: number;
  owner: number;
  sourceId: number;
  /** Grid ticks until its cells' charge ends. */
  ticksLeft: number;
  cells: number;
}

/** An oil barrel explosion (DESIGN §6.2). Positions and radius in cells. */
export interface Blast {
  x: number;
  y: number;
  radius: number;
  /** Fire damage, already scaled by area level. */
  damage: number;
  owner: number;
  sourceId: number;
}

export function cellIndex(grid: Grid, cx: number, cy: number): number {
  return cy * grid.width + cx;
}

export function inGrid(grid: Grid, cx: number, cy: number): boolean {
  return cx >= 0 && cy >= 0 && cx < grid.width && cy < grid.height;
}

/** Ground of the tile at (tx, ty), resolving markers by their neighbors (CONTENT §6.1). */
function resolveTile(room: Room, tx: number, ty: number): TileGround {
  const spec = tileSpec(room, tx, ty);
  if (spec !== 'neighbor') return spec ?? { ground: 'stone' };
  const counts = new Map<MaterialId, number>();
  for (const [dx, dy] of NEIGHBORS) {
    const n = tileSpec(room, tx + dx, ty + dy);
    if (n === 'neighbor' || n === null) continue;
    counts.set(n.ground, (counts.get(n.ground) ?? 0) + 1);
  }
  // The most common neighbor ground wins; any tie (or no neighbors) goes to stone.
  let best: MaterialId = 'stone';
  let bestCount = 0;
  let tied = false;
  for (const [mat, c] of counts) {
    if (c > bestCount) {
      best = mat;
      bestCount = c;
      tied = false;
    } else if (c === bestCount) tied = true;
  }
  return { ground: tied ? 'stone' : best };
}

const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function tileSpec(room: Room, tx: number, ty: number): TileGround | 'neighbor' | null {
  if (tx < 0 || ty < 0 || tx >= room.tilesW || ty >= room.tilesH) return null;
  const ch = String.fromCharCode(room.tiles[ty * room.tilesW + tx]!);
  const def = tileForChar(ch);
  if (!def) return { ground: 'stone' };
  return tileGround[def.id as keyof typeof tileGround];
}

/** Builds the grid for a room from its tiles (each tile fills 4×4 cells). */
export function createGrid(room: Room): Grid {
  const { width, height } = room;
  const n = width * height;
  const grid: Grid = {
    width,
    height,
    ground: new Uint8Array(n),
    surface: new Uint8Array(n),
    air: new Uint8Array(n),
    fire: new Uint8Array(n),
    fuel: new Uint16Array(n),
    charge: new Uint8Array(n),
    airTimer: new Uint8Array(n),
    timer: new Uint16Array(n),
    wet: new Uint8Array(n),
    under: new Uint8Array(n),
    owner: new Uint8Array(n).fill(OWNER.world),
    tar: new Uint8Array(n),
    chargeId: new Uint32Array(n),
    chargeFalloff: new Float32Array(n),
    chargeEvents: [],
    nextChargeId: 1,
    blasts: [],
    tick: 0,
    clock: 0,
    version: 0,
    walkVersion: 0,
    active: createActiveSet(n),
  };
  for (let ty = 0; ty < room.tilesH; ty++) {
    for (let tx = 0; tx < room.tilesW; tx++) {
      const t = resolveTile(room, tx, ty);
      const g: MaterialCode = MAT[t.ground];
      const u: MaterialCode = MAT[t.under ?? t.ground];
      const s = t.oil ? SURFACE.oil : SURFACE.none;
      for (let cy = 0; cy < TILE_CELLS; cy++) {
        const row = (ty * TILE_CELLS + cy) * width + tx * TILE_CELLS;
        grid.ground.fill(g, row, row + TILE_CELLS);
        grid.under.fill(u, row, row + TILE_CELLS);
        grid.surface.fill(s, row, row + TILE_CELLS);
      }
    }
  }
  return grid;
}

/** True if the cell's current material can be walked on. Outside the grid is not walkable. */
export function gridWalkable(grid: Grid, cx: number, cy: number): boolean {
  if (!inGrid(grid, cx, cy)) return false;
  return materialOf(grid, cellIndex(grid, cx, cy)).walk;
}

export function materialOf(grid: Grid, i: number): MaterialDef {
  return materialByCode[grid.ground[i]!]!;
}
