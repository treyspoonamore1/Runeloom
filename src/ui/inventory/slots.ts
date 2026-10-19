/**
 * Inventory actions: every one goes through heroAdapter.sendEdit (a recorded HeroEdit), and a
 * refusal shows its reason as a note. Plus the slot names, icons and drag payloads.
 */
import { signal } from '@preact/signals';
import { uiTuning } from '../../../data/ui';
import type { Session } from '../../app/session';
import type { EquipSlot, FusePart, Item } from '../../sim/hero/types';
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
  | { kind: 'unfuse'; spindleUid: number; socket: number; part: FusePart };
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
  return scrap >= uiTuning.unfuseKeepCost
    ? null
    : `You have ${scrap} of ${uiTuning.unfuseKeepCost} Thread Scrap`;
}
