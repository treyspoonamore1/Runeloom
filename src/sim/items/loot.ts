/**
 * Loot lying in the current room (M4): runes, items, Fuse parts and Thread Scrap that enemies
 * and chests dropped. Lives in `GameState.loot`, hashed. Walking within pickup range collects a
 * drop; anything still on the floor when the player leaves the room is collected then, so
 * nothing is lost.
 *
 * CONTRACT (M4), owned by the hero/items agent. The renderer draws drops and the UI shows
 * pickup toasts from events ('lootDropped', 'lootPicked'). The world agent calls
 * `collectRoomLoot` when the player leaves a room (before the room-scoped state is rebuilt) and
 * may call `dropLoot` for chests.
 */
import { lootFloor } from '../../../data/loot';
import { DT } from '../core/constants';
import type { Hasher } from '../core/hash';
import { emit } from '../events';
import type { GameState } from '../state';
import type { FusePart, HeroState, Item, RuneItem } from '../hero/types';
import { hashItem, hashPart, hashRune } from '../hero/hero';
import { isSolidCell } from '../world/room';
import { unlockRune } from '../hero/unlock';

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

/** Unit offsets for successive drops from one body (8 directions, then repeating farther out). */
const SPREAD: readonly [number, number][] = [
  [1, 0],
  [-0.7071, 0.7071],
  [0, -1],
  [0.7071, 0.7071],
  [-1, 0],
  [0.7071, -0.7071],
  [0, 1],
  [-0.7071, -0.7071],
];

/**
 * Puts `content` on the floor near (x, y): the `index`-th drop of one source lands at its own
 * spot around it (a wall spot falls back to (x, y)). Sends 'lootDropped'.
 */
export function dropLoot(state: GameState, x: number, y: number, content: LootContent, index = 0): LootDrop {
  const [ux, uy] = SPREAD[index % SPREAD.length]!;
  const r = lootFloor.dropSpread * (1 + Math.floor(index / SPREAD.length) * 0.5);
  let dx = x + ux * r;
  let dy = y + uy * r;
  if (isSolidCell(state.room, Math.floor(dx), Math.floor(dy))) {
    dx = x;
    dy = y;
  }
  const drop: LootDrop = { id: state.nextId++, x: dx, y: dy, content, age: 0 };
  state.loot.push(drop);
  emit(state, { type: 'lootDropped', id: drop.id, x: dx, y: dy, fromX: x, fromY: y, content });
  return drop;
}

/** Adds a drop's content to the hero: runes to the pouch, items to the inventory, parts, Thread Scrap. */
export function grantContent(state: GameState, content: LootContent): void {
  const hero: HeroState = state.hero;
  switch (content.kind) {
    case 'rune':
      hero.runes.push(content.rune);
      unlockRune(state, content.rune.rune);
      break;
    case 'item':
      hero.items.push(content.item);
      break;
    case 'part':
      hero.parts.push(content.part);
      break;
    case 'scrap':
      hero.threadScrap += content.amount;
      break;
  }
}

/** Ages drops and collects the ones in pickup range (after lootFloor.pickupDelay) while the player is alive. */
export function stepLoot(state: GameState): void {
  const loot = state.loot;
  if (loot.length === 0) return;
  const p = state.player;
  const r2 = lootFloor.pickupRadius * lootFloor.pickupRadius;
  let w = 0;
  for (const d of loot) {
    d.age += DT;
    const dx = d.x - p.x;
    const dy = d.y - p.y;
    if (!p.dead && d.age >= lootFloor.pickupDelay && dx * dx + dy * dy <= r2) {
      grantContent(state, d.content);
      emit(state, { type: 'lootPicked', id: d.id, x: d.x, y: d.y, content: d.content, onExit: false });
      continue;
    }
    loot[w++] = d;
  }
  loot.length = w;
}

/**
 * Collects everything still on the floor (the player is leaving the room). The world agent calls
 * this before rebuilding the room-scoped state. Sends 'lootPicked' with onExit for each.
 */
export function collectRoomLoot(state: GameState): void {
  for (const d of state.loot) {
    grantContent(state, d.content);
    emit(state, { type: 'lootPicked', id: d.id, x: d.x, y: d.y, content: d.content, onExit: true });
  }
  state.loot.length = 0;
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
