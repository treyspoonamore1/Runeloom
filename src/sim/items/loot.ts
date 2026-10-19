/**
 * Loot lying in the current room (M4): runes, items, Fuse parts and Thread Scrap that enemies
 * and chests dropped. Lives in `GameState.loot`, hashed. Walking within pickup range collects a
 * drop; anything still on the floor when the player leaves the room is collected then, so
 * nothing is lost.
 *
 * CONTRACT (M4), owned by the hero/items agent. The renderer draws drops and the UI shows
 * pickup toasts from events.
 */
import type { Hasher } from '../core/hash';
import type { GameState } from '../state';
import type { FusePart, Item, RuneItem } from '../hero/types';
import { hashItem, hashPart, hashRune } from '../hero/hero';

export type LootContent =
  | { kind: 'rune'; rune: RuneItem }
  | { kind: 'item'; item: Item }
  | { kind: 'part'; part: FusePart }
  | { kind: 'scrap'; amount: number };

export interface LootDrop {
  /** Unique within the run (state.nextId space). */
  id: number;
  x: number;
  y: number;
  content: LootContent;
  /** Seconds since it dropped (pickup is delayed briefly so drops are seen landing). */
  age: number;
}

/** Ages drops and collects the ones in pickup range. Stub until the hero/items agent lands. */
export function stepLoot(state: GameState): void {
  void state;
}

export function hashLoot(h: Hasher, loot: readonly LootDrop[]): void {
  h.u32(loot.length);
  for (const d of loot) {
    h.u32(d.id).num(d.x).num(d.y).num(d.age).string(d.content.kind).byte(0);
    const c = d.content;
    if (c.kind === 'rune') hashRune(h, c.rune);
    else if (c.kind === 'item') hashItem(h, c.item);
    else if (c.kind === 'part') hashPart(h, c.part);
    else h.u32(c.amount);
  }
}
