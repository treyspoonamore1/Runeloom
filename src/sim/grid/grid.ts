/**
 * The chemistry grid (DESIGN §6.1): one cell per room cell, stored as typed arrays (struct of
 * arrays), row-major, index = cy * width + cx.
 *
 * CONTRACT (M3): this file defines the data the rules engine (src/sim/grid/*), the renderer and the
 * entity code share. Fields may be added; don't change the meaning of existing ones.
 * Units: timers are in GRID TICKS (20 Hz; DESIGN §6.1), not sim ticks or seconds.
 */
import {
  AIR,
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
import type { WindDir } from './windDir';

export interface Grid {
  /** Size in cells (same as the room). */
  width: number;
  height: number;
  /** Material code (data/materials.ts MAT). */
  ground: Uint8Array;
  /** SURFACE code: none or oil. */
  surface: Uint8Array;
  /** AIR code: none, smoke, steam or fog (M8). */
  air: Uint8Array;
  /** Burn intensity 0–255; 0 = not burning. */
  fire: Uint8Array;
  /** Remaining burn time in grid ticks while burning; kept after Frost puts a fire out (rule 9). */
  fuel: Uint16Array;
  /** Remaining electrified grid ticks; 0 = not charged. */
  charge: Uint8Array;
  /**
   * Remaining smoke/steam grid ticks. On a fog cell (fogMask) with no air, the grid ticks until
   * the fog rolls back in (rule 29, M8); fog itself has no timer.
   */
  airTimer: Uint8Array;
  /** Material timer in grid ticks: thaw, crack, dry, temporary terrain. 0 = none (permanent). */
  timer: Uint16Array;
  /**
   * Remaining grid ticks a non-water cell stays wet (Tide, Hydromancer). Wet cells can't ignite.
   * u16 since M8 (a Lingering Tide wets for 15 s = 300 grid ticks).
   */
  wet: Uint16Array;
  /** Material code the cell becomes when its ground burns away or its timer ends. */
  under: Uint8Array;
  /** OWNER code of the team whose effect is on the cell (fire, charge, smoke). */
  owner: Uint8Array;
  /**
   * M8: 1 while the cell's terrain is temporary (Tide or Hydromancer water, a Tide-filled pit, ice
   * or an ice bridge frozen from them, a doused vent). When its `timer` ends it returns to
   * `under` and stops being borrowed, whatever it became meanwhile (rule 27).
   */
  borrowed: Uint8Array;
  /**
   * M8: on a cell a push or ice block covers (ground `object`) while the cell is borrowed: the
   * borrowed material the block hides, + 1 (0 = none). `under` keeps the borrowed origin, so the
   * cell can still go back (rule 27) under the block (world/objectGround.ts coverTile).
   */
  cover: Uint8Array;
  /** M8: gust direction while gustTimer > 0: 1–8 (E, NE, N, NW, W, SW, S, SE; grid/windDir.ts). */
  gustDir: Uint8Array;
  /** M8: remaining gust grid ticks; 0 = no gust (the cell has the room wind). */
  gustTimer: Uint8Array;
  /**
   * M8: room wind, 0 or a direction 1–8 (`@wind`, or east in a rift "of the Gale"). A cell's
   * wind is its gust while gustTimer > 0, else this.
   */
  wind: WindDir;
  /** M8: one bit per cell (cell i is bit i & 7 of byte i >> 3), set where the room's `@fog` lies. */
  fogMask: Uint8Array;
  /** M8: live gusts, oldest first, for each team's cap (tuning.wind.maxGusts; grid/wind.ts). */
  gusts: Gust[];
  /**
   * M8: furnace vent cells in the room, lit or doused (derived from the room, not hashed): rule
   * 30's touch check is skipped in rooms without vents.
   */
  vents: number;
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
  /** M8 Coil Dynamo: the extra pulse of an ended player event (it never pulses again). */
  echo?: boolean;
}

/**
 * A live gust (M8, grid/wind.ts): the cells it wrote and the grid tick each ends. Cell cells[k]
 * still belongs to it while its gustTimer equals ends[k] − grid.tick (a newer gust overwrites it).
 */
export interface Gust {
  /** 0 player, 1 enemy (each team keeps at most tuning.wind.maxGusts). */
  team: number;
  /** The spell instance whose writes it gathers (Nova bands, Orb trail), or 0 for a one-off write. */
  key: number;
  /** The grid tick its last cell ends. */
  endTick: number;
  /** Written cells and their end ticks, [0, len) used. */
  cells: Int32Array;
  ends: Int32Array;
  len: number;
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
    wet: new Uint16Array(n),
    under: new Uint8Array(n),
    owner: new Uint8Array(n).fill(OWNER.world),
    borrowed: new Uint8Array(n),
    cover: new Uint8Array(n),
    gustDir: new Uint8Array(n),
    gustTimer: new Uint8Array(n),
    wind: room.header.wind ?? 0,
    fogMask: new Uint8Array((n + 7) >> 3),
    gusts: [],
    vents: 0,
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
  for (const f of room.header.fog ?? []) addFog(grid, f.tx0, f.ty0, f.tx1, f.ty1);
  for (let i = 0; i < n; i++) if (grid.ground[i] === MAT.vent_lit) grid.vents++;
  return grid;
}

/**
 * Sets the fog bit and puts fog in the air layer on every cell of tiles (tx0, ty0)–(tx1, ty1),
 * corners inclusive, clamped to the grid. Shot-blocking cells (walls) get the bit but no fog.
 */
export function addFog(grid: Grid, tx0: number, ty0: number, tx1: number, ty1: number): void {
  const x0 = Math.max(0, tx0 * TILE_CELLS);
  const y0 = Math.max(0, ty0 * TILE_CELLS);
  const x1 = Math.min(grid.width, (tx1 + 1) * TILE_CELLS);
  const y1 = Math.min(grid.height, (ty1 + 1) * TILE_CELLS);
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = y * grid.width + x;
      grid.fogMask[i >> 3]! |= 1 << (i & 7);
      if (grid.air[i] === AIR.none && !materialOf(grid, i).blocksShots) grid.air[i] = AIR.fog;
    }
}

/** True if cell i lies under the room's `@fog` (fog belongs there when no smoke or steam is). */
export function isFogCell(grid: Grid, i: number): boolean {
  return ((grid.fogMask[i >> 3]! >> (i & 7)) & 1) === 1;
}

/** What the air layer of cell i holds once its smoke or steam is gone: fog on fog cells, else none. */
export function restingAir(grid: Grid, i: number): number {
  return isFogCell(grid, i) && !materialOf(grid, i).blocksShots ? AIR.fog : AIR.none;
}

/** True if the cell's current material can be walked on. Outside the grid is not walkable. */
export function gridWalkable(grid: Grid, cx: number, cy: number): boolean {
  if (!inGrid(grid, cx, cy)) return false;
  return materialOf(grid, cellIndex(grid, cx, cy)).walk;
}

export function materialOf(grid: Grid, i: number): MaterialDef {
  return materialByCode[grid.ground[i]!]!;
}
