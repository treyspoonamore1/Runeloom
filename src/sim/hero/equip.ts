/**
 * Equipment edits (DESIGN §8): equip, unequip, salvage for Thread Scrap, fuse and unfuse. Each
 * returns why it can't apply, or null after applying it. The caller (applyHeroEdit) refreshes
 * the hero after a success.
 */
import { isFusePartId } from '../../../data/fuseParts';
import { scrapValues } from '../../../data/loot';
import { isSpindleId, type SpindleId } from '../../../data/spindles';
import type { GameState } from '../state';
import { setLoadoutSpindle } from '../weave/runtime/loadout';
import { baseName, equippedSlotOf, findItem, kindOfBase, slotsForKind } from '../items/items';
import { EQUIP_SLOTS, type EquipSlot } from './types';

function isSlot(s: string): s is EquipSlot {
  return (EQUIP_SLOTS as readonly string[]).includes(s);
}

/** Points the weaves at the equipped spindle's base (they recompile; weaves that no longer fit stop firing). */
export function syncWeaveSpindle(state: GameState): void {
  const uid = state.hero.equipped.spindle;
  const base = uid === null ? undefined : findItem(state.hero, uid)?.base;
  if (base === undefined || !isSpindleId(base)) return;
  if (state.weaves.spindleId !== base || state.weaves.capacity !== null)
    setLoadoutSpindle(state, base as SpindleId, null);
}

export function equip(state: GameState, uid: number, slot: EquipSlot): string | null {
  const hero = state.hero;
  if (!isSlot(slot)) return `No equipment slot "${String(slot)}"`;
  const item = findItem(hero, uid);
  if (!item) return "You don't have that item";
  const kind = kindOfBase(item.base);
  if (!kind || !slotsForKind(kind).includes(slot)) return `${baseName(item.base)} doesn't go in that slot`;
  const from = equippedSlotOf(hero, uid);
  if (from === slot) return null;
  if (from !== null) {
    // Moving between charm slots swaps with whatever is in the target slot.
    hero.equipped[from] = hero.equipped[slot];
  }
  hero.equipped[slot] = uid;
  if (slot === 'spindle') syncWeaveSpindle(state);
  return null;
}

export function unequip(state: GameState, slot: EquipSlot): string | null {
  if (!isSlot(slot)) return `No equipment slot "${String(slot)}"`;
  if (slot === 'spindle') return 'A spindle must stay equipped; equip another one instead';
  if (state.hero.equipped[slot] === null) return 'Nothing is equipped there';
  state.hero.equipped[slot] = null;
  return null;
}

/** Destroys an unequipped item (its fused parts must be removed first) or an unfused part for Thread Scrap. */
export function salvage(state: GameState, uid: number): string | null {
  const hero = state.hero;
  const i = hero.items.findIndex((it) => it.uid === uid);
  if (i >= 0) {
    const item = hero.items[i]!;
    if (equippedSlotOf(hero, uid) !== null) return 'Unequip it first';
    if (item.fused.some((p) => p !== null)) return 'Remove its fused parts first';
    hero.items.splice(i, 1);
    hero.threadScrap += scrapValues.item[item.rarity];
    return null;
  }
  const j = hero.parts.findIndex((p) => p.uid === uid);
  if (j >= 0) {
    const part = hero.parts[j]!;
    hero.parts.splice(j, 1);
    hero.threadScrap += scrapValues.part[part.tier - 1]!;
    return null;
  }
  return "You don't have that item";
}

export function fuse(state: GameState, partUid: number, spindleUid: number, socket: number): string | null {
  const hero = state.hero;
  const j = hero.parts.findIndex((p) => p.uid === partUid);
  if (j < 0) return "You don't have that part";
  const part = hero.parts[j]!;
  if (!isFusePartId(part.part)) return 'Unknown part';
  const spindle = findItem(hero, spindleUid);
  if (!spindle || kindOfBase(spindle.base) !== 'spindle') return 'Parts fuse only into spindles';
  if (!Number.isInteger(socket) || socket < 0 || socket >= spindle.fused.length)
    return `${baseName(spindle.base)} has no socket ${socket + 1}`;
  if (spindle.fused[socket] !== null) return 'That socket is taken; unfuse its part first';
  hero.parts.splice(j, 1);
  spindle.fused[socket] = part;
  return null;
}

/** Removes a fused part: destroyed, or kept for scrapValues.unfuseKeepCost Thread Scrap. */
export function unfuse(state: GameState, spindleUid: number, socket: number, keep: boolean): string | null {
  const hero = state.hero;
  const spindle = findItem(hero, spindleUid);
  if (!spindle || kindOfBase(spindle.base) !== 'spindle') return "That isn't a spindle";
  const part = Number.isInteger(socket) ? spindle.fused[socket] : undefined;
  if (!part) return 'That socket is empty';
  const cost = scrapValues.unfuseKeepCost;
  if (keep && hero.threadScrap < cost)
    return `Keeping the part costs ${cost} Thread Scrap; you have ${hero.threadScrap}`;
  spindle.fused[socket] = null;
  if (keep) {
    hero.threadScrap -= cost;
    hero.parts.push(part);
  }
  return null;
}
