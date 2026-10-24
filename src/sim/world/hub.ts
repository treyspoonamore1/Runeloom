/**
 * The Hearth's hub room (M7, DESIGN §11): its stations (the Spindlewright, the Runekeeper, the
 * Cartographer, the Hearth fire and the four buildings) and using them with Interact (F).
 *
 * CONTRACT (M7), owned by the hub agent: the room file data/rooms/hearth/hearth.txt, the station
 * objects (world/objects.ts kinds), `stationHere`, and the 'stationUse' event when the living
 * player presses Interact at one (the UI opens that station's screen). Opening a screen changes
 * nothing in the sim, so replays need no record of it.
 */
import type { StationId } from '../../../data/hearth';
import type { GameState } from '../state';

/** The station the living player stands at (within reach of its tile), or null; hub room only. */
export function stationHere(state: GameState): StationId | null {
  void state;
  return null;
}
