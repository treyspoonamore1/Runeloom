/**
 * The Hearth's hub room (M7, DESIGN §11): its stations (the Spindlewright, the Runekeeper, the
 * Cartographer, the Hearth fire and the four buildings) and using them with Interact (F).
 *
 * CONTRACT (M7), owned by the hub agent: the room file data/rooms/hearth/hearth.txt, the station
 * objects (world/objects.ts kinds, one per StationId), `stationHere`, and the 'stationUse' event
 * when the living player presses Interact at one (the UI opens that station's screen). Opening a
 * screen changes nothing in the sim, so replays need no record of it.
 */
import { hearthRoom, STATION_IDS, type StationId } from '../../../data/hearth';
import { Button, wasPressed, type InputFrame } from '../core/input';
import { emit } from '../events';
import type { GameState } from '../state';
import { objectCenter, type ObjectKind } from './objects';

const STATIONS: ReadonlySet<string> = new Set(STATION_IDS);

/** True for the hub's station object kinds. */
export function isStationKind(kind: ObjectKind): kind is StationId {
  return STATIONS.has(kind);
}

/**
 * The station the living player stands at in the hub: the one with a tile whose center is within
 * tuning.world.stationReach cells of the player, nearest first. Null when dead, outside the hub,
 * or at none.
 */
export function stationHere(state: GameState): StationId | null {
  const p = state.player;
  if (state.mode !== 'adventure' || state.room.id !== hearthRoom || p.dead) return null;
  const reach = state.tuning.world.stationReach;
  let best: StationId | null = null;
  let bestD2 = reach * reach;
  for (const o of state.objects) {
    if (!isStationKind(o.kind)) continue;
    const c = objectCenter(o);
    const d2 = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
    if (d2 <= bestD2 && (best === null || d2 < bestD2)) {
      best = o.kind;
      bestD2 = d2;
    }
  }
  return best;
}

/** Interact (F) pressed this tick (rising edge) at a station: 'stationUse'. Called by objectStep.ts. */
export function stepHub(state: GameState, input: InputFrame | undefined): void {
  if (!input || !wasPressed(state.prevButtons, input.buttons, Button.Interact)) return;
  const station = stationHere(state);
  if (station) emit(state, { type: 'stationUse', station });
}
