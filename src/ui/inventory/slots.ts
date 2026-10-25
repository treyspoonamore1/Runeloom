/**
 * Inventory actions: every one goes through heroAdapter.sendEdit (a recorded HeroEdit), and a
 * refusal shows its reason as a note. Plus the slot names, icons and drag payloads.
 */
import { signal } from '@preact/signals';
import { UNFUSE_KEEP_COST } from '../../app/hero';
import type { Session } from '../../app/session';
import type { EquipSlot, FusePart, HeroState, Item } from '../../sim/hero/types';
import { filterAction } from '../../app/lootFilterStore';
import type { HeroEdit } from '../../sim/hero/edits';
import type { IconKind } from '../adventure/icons';
import { heroOf, sendEdit } from '../heroAdapter';
import { menuTip, note } from '../menus/frame';
import { itemDescription, partName, salvageValue, slotsFor, socketsOf } from './adapter';
import { bestSlotFor } from './invModel';
import {
  quickSalvageNeedsConfirm,
  summarizePresets,
  protectedReason,
  type SalvagePreset,
} from './salvageSel';
import { equippedItem } from './stats';

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

/** The bag item under the pointer or focus: the character sheet previews equipping it. */
export const previewUid = signal<number | null>(null);

/** What is being dragged, so drop targets can light up. */
export type DragPayload =
  { kind: 'item'; uid: number; from: EquipSlot | null } | { kind: 'part'; uid: number };
export const dragging = signal<DragPayload | null>(null);
export const DRAG_MIME = 'application/x-runeloom-hero';

/** The confirm dialog of the inventory, if open. */
export type InvDialog =
  | { kind: 'salvage'; uid: number; name: string; value: number }
  | { kind: 'unfuse'; spindleUid: number; socket: number; part: FusePart }
  /** Bulk salvage (M7.5): the preset picked; the dialog lists what each takes. */
  | { kind: 'bulk'; preset: SalvagePreset };
export const invDialog = signal<InvDialog | null>(null);

function send(session: Session, edit: HeroEdit, ok?: string): boolean {
  const why = sendEdit(session, edit);
  if (why) note(why);
  else {
    // The item the pointer was over may be gone now: no stale tooltip or preview.
    menuTip.value = null;
    previewUid.value = null;
    if (ok) note(ok, true);
  }
  return why === null;
}

/** Equips an unequipped item (into `slot`, else its natural slot; charms: the empty or weaker one). */
export function equip(session: Session, it: Item, slot?: EquipSlot): void {
  const target = slot ?? bestSlotFor(session, it);
  if (!target) return note("This can't be equipped");
  if (!slotsFor(it).includes(target))
    return note(`${itemDescription(it).name} doesn't go in the ${SLOT_NAMES[target]} slot`);
  send(session, { kind: 'equip', uid: it.uid, slot: target });
}

export function unequip(session: Session, slot: EquipSlot): void {
  send(session, { kind: 'unequip', slot });
}

export function toggleLock(session: Session, it: Item): void {
  const locked = !it.locked;
  send(session, { kind: 'lock', uid: it.uid, locked }, locked ? 'Kept: salvage skips it' : 'Unlocked');
}

/**
 * Shift-click: salvages at once, with the Scrap in a toast. Rare and Unique items ask first, and
 * an item marked to keep or holding Fuse parts says why it stays.
 */
export function quickSalvage(session: Session, it: Item | FusePart): void {
  if ('part' in it) return void salvageNow(session, it.uid, partName(it), salvageValue(it));
  if (it.locked) return note('Kept items stay: unlock it first (K)');
  if (it.fused.some((f) => f !== null)) return note('Unfuse its parts first');
  if (quickSalvageNeedsConfirm(it)) return askSalvage(it);
  salvageNow(session, it.uid, itemDescription(it).name, salvageValue(it));
}

function salvageNow(session: Session, uid: number, name: string, value: number): void {
  invDialog.value = null;
  send(session, { kind: 'salvage', uid }, `Salvaged ${name}: +${value} Thread Scrap`);
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

/** The confirmed single salvage (the dialog's button): the Scrap shows in a toast. */
export function salvage(session: Session, uid: number): void {
  const it = heroOf(session).items.find((i) => i.uid === uid);
  const part = heroOf(session).parts.find((p) => p.uid === uid);
  if (it) return salvageNow(session, uid, itemDescription(it).name, salvageValue(it));
  if (part) return salvageNow(session, uid, partName(part), salvageValue(part));
  invDialog.value = null;
  send(session, { kind: 'salvage', uid });
}

/** True when the loot filter (L) hides the item. */
export const filterHides = (it: Item): boolean => filterAction({ kind: 'item', item: it }) === 'hide';

/** Bag items the loot filter hides that a bulk salvage may take (never worn, kept, unique or fused). */
export function hiddenInBag(hero: Readonly<HeroState>): Item[] {
  return hero.items.filter((it) => protectedReason(hero, it) === null && filterHides(it));
}

/** "Salvage…": opens the bulk dialog on the first preset that takes something. */
export function askBulkSalvage(hero: Readonly<HeroState>, preset?: SalvagePreset): void {
  const sums = summarizePresets(hero, filterHides, salvageValue);
  const pick = preset ?? sums.find((s) => s.uids.length > 0)?.preset;
  if (!pick || sums.every((s) => s.uids.length === 0))
    return note('Nothing to salvage: worn, kept, unique and fused items stay');
  invDialog.value = { kind: 'bulk', preset: pick };
}

/** Salvages each listed item (one recorded edit each) and says how much Scrap it gave. */
export function bulkSalvage(session: Session, uids: readonly number[]): void {
  invDialog.value = null;
  const before = heroOf(session).threadScrap;
  let n = 0;
  for (const uid of uids) if (sendEdit(session, { kind: 'salvage', uid }) === null) n++;
  menuTip.value = null;
  previewUid.value = null;
  note(
    `Salvaged ${n} item${n === 1 ? '' : 's'}: +${heroOf(session).threadScrap - before} Thread Scrap`,
    true,
  );
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
