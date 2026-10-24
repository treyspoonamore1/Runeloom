/**
 * Passive and Fuse rules on terrain you create and on the player's body (HeroMods "Terrain" and
 * "Rules"), for the grid and actor code. "You create" = owned by OWNER.player. Every function
 * returns the plain value when no rule applies, so neutral mods change nothing.
 *
 * Hooks:
 * - terrainDurationMult (grid/paint.ts): Lingering-style multiplier on every player-owned
 *   application (placed and lit fire, ice, charge, steam): 1 + terrainDurationInc.
 * - iceDurationMult (grid/elements.ts frostCell): 1 + iceDurationInc on player-made ice (Long Winter).
 * - chargeSeconds, conduction (grid/charge.ts): + chargeDurationAdd seconds (Overcharge, Storm
 *   Antler); water reach × (1 + conductionRangeInc) + conductionRangeAdd and cell cap +
 *   conductionCellsAdd (Conduit).
 * - iceConducts (grid/paint.ts, grid/charge.ts): Stormglass, ice and ice bridges carry the
 *   player's Storm charge like water.
 * - fireSpreadMult (grid/tick.ts): spread chance of player-owned fire × (1 + fireSpreadInc)
 *   (Kindler, Wildheart).
 * - terrainFireDpsMult (actors/terrain.ts): Wildheart, player-owned terrain fire ignites with
 *   × (1 + increased Fire damage).
 * - immuneToTerrainFire, alwaysWet (actors/terrain.ts): Pyre Walker, Hydromancer.
 * - dodgeTrail (actors/player.ts): Hydromancer's shallow water along each dodge.
 */
import { OWNER } from '../../../data/materials';
import { hydromancerGrounds } from '../../../data/passives';
import type { AilmentTarget } from '../combat/ailments';
import { placeTempWater } from '../grid/tempWater';
import type { GameState } from '../state';

export function terrainDurationMult(state: GameState, owner: number): number {
  return owner === OWNER.player ? 1 + state.heroMods.terrainDurationInc : 1;
}

export function iceDurationMult(state: GameState, owner: number): number {
  return owner === OWNER.player ? 1 + state.heroMods.iceDurationInc : 1;
}

/** Charge seconds for a chain of `owner`: base × durationMult, plus the player's added seconds. */
export function chargeSeconds(state: GameState, owner: number, base: number, durationMult: number): number {
  const s = base * durationMult;
  return owner === OWNER.player ? s + state.heroMods.chargeDurationAdd : s;
}

/** Water conduction reach (flood-fill steps and falloff distance) and cell cap for `owner`. */
export function waterConduction(state: GameState, owner: number): { maxDistance: number; maxCells: number } {
  const w = state.tuning.grid.water;
  if (owner !== OWNER.player) return { maxDistance: w.maxDistance, maxCells: w.maxCells };
  const m = state.heroMods;
  return {
    maxDistance: w.maxDistance * (1 + m.conductionRangeInc) + m.conductionRangeAdd,
    maxCells: w.maxCells + m.conductionCellsAdd,
  };
}

/** Stormglass (or the Stormglass Memory mutation, M7): ice carries Storm charge like water for `owner`'s chains. */
export function iceConducts(state: GameState, owner: number): boolean {
  if (owner !== OWNER.player) return false;
  const fx = state.heroMods.effects;
  return (fx.stormglass ?? 0) > 0 || (fx.ice_conducts ?? 0) > 0;
}

/** Multiplier on the spread chance of player-owned fire (1 when none). */
export function fireSpreadMult(state: GameState): number {
  return 1 + state.heroMods.fireSpreadInc;
}

/** Wildheart: terrain fire of `owner` ignites × (1 + increased Fire damage) when it's the player's. */
export function terrainFireDpsMult(state: GameState, owner: number): number {
  if (owner !== OWNER.player || (state.heroMods.effects.wildheart ?? 0) <= 0) return 1;
  return 1 + state.heroMods.damageInc.fire;
}

/** Pyre Walker: the player ignores terrain fire, whoever owns it. */
export function immuneToTerrainFire(state: GameState, t: AilmentTarget): boolean {
  return t === state.player && (state.heroMods.effects.pyre_walker ?? 0) > 0;
}

/** Hydromancer: the player is always Wet. */
export function alwaysWet(state: GameState, t: AilmentTarget): boolean {
  return t === state.player && (state.heroMods.effects.hydromancer ?? 0) > 0;
}

/** Hydromancer: each dodge tick leaves shallow water around the player for effects.hydromancer seconds. */
export function dodgeTrail(state: GameState): void {
  const seconds = state.heroMods.effects.hydromancer ?? 0;
  if (seconds <= 0) return;
  const p = state.player;
  const r = state.tuning.terrain.hydromancerTrailRadius;
  placeTempWater(state, p.x, p.y, r, seconds * terrainDurationMult(state, OWNER.player), hydromancerGrounds);
}
