/**
 * First-clear rewards (CONTENT §9.1): the runes a room guarantees, paid once per save.
 *
 * CONTRACT (M4): the world agent calls `onRoomCleared` when the current room becomes cleared for
 * the first time (all its enemies dead; a room without enemies counts as cleared on entry; a boss
 * room when its boss dies). The hero/items agent implements it: unlock and grant the room's
 * guaranteedRunes (data/progression.ts) and set RoomFlags.rewardsPaid.
 *
 * The runes go straight into the pouch (no floor drop to miss), one 'runeUnlocked' per newly
 * unlocked rune and one 'rewardGranted' per item. Calling it again for a paid room does nothing.
 */
import { guaranteedRunes, type RegionRoomId } from '../../../data/progression';
import { emit } from '../events';
import type { GameState } from '../state';
import { roomFlags } from '../world/worldState';
import { makeRune } from '../items/items';
import { grantContent, type LootContent } from '../items/loot';

export function onRoomCleared(state: GameState, roomId: string): void {
  const flags = roomFlags(state.world, roomId);
  if (flags.rewardsPaid) return;
  flags.rewardsPaid = true;
  for (const rune of guaranteedRunes[roomId as RegionRoomId] ?? []) {
    const content: LootContent = { kind: 'rune', rune: makeRune(state.hero, rune) };
    grantContent(state, content);
    emit(state, { type: 'rewardGranted', roomId, content });
  }
}
