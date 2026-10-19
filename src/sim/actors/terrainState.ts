/**
 * What an entity (player or enemy) carries from the chemistry grid (DESIGN §6.3 rules 15–19, 22,
 * 25; §6.4 Wet, Oiled, Blind). Plain data on `PlayerState.terrain` and `Enemy.terrain`, hashed.
 * Written by actors/terrain.ts (the terrain phase of a tick) and the movement code; render and
 * audio read it (wet/oiled/blind/onIce/stun icons and tints).
 */
import type { Hasher } from '../core/hash';

/** How many recent charge events an entity remembers (rules 11, 12: one hit per event id). */
export const CHARGE_MEMORY = 4;

export interface TerrainState {
  /** Seconds of Wet left (rule 15): refreshed to tuning.terrain.wetSeconds while in shallow water. 0 = dry. */
  wetLeft: number;
  /** Seconds of Oiled left (rule 17): refreshed to tuning.terrain.oiledSeconds while on oil. 0 = clean. */
  oiledLeft: number;
  /** Standing on a slippery cell (ice, ice bridge) this tick: low acceleration and deceleration. */
  onIce: boolean;
  /** Speed multiplier of the ground under it this tick (material moveMult × oil 0.85). */
  moveMult: number;
  /** Enemies: inside smoke or steam, or its target is (DESIGN §6.4 Blind). Always false on the player. */
  blind: boolean;
  /** Seconds of stun left (a doused Tinderling, CONTENT §5). Stunned enemies don't think or move. */
  stunLeft: number;
  /** Cell index under its center at the last terrain phase (-1 before the first). */
  cell: number;
  /**
   * Last safe position (rule 25): its center on a walkable cell that can't drop away under it
   * (not an ice bridge or a bridge/floor over water or a pit). Falls return here.
   */
  safeX: number;
  safeY: number;
  /** A safe position has been recorded since spawn/respawn. */
  hasSafe: boolean;
  /** Ids of the last CHARGE_MEMORY charge events that hit it (0 = empty slot). */
  chargeIds: number[];
  /** Next slot of chargeIds to overwrite. */
  chargeNext: number;
  /** Enemies on ice: their actual velocity (cells/s), which eases toward the AI's wanted velocity. */
  slideX: number;
  slideY: number;
}

export function createTerrainState(x: number, y: number): TerrainState {
  return {
    wetLeft: 0,
    oiledLeft: 0,
    onIce: false,
    moveMult: 1,
    blind: false,
    stunLeft: 0,
    cell: -1,
    safeX: x,
    safeY: y,
    hasSafe: false,
    chargeIds: new Array<number>(CHARGE_MEMORY).fill(0),
    chargeNext: 0,
    slideX: 0,
    slideY: 0,
  };
}

/** Back to a fresh state at (x, y) in place (player death and respawn). */
export function resetTerrainState(t: TerrainState, x: number, y: number): void {
  Object.assign(t, createTerrainState(x, y));
}

export function isWet(t: { terrain: TerrainState }): boolean {
  return t.terrain.wetLeft > 0;
}

export function isOiled(t: { terrain: TerrainState }): boolean {
  return t.terrain.oiledLeft > 0;
}

export function isStunned(t: { terrain: TerrainState }): boolean {
  return t.terrain.stunLeft > 0;
}

/** True if charge event `id` already hit this entity. */
export function chargeSeen(t: TerrainState, id: number): boolean {
  const ids = t.chargeIds;
  for (let k = 0; k < ids.length; k++) if (ids[k] === id) return true;
  return false;
}

export function rememberCharge(t: TerrainState, id: number): void {
  t.chargeIds[t.chargeNext] = id;
  t.chargeNext = (t.chargeNext + 1) % t.chargeIds.length;
}

export function hashTerrainState(h: Hasher, t: TerrainState): void {
  h.num(t.wetLeft).num(t.oiledLeft).bool(t.onIce).num(t.moveMult).bool(t.blind).num(t.stunLeft);
  h.num(t.cell).num(t.safeX).num(t.safeY).bool(t.hasSafe).u32(t.chargeNext);
  for (const id of t.chargeIds) h.u32(id);
  h.num(t.slideX).num(t.slideY);
}
