/**
 * Wind (M8, DESIGN §6.6): the room's wind direction plus transient gust cells, rule 21 (wind over
 * fire), smoke and steam drift, rule 29 (gusts clear fog) and wind vanes.
 *
 * CONTRACT (M8 phase 1). The chemistry agent owns this file; the enemies agent calls `writeGust`
 * for the Bellows Toad's croak (an enemy gust, same rule as a Gale gust). Directions are 0 (none)
 * or 1–8: E, NE, N, NW, W, SW, S, SE (grid/windDir.ts).
 *
 * - A cell's wind is its gust while gustTimer > 0, else the room wind (`grid.wind`: `@wind`, or
 *   east in a rift "of the Gale", set on room entry).
 * - Rule 21: the grid tick's spread roll multiplies by `windFactors(state)[dir * 4 + k]` for the
 *   burning cell's wind and neighbor k (+x, −x, +y, −y): ×downwindMult where the step is within
 *   60° of the wind, ×upwindMult where it is against it, else ×1.
 * - Gusts are written like a footprint (a 60° cone, or a footprint blowing away from its center),
 *   last tuning.wind.gustSeconds × the duration mult, and join the active set while they run. Each
 *   team keeps at most tuning.wind.maxGusts gusts; writing one more ends its oldest early. All the
 *   writes of one spell instance are one gust.
 * - Drift and the fog's return run in the grid tick (tick.ts) with `driftTarget` and `restingAir`.
 * Gusts move nothing but fire spread, smoke, steam and fog (DECISIONS 2026-10-25).
 */
import { AIR, OWNER, materialByCode } from '../../../data/materials';
import { TILE_CELLS } from '../core/constants';
import { rotationDeg } from '../weave/angles';
import { emit } from '../events';
import type { GameState } from '../state';
import { markActive } from './active';
import { addToBatch, gridTicks, newBatch, u8 } from './cells';
import { flush } from './fx';
import { isFogCell, type Grid, type Gust } from './grid';
import type { ElementApplication, Footprint } from './paint';
import { rasterize } from './raster';
import { WIND_DX, WIND_DY, windDirOf, type WindDir } from './windDir';
import { objectCenter } from '../world/objects';
import { sendNote } from '../world/objectGround';
import { playerGustScale } from '../hero/effectsFen';

export type { WindDir } from './windDir';

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

// Rule 21 factor table, 9 directions × 4 neighbor steps (+x, −x, +y, −y), rebuilt when the
// tuning's multipliers change (the F2 panel can change them live).
const factors = new Float64Array(36);
let builtDown = Number.NaN;
let builtUp = Number.NaN;
const STEP_X = [1, -1, 0, 0];
const STEP_Y = [0, 0, 1, -1];

/** The rule 21 table: factor = table[dir * 4 + k] for neighbor step k (+x, −x, +y, −y). Row 0 is all 1. */
export function windFactors(state: GameState): Float64Array {
  const { downwindMult, upwindMult } = state.tuning.wind;
  if (downwindMult === builtDown && upwindMult === builtUp) return factors;
  for (let d = 0; d < 9; d++) {
    const len = Math.sqrt(WIND_DX[d]! * WIND_DX[d]! + WIND_DY[d]! * WIND_DY[d]!);
    for (let k = 0; k < 4; k++) {
      const dot = len > 0 ? (STEP_X[k]! * WIND_DX[d]! + STEP_Y[k]! * WIND_DY[d]!) / len : 0;
      factors[d * 4 + k] = dot > 0.5 ? downwindMult : dot < -0.5 ? upwindMult : 1;
    }
  }
  builtDown = downwindMult;
  builtUp = upwindMult;
  return factors;
}

/**
 * Rule 21's factor for fire spreading from cell `from` to its 4-neighbor `to` (1 without wind).
 * The grid tick reads the table directly; this is for tools and tests.
 */
export function windFactor(state: GameState, from: number, to: number): number {
  const w = state.grid.width;
  const d = to - from;
  const k = d === 1 ? 0 : d === -1 ? 1 : d === w ? 2 : d === -w ? 3 : -1;
  if (k < 0) return 1;
  return windFactors(state)[windAt(state, from) * 4 + k]!;
}

/** The wind direction acting on cell `i`: its gust while gustTimer > 0, else the room wind. */
export function windAt(state: GameState, i: number): WindDir {
  const g = state.grid;
  return (g.gustTimer[i]! > 0 ? g.gustDir[i]! : g.wind) as WindDir;
}

/**
 * Where a smoke or steam cell under wind `w` drifts on this grid tick, or -1 for no move: one
 * cell downwind (callers move it every wind.gustDriftTicks in a gust, roomDriftTicks in room
 * wind). A diagonal wind alternates x and y steps by `period`. Shot-blocking cells and the grid
 * edge stop it.
 */
export function driftTarget(g: Grid, i: number, w: number, period: number): number {
  const step = (g.tick / period) | 0;
  let dx = WIND_DX[w]!;
  let dy = WIND_DY[w]!;
  if (dx !== 0 && dy !== 0) {
    if ((step & 1) === 0) dy = 0;
    else dx = 0;
  }
  const x = (i % g.width) + dx;
  const y = ((i / g.width) | 0) + dy;
  if (x < 0 || y < 0 || x >= g.width || y >= g.height) return -1;
  const j = y * g.width + x;
  return materialByCode[g.ground[j]!]!.blocksShots ? -1 : j;
}

/**
 * Rule 29: clears fog in cell i for `seconds` (a gust 10 s, Fire 8 s): its air is empty and its
 * airTimer counts down to the fog's return. A cell already cleared keeps the longer time.
 * Lingering never lengthens it. Returns true if the cell had fog (or cleared fog).
 */
export function clearFog(g: Grid, i: number, seconds: number): boolean {
  if (!isFogCell(g, i)) return false;
  const a = g.air[i];
  if (a !== AIR.fog && !(a === AIR.none && g.airTimer[i]! > 0)) return false;
  const t = u8(gridTicks(seconds));
  g.air[i] = AIR.none;
  if (g.airTimer[i]! < t) g.airTimer[i] = t;
  markActive(g.active, i);
  return true;
}

const gustBatch = newBatch();
const fogBatch = newBatch();
const TEAM_PLAYER = 0;
const TEAM_ENEMY = 1;

/** Per-cell direction for a gust write: one direction, or away from a center. */
type GustDirs = { kind: 'fixed'; dir: WindDir } | { kind: 'radial'; x: number; y: number };

function newGust(team: number, key: number, n: number): Gust {
  const size = Math.max(16, n);
  return { team, key, endTick: 0, cells: new Int32Array(size), ends: new Int32Array(size), len: 0 };
}

function pushCell(gust: Gust, i: number, end: number): void {
  if (gust.len === gust.cells.length) {
    const c = new Int32Array(gust.len * 2);
    c.set(gust.cells);
    gust.cells = c;
    const e = new Int32Array(gust.len * 2);
    e.set(gust.ends);
    gust.ends = e;
  }
  gust.cells[gust.len] = i;
  gust.ends[gust.len++] = end;
}

/**
 * Writes gust cells over `shape` for `seconds` and records them for team `team` (0 player,
 * 1 enemy). `key` > 0 (a spell instance id) merges every write with that key into one gust.
 */
function writeGustShape(
  state: GameState,
  shape: Footprint,
  dirs: GustDirs,
  seconds: number,
  team: number,
  key: number,
): void {
  const g = state.grid;
  const ticks = u8(gridTicks(seconds));
  if (ticks <= 0) return;
  const list = rasterize(g, shape);
  const W = state.tuning.wind;
  const w = g.width;
  let gust = key > 0 ? g.gusts.find((x) => x.key === key && x.team === team) : undefined;
  if (!gust) g.gusts.push((gust = newGust(team, key, list.len)));
  const end = g.tick + ticks;
  for (let k = 0; k < list.len; k++) {
    const i = list.cells[k]!;
    if (materialByCode[g.ground[i]!]!.blocksShots) continue;
    const dir =
      dirs.kind === 'fixed' ? dirs.dir : windDirOf((i % w) + 0.5 - dirs.x, ((i / w) | 0) + 0.5 - dirs.y);
    if (dir === 0) continue;
    g.gustDir[i] = dir;
    g.gustTimer[i] = ticks;
    markActive(g.active, i);
    addToBatch(gustBatch, g, i);
    if (clearFog(g, i, W.gustFogSeconds)) addToBatch(fogBatch, g, i);
    pushCell(gust, i, end);
  }
  if (end > gust.endTick) gust.endTick = end;
  capGusts(g, team, W.maxGusts);
  g.version++;
  flush(state, 'gust', gustBatch);
  flush(state, 'fogCleared', fogBatch);
}

/** Ends the oldest gusts of `team` early until it has at most `max`: only cells they still own. */
function capGusts(g: Grid, team: number, max: number): void {
  let count = 0;
  for (const x of g.gusts) if (x.team === team) count++;
  while (count > max) {
    const k = g.gusts.findIndex((x) => x.team === team);
    const old = g.gusts[k]!;
    for (let n = 0; n < old.len; n++) {
      const i = old.cells[n]!;
      if (g.gustTimer[i] === old.ends[n]! - g.tick) {
        g.gustTimer[i] = 0;
        g.gustDir[i] = 0;
      }
    }
    g.gusts.splice(k, 1);
    count--;
  }
}

/** Drops gusts whose every cell has run out (after each grid tick). */
export function stepGusts(g: Grid): void {
  if (g.gusts.length === 0) return;
  let n = 0;
  for (const x of g.gusts) if (x.endTick > g.tick) g.gusts[n++] = x;
  g.gusts.length = n;
}

/** Writes a cone of gust cells (gustDir, gustTimer) onto the grid: the Bellows Toad's croak (enemy), tools. */
export function writeGust(state: GameState, gust: GustCone): void {
  const dir = windDirOf(gust.dirX, gust.dirY);
  if (dir === 0) return;
  const shape: Footprint = {
    kind: 'arc',
    x: gust.x,
    y: gust.y,
    dirX: gust.dirX,
    dirY: gust.dirY,
    r: gust.radius,
    halfAngleCos: rotationDeg(gust.angleDeg / 2).cos,
  };
  const team = gust.team === 'player' ? TEAM_PLAYER : TEAM_ENEMY;
  writeGustShape(state, shape, { kind: 'fixed', dir }, gust.seconds, team, 0);
}

/**
 * Gale's terrain effect (rule 21), from paintElement: a gust over the footprint for
 * tuning.wind.gustSeconds × `durationMult`. An arc, line or strip blows along its direction; a
 * circle or ring along app.dirX/dirY when given, else away from its center (Nova, Lob, Orb).
 * Spell forms with a cone (Bolt, Beam, Strike, Swath) pass their cone as an arc (weave runtime).
 */
export function paintGust(state: GameState, app: ElementApplication, durationMult: number): void {
  const team = app.owner === OWNER.player ? TEAM_PLAYER : TEAM_ENEMY;
  // Toad Bellows (Fuse part, hero/effectsFen.ts): the player's gusts last longer and cover more.
  const scale = team === TEAM_PLAYER ? playerGustScale(state) : NO_SCALE;
  const s = scaleShape(app.shape, scale.radiusMult);
  let dirs: GustDirs;
  if (s.kind === 'arc' || s.kind === 'strip') dirs = { kind: 'fixed', dir: windDirOf(s.dirX, s.dirY) };
  else if (s.kind === 'line') dirs = { kind: 'fixed', dir: windDirOf(s.x1 - s.x0, s.y1 - s.y0) };
  else if (app.dirX !== undefined && app.dirY !== undefined)
    dirs = { kind: 'fixed', dir: windDirOf(app.dirX, app.dirY) };
  else dirs = { kind: 'radial', x: s.x, y: s.y };
  if (dirs.kind === 'fixed' && dirs.dir === 0) return;
  const seconds = state.tuning.wind.gustSeconds * durationMult + scale.secondsAdd;
  writeGustShape(state, s, dirs, seconds, team, app.spellId ?? 0);
}

const NO_SCALE = { secondsAdd: 0, radiusMult: 1 } as const;

/** A footprint with its reach × k (cones and discs grow in radius; strips and lines in length and width). */
function scaleShape(f: Footprint, k: number): Footprint {
  if (k === 1) return f;
  switch (f.kind) {
    case 'circle':
    case 'arc':
      return { ...f, r: f.r * k };
    case 'ring':
      return { ...f, r0: f.r0 * k, r1: f.r1 * k };
    case 'strip':
      return { ...f, length: f.length * k, width: f.width * k };
    case 'line':
      return { ...f, x1: f.x0 + (f.x1 - f.x0) * k, y1: f.y0 + (f.y1 - f.y0) * k, width: f.width * k };
  }
}

/** The cone a directed Gale spell blows (DESIGN §6.6): 60°, radius 12 (× √ Saturate's area), from (x, y). */
export function galeCone(
  state: GameState,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  areaMult: number,
): Footprint {
  const W = state.tuning.wind;
  return {
    kind: 'arc',
    x,
    y,
    dirX,
    dirY,
    r: W.coneRadius * Math.sqrt(areaMult),
    halfAngleCos: rotationDeg(W.coneDeg / 2).cos,
  };
}

/**
 * Wind vanes (`Y`, M8), every sim tick in adventure mode: a vane spins for good once wind (a gust
 * or room wind) has covered a cell touching its tile for tuning.wind.vaneSeconds in a row
 * (`timer` counts it). Sends 'vaneSpun' and the vane's `@note`.
 */
export function stepVanes(state: GameState, dt: number): void {
  const g = state.grid;
  for (const o of state.objects) {
    if (o.kind !== 'wind_vane' || o.on) continue;
    let windy = false;
    const x0 = o.tx * TILE_CELLS - 1;
    const y0 = o.ty * TILE_CELLS - 1;
    for (let y = y0; y <= y0 + TILE_CELLS + 1 && !windy; y++) {
      if (y < 0 || y >= g.height) continue;
      for (let x = x0; x <= x0 + TILE_CELLS + 1; x++) {
        if (x < 0 || x >= g.width) continue;
        if (windAt(state, y * g.width + x) !== 0) {
          windy = true;
          break;
        }
      }
    }
    if (!windy) {
      o.timer = 0;
      continue;
    }
    o.timer += dt;
    if (o.timer + 1e-9 < state.tuning.wind.vaneSeconds) continue;
    o.on = true;
    o.timer = 0;
    const c = objectCenter(o);
    emit(state, { type: 'vaneSpun', key: o.key, x: c.x, y: c.y });
    sendNote(state, o);
  }
}
