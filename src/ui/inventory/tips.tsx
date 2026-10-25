/**
 * Tooltip bodies for items, parts and runes. A bag item shows two cards side by side, the item and
 * what you wear in its slot, with a table of what equipping changes underneath (M7.5).
 */
import type { Session } from '../../app/session';
import type { FusePart, Item, RuneItem } from '../../sim/hero/types';
import { heroOf, modsFor } from '../heroAdapter';
import { anchorOf, menuTip } from '../menus/frame';
import { itemDescription, partDescription, runeDescription, slotsFor, type Description } from './adapter';
import { bestSlotFor, upgradeOf } from './invModel';
import { ItemLines } from './itemLines';
import { SLOT_NAMES, previewUid } from './slots';
import { compareItem } from './stats';

function Desc({ d }: { d: Description }) {
  return (
    <>
      <h4>{d.name}</h4>
      <p class="mn-base">
        {d.name !== d.base ? `${d.base} · ` : ''}
        {cap(d.rarity)}
      </p>
      {d.properties.length ? <p class="mn-muted">{d.properties.join(' · ')}</p> : null}
      {d.lines.length ? (
        <ul>
          {d.lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : (
        <p class="mn-muted">No modifiers.</p>
      )}
    </>
  );
}

/** An item's name, base, properties and lines, affixes with their tier and roll range. */
function ItemBody({ item }: { item: Item }) {
  const d = itemDescription(item);
  return (
    <>
      <h4>{d.name}</h4>
      <p class="mn-base">
        {d.name !== d.base ? `${d.base} · ` : ''}
        {cap(d.rarity)}
        {item.locked ? ' · Kept' : ''}
      </p>
      {d.properties.length ? <p class="mn-muted">{d.properties.join(' · ')}</p> : null}
      <ItemLines item={item} lines={d.lines} />
    </>
  );
}

function Card({ item, tag, empty }: { item: Item | null; tag: string; empty?: string }) {
  return (
    <section class={`tc-card r-${item?.rarity ?? 'normal'}${item ? '' : ' empty'}`}>
      <p class="tc-tag">{tag}</p>
      {item ? <ItemBody item={item} /> : <p class="mn-muted">{empty}</p>}
    </section>
  );
}

const VERDICT = { up: 'Upgrade', down: 'Downgrade', same: '' } as const;

/** Two cards (this item, what you wear in its slot) and the stat changes between them. */
function CompareTip({ session, item }: { session: Session; item: Item }) {
  const hero = heroOf(session);
  const slots = slotsFor(item);
  const cmp = compareItem(hero, item, slots, modsFor, session.state.tuning, bestSlotFor(session, item));
  if (!cmp)
    return (
      <div class="tc-wrap">
        <Card item={item} tag="In bag" />
      </div>
    );
  const verdict = upgradeOf(session, item).verdict;
  return (
    <div class="tc-wrap">
      <div class="tc-row">
        <Card item={item} tag="In bag" />
        <Card
          item={cmp.current}
          tag={`Equipped · ${SLOT_NAMES[cmp.slot]}`}
          empty={`Nothing in your ${SLOT_NAMES[cmp.slot]} slot.`}
        />
      </div>
      <section class="tc-delta" aria-label="If equipped">
        <p class="tc-tag">
          If equipped
          {VERDICT[verdict] ? <b class={`tc-verdict ${verdict}`}>{VERDICT[verdict]}</b> : null}
        </p>
        {cmp.deltas.length ? (
          <ul class="tc-rows">
            {cmp.deltas.map((x) => (
              <li key={x.key} class={x.good ? 'good' : 'bad'}>
                <span class="tc-stat">{x.label}</span>
                <span class="tc-from">
                  {x.from} → {x.to}
                </span>
                <b>{x.text}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p class="mn-muted">No change to your stats.</p>
        )}
        <p class="mn-hint">
          Click or right-click: equip · Shift-click: salvage · Ctrl-click: craft · K: keep
        </p>
      </section>
    </div>
  );
}

export function ItemTip({ session, item, equipped }: { session: Session; item: Item; equipped: boolean }) {
  if (!equipped) return <CompareTip session={session} item={item} />;
  return (
    <>
      <ItemBody item={item} />
      <p class="mn-hint">Click or drag to the bag to unequip.</p>
    </>
  );
}

/** Hover and focus handlers for an item's tooltip. A bag item also drives the sheet's preview. */
export function itemTipProps(session: Session, item: Item, equipped: boolean) {
  const show = (e: Event) => {
    const el = e.currentTarget as Element;
    const panel = equipped ? null : el.closest('.inv-bag');
    menuTip.value = {
      at: anchorOf(el),
      rarity: item.rarity,
      bare: !equipped,
      // The compare sits over the bag, so the character sheet's changes stay in view.
      within: panel ? anchorOf(panel) : undefined,
      body: () => <ItemTip session={session} item={item} equipped={equipped} />,
    };
    if (!equipped) previewUid.value = item.uid;
  };
  const hide = () => {
    menuTip.value = null;
    if (!equipped) previewUid.value = null;
  };
  return { onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide };
}

export function PartTip({ part, fused }: { part: FusePart; fused: boolean }) {
  return (
    <>
      <Desc d={partDescription(part)} />
      <p class="mn-hint">
        {fused
          ? 'Click to unfuse.'
          : 'Click to fuse it into your spindle, or drag it onto a socket. Shift-click salvages.'}
      </p>
    </>
  );
}

export function RuneTip({ rune, copies, inUse }: { rune: RuneItem; copies: RuneItem[]; inUse: number }) {
  const d = runeDescription(rune);
  return (
    <>
      <Desc d={{ ...d, rarity: 'normal' }} />
      <div class="mn-sep">
        {copies.length} owned · {inUse} in weaves
      </div>
      <ul>
        {copies.map((c) => (
          <li key={c.uid}>
            Level {c.level}
            {c.quality ? ` · ${c.quality}% quality` : ''}
          </li>
        ))}
      </ul>
      <p class="mn-hint">Place runes in the Loom (Tab).</p>
    </>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
