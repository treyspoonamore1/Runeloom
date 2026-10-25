/** The equipment slots (click or drag to equip and unequip) and the Fuse sockets of the spindle. */
import type { JSX } from 'preact';
import type { Session } from '../../app/session';
import { EQUIP_SLOTS, type EquipSlot, type HeroState } from '../../sim/hero/types';
import { Icon } from '../adventure/icons';
import { ItemArt } from '../items/itemArt';
import { menuTip } from '../menus/frame';
import { itemDescription, slotsFor } from './adapter';
import { Padlock } from './badges';
import { dragging, DRAG_MIME, equip, SLOT_ICON, SLOT_NAMES, unequip, type DragPayload } from './slots';
import { equippedItem } from './stats';
import { itemTipProps } from './tips';

export function readDrag(e: DragEvent): DragPayload | null {
  const raw = e.dataTransfer?.getData(DRAG_MIME);
  if (raw) {
    try {
      return JSON.parse(raw) as DragPayload;
    } catch {
      return null;
    }
  }
  return dragging.peek();
}

export function startDrag(e: DragEvent, p: DragPayload): void {
  menuTip.value = null;
  e.dataTransfer?.setData(DRAG_MIME, JSON.stringify(p));
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  dragging.value = p;
}

/** Drop-target handlers: `accepts` decides whether it lights up, `drop` acts. */
export function dropTarget(accepts: (p: DragPayload) => boolean, drop: (p: DragPayload) => void) {
  return {
    onDragOver: (e: JSX.TargetedDragEvent<HTMLElement>) => {
      const p = dragging.peek();
      if (p && accepts(p)) {
        e.preventDefault();
        e.currentTarget.classList.add('over');
      }
    },
    onDragLeave: (e: JSX.TargetedDragEvent<HTMLElement>) => e.currentTarget.classList.remove('over'),
    onDrop: (e: JSX.TargetedDragEvent<HTMLElement>) => {
      e.preventDefault();
      e.currentTarget.classList.remove('over');
      const p = readDrag(e);
      dragging.value = null;
      if (p && accepts(p)) drop(p);
    },
  };
}

function SlotButton({
  session,
  hero,
  slot,
}: {
  session: Session;
  hero: Readonly<HeroState>;
  /** heroRev: changes after every edit, so a mutated `hero` still re-renders (heroAdapter.ts). */
  rev: number;
  slot: EquipSlot;
}) {
  const it = equippedItem(hero, slot);
  const drag = dragging.value;
  const dragItem = drag?.kind === 'item' ? hero.items.find((i) => i.uid === drag.uid) : undefined;
  const fits = !!dragItem && slotsFor(dragItem).includes(slot) && drag?.kind === 'item' && drag.from !== slot;
  const d = it ? itemDescription(it) : null;
  return (
    <button
      type="button"
      class={`inv-slot s-${slot}${it ? ` filled r-${it.rarity}` : ''}${fits ? ' lit' : ''}`}
      draggable={!!it}
      aria-label={it ? `${SLOT_NAMES[slot]}: ${d!.name}. Click to unequip` : `${SLOT_NAMES[slot]}: empty`}
      onClick={() => (it ? unequip(session, slot) : undefined)}
      onDragStart={(e) => it && startDrag(e, { kind: 'item', uid: it.uid, from: slot })}
      onDragEnd={() => (dragging.value = null)}
      {...dropTarget(
        (p) => p.kind === 'item' && !!hero.items.find((i) => i.uid === p.uid && slotsFor(i).includes(slot)),
        (p) => {
          const item = hero.items.find((i) => i.uid === p.uid);
          if (item) equip(session, item, slot);
        },
      )}
      {...(it ? itemTipProps(session, it, true) : {})}
    >
      <span class="inv-art sm">
        {it ? (
          <ItemArt item={it} size="sm" />
        ) : (
          <span class="inv-ghost">
            <Icon kind={SLOT_ICON[slot]} />
          </span>
        )}
      </span>
      <span class="inv-slot-txt">
        <small>{SLOT_NAMES[slot]}</small>
        <b>{d ? d.name : 'Empty'}</b>
        {it ? (
          <em>
            {d!.name !== d!.base ? `${d!.base} · ` : ''}ilvl {it.itemLevel}
          </em>
        ) : null}
      </span>
      {it?.locked ? (
        <span class="inv-kept" title="Kept: salvage skips it">
          <Padlock locked />
        </span>
      ) : null}
    </button>
  );
}

export function Equipment({
  session,
  hero,
  rev,
}: {
  session: Session;
  hero: Readonly<HeroState>;
  rev: number;
}) {
  return (
    <div class="inv-doll" aria-label="Equipment">
      {EQUIP_SLOTS.map((s) => (
        <SlotButton key={s} session={session} hero={hero} rev={rev} slot={s} />
      ))}
    </div>
  );
}
