/**
 * Loot chests (`$`, M8): a chest that pays its room's data/progression.ts roomChests contents once
 * per save (RoomFlags.taken keeps it open). G7's Windward Cache holds a Pattern Seed; F1's
 * furnace alcove a Fuse part and currency. Parts and currency come from the loot RNG. Everything
 * goes straight to the hero, as guaranteed runes do: one 'rewardGranted' per item (the HUD toasts
 * it), 'patternSeedGained' for a seed.
 */
import { fuseParts, type FusePartId } from '../../../data/fuseParts';
import { bossKinds, roomChests, type ChestContent, type WorldRoomId } from '../../../data/progression';
import { addPatternSeed } from '../hero/pickups';
import { rollCurrency, partTierFor } from '../items/drops';
import { makePart } from '../items/items';
import { grantContent, type LootContent } from '../items/loot';
import { emit } from '../events';
import type { GameState } from '../state';

/** Fuse parts a chest can hold: those regular monsters drop (not bosses' own parts), in id order. */
function chestParts(): FusePartId[] {
  return (Object.keys(fuseParts) as FusePartId[]).filter(
    (id) => !bossKinds.includes(fuseParts[id].dropsFrom),
  );
}

/** The loot one chest content gives (rolled now); [] for a Pattern Seed, which isn't loot. */
function rollContent(state: GameState, c: ChestContent): LootContent[] {
  if (c.kind === 'part') {
    const ids = chestParts();
    if (ids.length === 0) return [];
    const part = ids[state.lootRng.int(ids.length)]!;
    return [{ kind: 'part', part: makePart(state.hero, part, partTierFor(state.room.level)) }];
  }
  if (c.kind === 'currency') {
    const out: LootContent[] = [];
    for (let i = 0; i < c.amount; i++)
      out.push({ kind: 'currency', currency: rollCurrency(state.lootRng), amount: 1 });
    return out;
  }
  return [];
}

/** Pays the current room's chest contents at the chest's center (x, y). */
export function payLootChest(state: GameState, x: number, y: number): void {
  const roomId = state.room.id;
  for (const c of roomChests[roomId as WorldRoomId] ?? []) {
    if (c.kind === 'pattern_seed') addPatternSeed(state, x, y);
    else
      for (const content of rollContent(state, c)) {
        grantContent(state, content, { x, y });
        emit(state, { type: 'rewardGranted', roomId, content });
      }
  }
}
