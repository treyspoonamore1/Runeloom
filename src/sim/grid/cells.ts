/**
 * Cell-level terrain operations shared by the element rules (elements.ts), the grid tick
 * (tick.ts) and charge (charge.ts): material changes that keep the room's walk masks in sync,
 * ignition, smoke and steam, plus the batched event counters.
 */
import { MAT, OWNER, SURFACE, airSeconds, materialByCode, oil } from '../../../data/materials';
import { GRID_HZ, TILE_CELLS } from '../core/constants';
import type { GameState } from '../state';
import { markActive } from './active';
import type { Grid } from './grid';

/** sourceId of world hazards (explosions, ambient fire): no entity. */
export const WORLD_SOURCE_ID = -1;

/** Seconds → grid ticks, at least 1 for any positive time. */
export function gridTicks(seconds: number): number {
  if (seconds <= 0) return 0;
  const t = Math.round(seconds * GRID_HZ);
  return t < 1 ? 1 : t;
}

/** Clamp for u8 timers (fire charge, airTimer, wet). */
export function u8(t: number): number {
  return t > 255 ? 255 : t;
}

/** Clamp for u16 timers (fuel, material timer). */
export function u16(t: number): number {
  return t > 65535 ? 65535 : t;
}

/** Counts cells and their bounds for one batched event ('cellIgnited', 'burntOut', …). */
export interface CellBatch {
  count: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function newBatch(): CellBatch {
  return { count: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
}

export function addToBatch(b: CellBatch, g: Grid, i: number): void {
  const x = i % g.width;
  const y = (i - x) / g.width;
  if (b.count === 0) {
    b.minX = b.maxX = x;
    b.minY = b.maxY = y;
  } else {
    if (x < b.minX) b.minX = x;
    if (x > b.maxX) b.maxX = x;
    if (y < b.minY) b.minY = y;
    if (y > b.maxY) b.maxY = y;
  }
  b.count++;
}

/** Batched counters filled while rules run; flushed into events by flushFx (fx.ts). */
export const fx = {
  ignited: newBatch(),
  /** The Tar Matriarch's tar caught fire (a subset of `ignited`). */
  tarIgnited: newBatch(),
  burntOut: newBatch(),
  iceBreaking: newBatch(),
  iceBroke: newBatch(),
};

/**
 * Sets cell i's material. Resets the material timer, clears charge on non-conductors and keeps
 * room.solid / room.shotSolid in sync with the material table (bumping walkVersion on change).
 * Fire, fuel, surface and `under` are the caller's business.
 */
export function setGround(state: GameState, i: number, code: number): void {
  const g = state.grid;
  g.ground[i] = code;
  g.timer[i] = 0;
  const def = materialByCode[code]!;
  if (def.conducts === 'none' && g.charge[i]! > 0) clearCharge(g, i);
  const room = state.room;
  const solid = def.walk ? 0 : 1;
  const shot = def.blocksShots ? 1 : 0;
  if (room.solid[i] !== solid || room.shotSolid[i] !== shot) {
    room.solid[i] = solid;
    room.shotSolid[i] = shot;
    g.walkVersion++;
  }
  markActive(g.active, i);
}

export function clearCharge(g: Grid, i: number): void {
  g.charge[i] = 0;
  g.chargeId[i] = 0;
  g.chargeFalloff[i] = 0;
}

/** Fire can take hold here (rules 1, 2, 6): not burning, not wet, and oil or a flammable material. */
export function ignitable(g: Grid, i: number): boolean {
  if (g.fire[i]! > 0 || g.wet[i]! > 0) return false;
  return g.surface[i] === SURFACE.oil || materialByCode[g.ground[i]!]!.flammable !== null;
}

/**
 * Lights an ignitable cell (rules 1, 2, 6). Oil burns hot for oil.burnSeconds; a material burns
 * for its burnSeconds; fuel kept from a fire Frost put out (rule 9) is used first. An oil barrel
 * lights its whole tile. The Tar Matriarch's tar burns world-owned whoever lit it (fireOwner).
 * durationMult: Lingering (1 for spread). Returns false if it can't burn.
 */
export function ignite(state: GameState, i: number, owner: number, durationMult: number): boolean {
  const g = state.grid;
  if (!ignitable(g, i)) return false;
  const intensity = state.tuning.grid.fireIntensity;
  if (g.surface[i] === SURFACE.oil) {
    lightCell(g, i, intensity.oil, oil.burnSeconds, durationMult, owner);
    return true;
  }
  const flam = materialByCode[g.ground[i]!]!.flammable!;
  if (flam.explodeAfter !== undefined) {
    igniteBarrel(state, i, owner, gridTicks(flam.explodeAfter));
    return true;
  }
  lightCell(g, i, intensity.material, flam.burnSeconds, durationMult, owner);
  return true;
}

function lightCell(g: Grid, i: number, fire: number, seconds: number, mult: number, owner: number) {
  g.fire[i] = fire;
  if (g.fuel[i] === 0) g.fuel[i] = u16(gridTicks(seconds * mult));
  g.owner[i] = fireOwner(g, i, owner);
  markActive(g.active, i);
  addToBatch(fx.ignited, g, i);
  if (g.tar[i] === 1) addToBatch(fx.tarIgnited, g, i);
}

/**
 * The owner fire on cell i takes when `owner` lights it or burns on it (DESIGN §6.3 ownership):
 * the Tar Matriarch's volatile tar always burns world-owned (CONTENT §5), so it hurts everyone.
 */
export function fireOwner(g: Grid, i: number, owner: number): number {
  return g.tar[i] === 1 && g.surface[i] === SURFACE.oil ? OWNER.world : owner;
}

/** Every barrel cell of the barrel's tile catches at once and explodes after `ticks` (DESIGN §6.2). */
function igniteBarrel(state: GameState, i: number, owner: number, ticks: number): void {
  const g = state.grid;
  const fire = state.tuning.grid.fireIntensity.material;
  forBarrelTile(g, i, (j) => {
    if (g.fire[j]! > 0) return;
    g.fire[j] = fire;
    if (g.fuel[j] === 0) g.fuel[j] = ticks;
    g.owner[j] = owner;
    markActive(g.active, j);
    addToBatch(fx.ignited, g, j);
  });
}

/** Calls fn for every oil-barrel cell in cell i's tile (a barrel is one map tile). */
export function forBarrelTile(g: Grid, i: number, fn: (j: number) => void): void {
  const cx = i % g.width;
  const cy = (i - cx) / g.width;
  const x0 = cx - (cx % TILE_CELLS);
  const y0 = cy - (cy % TILE_CELLS);
  for (let y = y0; y < y0 + TILE_CELLS && y < g.height; y++)
    for (let x = x0; x < x0 + TILE_CELLS && x < g.width; x++) {
      const j = y * g.width + x;
      if (g.ground[j] === MAT.oil_barrel) fn(j);
    }
}

/** Fills cell i's air layer with smoke or steam for `ticks` (keeps the longer timer of the same kind). */
export function setAir(g: Grid, i: number, kind: number, ticks: number): void {
  if (g.air[i] !== kind || g.airTimer[i]! < ticks) g.airTimer[i] = u8(ticks);
  g.air[i] = kind;
  markActive(g.active, i);
}

/** Smoke's air timer, × `mult` (rift Choking Smoke, M6), at most what the u8 timer holds. */
export function smokeTicks(mult = 1): number {
  return Math.min(255, gridTicks(airSeconds.smoke * mult));
}

export function steamTicks(mult: number): number {
  return gridTicks(airSeconds.steam * mult);
}
