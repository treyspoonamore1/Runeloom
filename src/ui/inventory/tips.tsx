/** Tooltip bodies for items, parts and runes, with "if you equip this" comparisons. */
import type { Session } from '../../app/session';
import type { FusePart, Item, RuneItem } from '../../sim/hero/types';
import { heroOf, modsFor } from '../heroAdapter';
import { itemDescription, partDescription, runeDescription, slotsFor, type Description } from './adapter';
import { compareItem } from './stats';
import { SLOT_NAMES } from './slots';

function Desc({ d }: { d: Description }) {
  return (
    <>
      <h4>{d.name}</h4>
      <p class="mn-base">
        {d.name !== d.base ? `${d.base} · ` : ''}
        {cap(d.rarity)}
      </p>
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

export function ItemTip({ session, item, equipped }: { session: Session; item: Item; equipped: boolean }) {
  const hero = heroOf(session);
  const d = itemDescription(item);
  const cmp = equipped ? null : compareItem(hero, item, slotsFor(item), modsFor, session.state.tuning);
  return (
    <>
      <Desc d={d} />
      {cmp ? (
        <>
          <div class="mn-sep">
            If equipped in {SLOT_NAMES[cmp.slot]}
            {cmp.current ? ` (replaces ${itemDescription(cmp.current).name})` : ''}
          </div>
          {cmp.deltas.length ? (
            <ul>
              {cmp.deltas.map((x) => (
                <li key={x.label} class={x.good ? 'good' : 'bad'}>
                  {x.text} {x.label}
                </li>
              ))}
            </ul>
          ) : (
            <p class="mn-muted">No change to your stats.</p>
          )}
          {cmp.current ? (
            <>
              <div class="mn-sep">Equipped now</div>
              <ul class="mn-cur">
                {itemDescription(cmp.current).lines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
      <p class="mn-hint">
        {equipped ? 'Click or drag to the bag to unequip.' : 'Click to equip, or drag it to a slot.'}
      </p>
    </>
  );
}

export function PartTip({ part, fused }: { part: FusePart; fused: boolean }) {
  return (
    <>
      <Desc d={partDescription(part)} />
      <p class="mn-hint">
        {fused ? 'Click to unfuse.' : 'Click to fuse it into your spindle, or drag it onto a socket.'}
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
