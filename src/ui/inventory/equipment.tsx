/** The equipment slots (click or drag to equip and unequip) and the Fuse sockets of the spindle. */
import type { JSX } from 'preact';
import type { Session } from '../../app/session';
import { EQUIP_SLOTS, type EquipSlot, type HeroState } from '../../sim/hero/types';
import { uiTuning } from '../../../data/ui';
import { Icon } from '../adventure/icons';
import { menuTip, tipFor } from '../menus/frame';
import { itemDescription, partName, slotsFor, socketsOf } from './adapter';
import {
  askUnfuse,
  dragging,
  DRAG_MIME,
  equip,
  fuse,
  SLOT_ICON,
  SLOT_NAMES,
  unequip,
  type DragPayload,
} from './slots';
import { equippedItem } from './stats';
import { ItemTip, PartTip } from './tips';

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
      {...(it ? tipFor(it.rarity, () => <ItemTip session={session} item={it} equipped />) : {})}
    >
      <span class="inv-ico">
        <Icon kind={SLOT_ICON[slot]} />
      </span>
      <span class="inv-slot-txt">
        <small>{SLOT_NAMES[slot]}</small>
        <b>{d ? d.name : 'Empty'}</b>
      </span>
    </button>
  );
}

export function Equipment({ session, hero }: { session: Session; hero: Readonly<HeroState> }) {
  return (
    <div class="inv-doll" aria-label="Equipment">
      {EQUIP_SLOTS.map((s) => (
        <SlotButton key={s} session={session} hero={hero} slot={s} />
      ))}
    </div>
  );
}

/** The equipped spindle's sockets: drop a part to fuse it; a fused part offers Unfuse. */
export function FusePanel({ session, hero }: { session: Session; hero: Readonly<HeroState> }) {
  const sp = equippedItem(hero, 'spindle');
  const n = sp ? socketsOf(sp) : 0;
  const drag = dragging.value;
  return (
    <div class="inv-fuse" aria-label="Fuse">
      <h3>
        Fuse <small>{sp ? itemDescription(sp).name : 'No spindle'}</small>
      </h3>
      {n === 0 ? <p class="mn-muted">This spindle has no Fuse socket.</p> : null}
      <div class="inv-sockets">
        {Array.from({ length: n }, (_, i) => {
          const part = sp!.fused[i] ?? null;
          if (part)
            return (
              <button
                key={i}
                type="button"
                class="inv-socket full"
                aria-label={`Socket ${i + 1}: ${partName(part)}. Click to unfuse`}
                onClick={() => askUnfuse(sp!.uid, i, part)}
                {...tipFor('magic', () => <PartTip part={part} fused />)}
              >
                <span class="inv-ico">
                  <Icon kind="part" />
                </span>
                <span class="inv-slot-txt">
                  <small>Socket {i + 1}</small>
                  <b>{partName(part)}</b>
                </span>
                <span class="inv-unfuse">Unfuse</span>
              </button>
            );
          return (
            <div
              key={i}
              class={`inv-socket empty${drag?.kind === 'part' ? ' lit' : ''}`}
              {...dropTarget(
                (p) => p.kind === 'part',
                (p) => {
                  const pt = hero.parts.find((x) => x.uid === p.uid);
                  if (pt) fuse(session, pt, i);
                },
              )}
            >
              <span class="inv-ring" />
              <span class="inv-slot-txt">
                <small>Socket {i + 1}</small>
                <b>Drop a part here</b>
              </span>
            </div>
          );
        })}
      </div>
      <p class="mn-help">
        Unfusing destroys the part, unless you pay {uiTuning.unfuseKeepCost} Thread Scrap to keep it.
      </p>
    </div>
  );
}
