/**
 * First-clear rewards (CONTENT §9.1): the runes a room guarantees, paid once per save.
 *
 * CONTRACT (M4): the world agent calls `onRoomCleared` when the current room becomes cleared for
 * the first time (all its enemies dead; a room without enemies counts as cleared on entry; a boss
 * room when its boss dies), or, in a room with a rune shrine (`R`), when the player touches the
 * shrine instead. The hero/items agent implements it: unlock and grant the room's
 * guaranteedRunes (data/progression.ts) and set RoomFlags.rewardsPaid.
 *
 * The runes go straight into the pouch (no floor drop to miss), one 'runeUnlocked' per newly
 * unlocked rune and one 'rewardGranted' per item. Calling it again for a paid room does nothing.
 * Fen and Foundry runes (M8) arrive at data/progression.ts fenRuneLevel.
 *
 * The dungeon-item moment (DESIGN §10.2): a reward that unlocks an element rune for the first time
 * in the save (Frost at the K6 shrine, Storm from the Cinder Warden) also sends 'elementUnlocked'
 * at `from`. Unlocks are saved with the hero, so it is sent once per element per save.
 */
import { guaranteedRuneLevel, guaranteedRunes, type WorldRoomId } from '../../../data/progression';
import { runes } from '../../../data/runes';
import { emit } from '../events';
import type { GameState } from '../state';
import { roomFlags } from '../world/worldState';
import { makeRune } from '../items/items';
import { grantContent, type LootContent } from '../items/loot';
import type { RewardSource } from './events';

/** Where a reward came from, for the 'elementUnlocked' moment. Default: the player, source 'room'. */
export interface RewardFrom {
  x: number;
  y: number;
  source: RewardSource;
}

export function onRoomCleared(state: GameState, roomId: string, from?: RewardFrom): void {
  const flags = roomFlags(state.world, roomId);
  if (flags.rewardsPaid) return;
  flags.rewardsPaid = true;
  const at = from ?? { x: state.player.x, y: state.player.y, source: 'room' };
  const level = guaranteedRuneLevel(roomId);
  for (const rune of guaranteedRunes[roomId as WorldRoomId] ?? []) {
    const fresh = !state.hero.unlockedRunes.includes(rune);
    const content: LootContent = { kind: 'rune', rune: makeRune(state.hero, rune, level) };
    grantContent(state, content);
    emit(state, { type: 'rewardGranted', roomId, content });
    if (fresh && runes[rune].kind === 'element')
      emit(state, { type: 'elementUnlocked', rune, roomId, x: at.x, y: at.y, source: at.source });
  }
}
