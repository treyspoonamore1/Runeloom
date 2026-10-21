/**
 * Inventory actions: every one goes through heroAdapter.sendEdit (a recorded HeroEdit), and a
 * refusal shows its reason as a note. Plus the slot names, icons and drag payloads.
 */
import { signal } from '@preact/signals';
import { UNFUSE_KEEP_COST } from '../../app/hero';
import type { Session } from '../../app/session';
import { EQUIP_SLOTS, type EquipSlot, type FusePart, type HeroState, type Item } from '../../sim/hero/types';
import { filterAction } from '../../app/lootFilterStore';
import type { HeroEdit } from '../../sim/hero/edits';
import type { IconKind } from '../adventure/icons';
import { heroOf, sendEdit } from '../heroAdapter';
import { note } from '../menus/frame';
import { itemDescription, partName, salvageValue, slotsFor, socketsOf } from './adapter';
import { equippedItem, targetSlot } from './stats';

export const SLOT_NAMES: Record<EquipSlot, string> = {
  spindle: 'Spindle',
  cloak: 'Cloak',
  hood: 'Hood',
  boots: 'Boots',
  charm1: 'Charm',
  charm2: 'Charm',
};

export const SLOT_ICON: Record<EquipSlot, IconKind> = {
  spindle: 'spindle',
  cloak: 'cloak',
  hood: 'hood',
  boots: 'boots',
  charm1: 'charm',
  charm2: 'charm',
};

export const iconOf = (it: Item): IconKind => SLOT_ICON[slotsFor(it)[0] ?? 'charm1'];

/** What is being dragged, so drop targets can light up. */
export type DragPayload =
  { kind: 'item'; uid: number; from: EquipSlot | null } | { kind: 'part'; uid: number };
export const dragging = signal<DragPayload | null>(null);
export const DRAG_MIME = 'application/x-runeloom-hero';

/** The confirm dialog of the inventory, if open. */
export type InvDialog =
  | { kind: 'salvage'; uid: number; name: string; value: number }
  | { kind: 'unfuse'; spindleUid: number; socket: number; part: FusePart }
  /** Salvage every unequipped item the loot filter hides (M5). */
  | { kind: 'salvageHidden'; uids: number[]; value: number };
export const invDialog = signal<InvDialog | null>(null);

function send(session: Session, edit: HeroEdit, ok?: string): boolean {
  const why = sendEdit(session, edit);
  if (why) note(why);
  else if (ok) note(ok, true);
  return why === null;
}

/** Equips an unequipped item (into `slot`, else its natural slot). */
export function equip(session: Session, it: Item, slot?: EquipSlot): void {
  const hero = heroOf(session);
  const target = slot ?? targetSlot(hero, slotsFor(it));
  if (!target) return note("This can't be equipped");
  if (!slotsFor(it).includes(target))
    return note(`${itemDescription(it).name} doesn't go in the ${SLOT_NAMES[target]} slot`);
  send(session, { kind: 'equip', uid: it.uid, slot: target });
}

export function unequip(session: Session, slot: EquipSlot): void {
  send(session, { kind: 'unequip', slot });
}

export function askSalvage(it: Item | FusePart): void {
  const isPart = 'part' in it;
  invDialog.value = {
    kind: 'salvage',
    uid: it.uid,
    name: isPart ? partName(it) : itemDescription(it).name,
    value: salvageValue(it),
  };
}

export function salvage(session: Session, uid: number): void {
  invDialog.value = null;
  send(session, { kind: 'salvage', uid });
}

/** Unequipped items without fused parts that the loot filter hides: what "Salvage hidden" takes. */
export function hiddenInBag(hero: Readonly<HeroState>): Item[] {
  const worn = new Set(EQUIP_SLOTS.map((s) => hero.equipped[s]));
  return hero.items.filter(
    (it) =>
      !worn.has(it.uid) &&
      it.fused.every((f) => f === null) &&
      filterAction({ kind: 'item', item: it }) === 'hide',
  );
}

export function askSalvageHidden(hero: Readonly<HeroState>): void {
  const list = hiddenInBag(hero);
  if (list.length === 0) return note('Your loot filter hides nothing in your bag');
  invDialog.value = {
    kind: 'salvageHidden',
    uids: list.map((it) => it.uid),
    value: list.reduce((s, it) => s + salvageValue(it), 0),
  };
}

/** Salvages each listed item (one recorded edit each). */
export function salvageHidden(session: Session, uids: readonly number[]): void {
  invDialog.value = null;
  let n = 0;
  for (const uid of uids) if (sendEdit(session, { kind: 'salvage', uid }) === null) n++;
  note(`Salvaged ${n} item${n === 1 ? '' : 's'}`, true);
}

/** Fuses a part into the equipped spindle: into `socket`, else the first empty one. */
export function fuse(session: Session, part: FusePart, socket?: number): void {
  const hero = heroOf(session);
  const sp = equippedItem(hero, 'spindle');
  if (!sp || socketsOf(sp) === 0) return note('Equip a spindle with a Fuse socket first');
  const at = socket ?? sp.fused.findIndex((f) => f === null);
  if (at < 0) return note('Every socket is taken: unfuse a part first');
  if (sp.fused[at]) return note('That socket is taken: unfuse its part first');
  send(
    session,
    { kind: 'fuse', partUid: part.uid, spindleUid: sp.uid, socket: at },
    `Fused ${partName(part)}`,
  );
}

export function askUnfuse(spindleUid: number, socket: number, part: FusePart): void {
  invDialog.value = { kind: 'unfuse', spindleUid, socket, part };
}

export function unfuse(session: Session, spindleUid: number, socket: number, keep: boolean): void {
  invDialog.value = null;
  send(session, { kind: 'unfuse', spindleUid, socket, keep }, keep ? 'Part kept' : 'Part destroyed');
}

/** Why "keep for 5 Thread Scrap" is unavailable, or null. */
export function keepProblem(scrap: number): string | null {
  return scrap >= UNFUSE_KEEP_COST ? null : `You have ${scrap} of ${UNFUSE_KEEP_COST} Thread Scrap`;
}
