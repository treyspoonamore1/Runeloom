/**
 * Read-only grid hooks for the entity code (DESIGN §6.3 rules 15–20, 22, 25 and §6.4) and the
 * renderer. Nothing here changes state.
 *
 * - `cellAt(state, x, y)`: what is under a point (an entity's center): material, fire, oil, wet,
 *   charge, smoke/steam, ice crack progress.
 * - `chargeEventInfo(state, id)`: the damage, owner and source of a charge event. An entity is
 *   hit once per event id (rules 11, 12): when the charge lands on its cell, or when it first
 *   steps onto a cell with that id while `charged`. Water damage = damage × the cell's falloff.
 * - `terrainFireDps(state, onOil)`: rule 16's ignite DPS (refLife(area level) × 10%, ×2 on oil;
 *   above the knee level it grows like monster damage).
 * - `state.grid.blasts`: explosions of the latest grid tick (cleared by the next one).
 * - Ownership: `fireOwner` / `chargeOwner` are OWNER codes; hazards hurt the other team and
 *   never their owner team; world-owned ones hurt everyone (hazardHurts).
 */
import {
  AIR,
  OWNER,
  SURFACE,
  materialByCode,
  materials,
  oil,
  type MaterialDef,
} from '../../../data/materials';
import { scaleByLevel } from '../combat/damage';
import type { GameState } from '../state';
import { GRID_HZ } from '../core/constants';
import { gridTicks } from './cells';
import type { ChargeEvent, Grid } from './grid';

export interface CellView {
  /** Cell coordinates; -1 outside the grid (then material is wall and nothing else is set). */
  cx: number;
  cy: number;
  material: MaterialDef;
  burning: boolean;
  /** 0–255 (fireIntensity: material 192, oil 255, placed 128). */
  fireIntensity: number;
  /** Burning oil (terrain-fire DPS × oil.fireDpsMult). */
  oilBurning: boolean;
  /** OWNER code of the fire (also of the charge; the latest effect on a cell owns it). */
  fireOwner: number;
  oil: boolean;
  wet: boolean;
  charged: boolean;
  /** Rule 11 falloff on charged water (1 on metal); 0 when not charged. */
  chargeFalloff: number;
  /** Charge event id while charged, else 0. */
  chargeId: number;
  chargeOwner: number;
  smoke: boolean;
  steam: boolean;
  /** M8: fog in the air layer (render-only for the player; never Blinds). */
  fog: boolean;
  /** M8: the terrain is borrowed and goes back to `under` when its timer ends (rule 27). */
  borrowed: boolean;
  /** Ice bridge cracking: 0 until it starts, then rises to 1 when it breaks. */
  crackProgress: number;
}

const WALL_VIEW_MATERIAL = materials.wall;

function emptyView(): CellView {
  return {
    cx: -1,
    cy: -1,
    material: WALL_VIEW_MATERIAL,
    burning: false,
    fireIntensity: 0,
    oilBurning: false,
    fireOwner: OWNER.world,
    oil: false,
    wet: false,
    charged: false,
    chargeFalloff: 0,
    chargeId: 0,
    chargeOwner: OWNER.world,
    smoke: false,
    steam: false,
    fog: false,
    borrowed: false,
    crackProgress: 0,
  };
}

/**
 * The cell under point (x, y) in cells. Writes into `out` when given (no allocation; reuse one
 * per caller), else returns a new view.
 */
export function cellAt(state: GameState, x: number, y: number, out: CellView = emptyView()): CellView {
  const g = state.grid;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= g.width || cy >= g.height) {
    Object.assign(out, emptyView());
    return out;
  }
  const i = cy * g.width + cx;
  const fire = g.fire[i]!;
  const charge = g.charge[i]! > 0;
  const hasOil = g.surface[i] === SURFACE.oil;
  out.cx = cx;
  out.cy = cy;
  out.material = materialByCode[g.ground[i]!]!;
  out.burning = fire > 0;
  out.fireIntensity = fire;
  out.oilBurning = fire > 0 && hasOil;
  out.fireOwner = g.owner[i]!;
  out.oil = hasOil;
  out.wet = g.wet[i]! > 0;
  out.charged = charge;
  out.chargeFalloff = charge ? g.chargeFalloff[i]! : 0;
  out.chargeId = charge ? g.chargeId[i]! : 0;
  out.chargeOwner = g.owner[i]!;
  out.smoke = g.air[i] === AIR.smoke;
  out.steam = g.air[i] === AIR.steam;
  out.fog = g.air[i] === AIR.fog;
  out.borrowed = g.borrowed[i] === 1;
  out.crackProgress = iceCrackProgress(g, i);
  return out;
}

/** Ice bridge crack progress of cell i: 0 before cracking starts, rising to 1 as it breaks. */
export function iceCrackProgress(g: Grid, i: number): number {
  const def = materialByCode[g.ground[i]!]!;
  if (def.crackSeconds === undefined) return 0;
  const t = g.timer[i]!;
  const crack = gridTicks(def.crackSeconds);
  if (t === 0 || t > crack) return 0;
  return 1 - t / crack;
}

/** The charge event with this id while any of its cells is charged, else null. */
export function chargeEventInfo(state: GameState, id: number): Readonly<ChargeEvent> | null {
  for (const ev of state.grid.chargeEvents) if (ev.id === id) return ev;
  return null;
}

/** The area level terrain hazards scale with: the arena's in arena mode, else the room's. */
export function areaLevel(state: GameState): number {
  return state.mode === 'arena' ? state.arena.areaLevel : state.room.level;
}

/** DESIGN §7 refLife(L) = refLifeBase × enemyLifeGrowth^(L − 1). */
export function refLife(state: GameState, level = areaLevel(state)): number {
  return scaleByLevel(state.tuning.grid.refLifeBase, state.tuning.combat.enemyLifeGrowth, level);
}

/**
 * Rule 16 / DESIGN §6.4 terrain-fire ignite DPS at the current area level; doubled on burning oil.
 * Up to tuning.grid.terrainFireKneeLevel it is 10% of refLife; above, it grows with
 * enemyDamageGrowth from there (M6.5), like every other hazard.
 */
export function terrainFireDps(state: GameState, onOil: boolean): number {
  const level = areaLevel(state);
  const knee = state.tuning.grid.terrainFireKneeLevel;
  const base = refLife(state, Math.min(level, knee)) * state.tuning.grid.terrainFireLifeFraction;
  const dps = level > knee ? base * Math.pow(state.tuning.combat.enemyDamageGrowth, level - knee) : base;
  return onOil ? dps * oil.fireDpsMult : dps;
}

/** Hazard ownership (DESIGN §6.3): world hazards hurt everyone, team hazards only the other team. */
export function hazardHurts(hazardOwner: number, victimTeam: number): boolean {
  return hazardOwner === OWNER.world || hazardOwner !== victimTeam;
}

/** M8: true if cell i is water (shallow, deep, borrowed or not). Swimmers and stranding (rule 31) read this. */
export function isWater(state: GameState, i: number): boolean {
  return materialByCode[state.grid.ground[i]!]!.water !== null;
}

/** M8: true if cell i's terrain is borrowed (rule 27: it goes back to `under` when its timer ends). */
export function isBorrowed(state: GameState, i: number): boolean {
  return state.grid.borrowed[i] === 1;
}

/**
 * M8: seconds until borrowed cell i goes back (0 if not borrowed). The render flickers its last
 * tuning.tide.flickerSeconds.
 */
export function borrowedSecondsLeft(state: GameState, i: number): number {
  const g = state.grid;
  return g.borrowed[i] === 1 ? g.timer[i]! / GRID_HZ : 0;
}

/**
 * Rule 30 (M8): true if a body of radius r at (x, y) touches a lit furnace vent: some vent cell
 * lies within r + `touch` (default tuning.tide.ventTouch) of the center. Rooms without vents
 * return at once.
 */
export function touchesLitVent(
  state: GameState,
  x: number,
  y: number,
  r: number,
  touch = state.tuning.tide.ventTouch,
): boolean {
  const g = state.grid;
  if (g.vents === 0) return false;
  const reach = r + touch;
  const x0 = Math.max(0, Math.floor(x - reach));
  const y0 = Math.max(0, Math.floor(y - reach));
  const x1 = Math.min(g.width - 1, Math.floor(x + reach));
  const y1 = Math.min(g.height - 1, Math.floor(y + reach));
  const r2 = reach * reach;
  for (let cy = y0; cy <= y1; cy++)
    for (let cx = x0; cx <= x1; cx++) {
      if (!materialByCode[g.ground[cy * g.width + cx]!]!.ignitesTouching) continue;
      const qx = x < cx ? cx : x > cx + 1 ? cx + 1 : x;
      const qy = y < cy ? cy : y > cy + 1 ? cy + 1 : y;
      if ((x - qx) * (x - qx) + (y - qy) * (y - qy) <= r2) return true;
    }
  return false;
}
