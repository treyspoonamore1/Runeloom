/**
 * Dev console helpers for the Hearth (M7): `embers`, `ash`, `building`, `rifttier`, `offline`,
 * `hearth`. They change state outside `step` (the console marks the session edited, so replays
 * from it are flagged). Meta agent implements; the UI agent registers the commands.
 */
import { buildings, offline, type BuildingId } from '../../../data/hearth';
import { RIFT_TIERS } from '../../../data/rift';
import type { GameState } from '../state';
import { advanceHearth, lightHearth, type HearthGains } from './hearth';

function whole(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(Number.isFinite(v) ? v : 0)));
}

/** Lights the Hearth if needed (as the Cinder Warden would) and sets the Embers held. */
export function debugSetEmbers(state: GameState, embers: number): void {
  lightHearth(state);
  state.hero.hearth.embers = whole(embers, 0, 1e9);
}

export function debugSetAsh(state: GameState, ash: number): void {
  state.hero.hearth.ash = whole(ash, 0, 1e9);
}

/** Sets a building's level (0 to its max); lights the Hearth if needed. */
export function debugSetBuilding(state: GameState, building: BuildingId, level: number): void {
  lightHearth(state);
  state.hero.hearth.buildings[building] = whole(level, 0, buildings[building].maxLevel);
}

/** Sets the best rift tier completed this cycle (the ladder; Rekindle unlocks at 8). */
export function debugSetRiftTier(state: GameState, tier: number): void {
  state.hero.riftTier = whole(tier, 0, RIFT_TIERS);
}

/** Applies `seconds` of offline progress now, as the 'offline' edit would (no cap). Returns what it gave. */
export function debugOffline(state: GameState, seconds: number): HearthGains {
  return advanceHearth(state, Math.max(0, Number.isFinite(seconds) ? seconds : 0));
}

/** One line describing the Hearth (console `hearth`). */
export function debugHearthLine(state: GameState): string {
  const h = state.hero.hearth;
  if (!h.lit) return 'The Hearth is not lit';
  const b = Object.entries(h.buildings)
    .map(([id, l]) => `${id} ${l}`)
    .join(', ');
  return `Embers ${h.embers} (spent ${h.embersSpent}), Ash ${h.ash}, Rekindles ${h.rekindles}, rift tier ${state.hero.riftTier}; ${b}; garden ${h.garden.length}, expeditions ${h.expeditions.length}, salvage ${h.salvage}; offline cap ${offline.capSeconds} s`;
}
