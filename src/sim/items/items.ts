/**
 * Equipment items: what kind each base is, which slots take it, and making new ones. Items are
 * plain data (hero/types.ts Item); bases key data/spindles.ts or data/items.ts.
 */
import { gearBases, isGearBaseId, itemKindNames, type ItemKind } from '../../../data/items';
import { isSpindleId, spindles } from '../../../data/spindles';
import type { EquipSlot, FusePart, HeroState, Item, ItemRarity, RuneItem } from '../hero/types';
import type { RuneId } from '../../../data/runes';

/** The kind of an item base, or null for an unknown base. */
export function kindOfBase(base: string): ItemKind | null {
  if (isSpindleId(base)) return 'spindle';
  if (isGearBaseId(base)) return gearBases[base].kind;
  return null;
}

/** Slots that take items of a kind. */
export function slotsForKind(kind: ItemKind): readonly EquipSlot[] {
  switch (kind) {
    case 'spindle':
      return ['spindle'];
    case 'charm':
      return ['charm1', 'charm2'];
    default:
      return [kind];
  }
}

/** The base's display name ("Ashwood Spindle", "Wool Hood"). */
export function baseName(base: string): string {
  if (isSpindleId(base)) return spindles[base].name;
  if (isGearBaseId(base)) return gearBases[base].name;
  return base;
}

/** The base's kind name ("Spindle", "Cloak"). */
export function kindName(base: string): string {
  const k = kindOfBase(base);
  return k ? itemKindNames[k] : 'Item';
}

/** Fuse sockets of a spindle base, else 0. */
export function socketCount(base: string): number {
  return isSpindleId(base) ? spindles[base].fuseSockets : 0;
}

/** Takes the next uid from the hero's single id space for runes, items and parts. */
export function nextUid(hero: HeroState): number {
  return hero.nextUid++;
}

export function makeItem(
  hero: HeroState,
  base: string,
  rarity: ItemRarity,
  itemLevel: number,
  affixes: Item['affixes'] = [],
): Item {
  return {
    uid: nextUid(hero),
    base,
    rarity,
    itemLevel,
    affixes,
    fused: new Array<FusePart | null>(socketCount(base)).fill(null),
  };
}

export function makeRune(hero: HeroState, rune: RuneId, level = 1): RuneItem {
  return { uid: nextUid(hero), rune, level, xp: 0, quality: 0 };
}

export function makePart(hero: HeroState, part: string, tier: 1 | 2 | 3): FusePart {
  return { uid: nextUid(hero), part, tier };
}

export function findItem(hero: HeroState, uid: number): Item | undefined {
  return hero.items.find((it) => it.uid === uid);
}

/** The slot an item is equipped in, or null. */
export function equippedSlotOf(hero: HeroState, uid: number): EquipSlot | null {
  for (const slot of Object.keys(hero.equipped) as EquipSlot[]) if (hero.equipped[slot] === uid) return slot;
  return null;
}

/** The equipped spindle item, or undefined (sandbox, arena, lab). */
export function equippedSpindle(hero: HeroState): Item | undefined {
  const uid = hero.equipped.spindle;
  return uid === null ? undefined : findItem(hero, uid);
}
