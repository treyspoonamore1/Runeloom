/**
 * The inventory's glue between the pure models and a Session: the upgrade context (hero, mods,
 * tuning), the kind and slot of an item, and the cached upgrade answer the bag, the tooltips and
 * "equip" all share.
 */
import type { Session } from '../../app/session';
import type { ItemKind } from '../../../data/items';
import { EQUIP_SLOTS, type EquipSlot, type HeroState, type Item } from '../../sim/hero/types';
import { heroOf, heroRev, modsFor } from '../heroAdapter';
import { slotsFor } from './adapter';
import { kindOfSlots } from './bagModel';
import { bestSlot, upgradeInfo, type UpgradeCtx, type UpgradeInfo } from './upgrade';

export function upgradeCtxOf(session: Session): UpgradeCtx {
  return { hero: heroOf(session), modsFor, tuning: session.state.tuning };
}

/** Owned items that aren't worn, in acquisition order. */
export function unwornItems(hero: Readonly<HeroState>): Item[] {
  const worn = new Set(EQUIP_SLOTS.map((s) => hero.equipped[s]));
  return hero.items.filter((i) => !worn.has(i.uid));
}

export const kindOf = (it: Item): ItemKind | null => kindOfSlots(slotsFor(it));

/** Upgrade answer for a bag item, cached per hero revision (heroRev changes after every edit). */
export function upgradeOf(session: Session, it: Item): UpgradeInfo {
  return upgradeInfo(heroRev.peek(), upgradeCtxOf(session), it, slotsFor(it));
}

/** The slot a click equips the item into: its only slot, an empty one, else the weaker charm. */
export function bestSlotFor(session: Session, it: Item): EquipSlot | null {
  return bestSlot(upgradeCtxOf(session), it, slotsFor(it));
}
