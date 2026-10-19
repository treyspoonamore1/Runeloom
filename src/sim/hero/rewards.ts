/**
 * First-clear rewards (CONTENT §9.1): the runes a room guarantees, paid once per save.
 *
 * CONTRACT (M4): the world agent calls `onRoomCleared` when the current room becomes cleared for
 * the first time (all its enemies dead; a room without enemies counts as cleared on entry; a boss
 * room when its boss dies). The hero/items agent implements it: unlock and grant the room's
 * guaranteedRunes (data/progression.ts) and set RoomFlags.rewardsPaid.
 */
import type { GameState } from '../state';

export function onRoomCleared(state: GameState, roomId: string): void {
  void state;
  void roomId;
}
