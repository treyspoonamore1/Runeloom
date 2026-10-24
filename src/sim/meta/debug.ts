/**
 * Dev console helpers for the Hearth (M7): `embers`, `ash`, `building`, `rifttier`, `offline`,
 * `hearth`. They change state outside `step` (the console marks the session edited, so replays
 * from it are flagged). Meta agent implements; the UI agent registers the commands.
 */
import type { BuildingId } from '../../../data/hearth';
import type { GameState } from '../state';

/** Lights the Hearth if needed (as the Cinder Warden would) and sets the Embers held. */
export function debugSetEmbers(state: GameState, embers: number): void {
  void state;
  void embers;
}

export function debugSetAsh(state: GameState, ash: number): void {
  void state;
  void ash;
}

/** Sets a building's level (0 to its max). */
export function debugSetBuilding(state: GameState, building: BuildingId, level: number): void {
  void state;
  void building;
  void level;
}

/** Sets the best rift tier completed this cycle (the ladder; Rekindle unlocks at 8). */
export function debugSetRiftTier(state: GameState, tier: number): void {
  void state;
  void tier;
}

/** Applies `seconds` of offline progress now, as the 'offline' edit would (no cap). */
export function debugOffline(state: GameState, seconds: number): void {
  void state;
  void seconds;
}
