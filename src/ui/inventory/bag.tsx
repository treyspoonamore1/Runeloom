/** The bag: unequipped items, Fuse parts and the rune pouch, as tabs. */
import { signal } from '@preact/signals';
import type { Session } from '../../app/session';
import { EQUIP_SLOTS, type HeroState, type RuneItem } from '../../sim/hero/types';
import { getRune } from '../../../data/runes';
import { parseWeave } from '../../sim/weave/notation';
import { Icon } from '../adventure/icons';
import { RuneGlyph } from '../loom/glyphs';
import { KIND_ORDER } from '../loom/describe';
import { usedBy } from '../loom/pouchCounts';
import { tipFor } from '../menus/frame';
import { itemDescription, partName } from './adapter';
import { dropTarget, startDrag } from './equipment';
import { askSalvage, dragging, equip, fuse, iconOf, unequip } from './slots';
import { ItemTip, PartTip, RuneTip } from './tips';

export type BagTab = 'items' | 'parts' | 'runes';
export const bagTab = signal<BagTab>('items');

function SalvageBtn({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <button
      type="button"
      class="inv-salv"
      aria-label={`Salvage ${label}`}
      title="Salvage for Thread Scrap"
      onClick={onClick}
    >
      ×
    </button>
  );
}

function Items({ session, hero }: { session: Session; hero: Readonly<HeroState>; rev: number }) {
  const worn = new Set(EQUIP_SLOTS.map((s) => hero.equipped[s]));
  const list = hero.items.filter((i) => !worn.has(i.uid));
  if (list.length === 0) return <p class="mn-muted">Your bag is empty. Enemies and chests drop gear.</p>;
  return (
    <div class="inv-grid">
      {list.map((it) => {
        const d = itemDescription(it);
        return (
          <div class="inv-cardwrap" key={it.uid}>
            <button
              type="button"
              class={`inv-card r-${it.rarity}`}
              draggable
              aria-label={`${d.name}, ${it.rarity} ${d.base}. Click to equip, Delete to salvage`}
              onClick={() => equip(session, it)}
              onKeyDown={(e) => {
                if (e.key === 'Delete' || e.key === 'Backspace') askSalvage(it);
              }}
              onDragStart={(e) => startDrag(e, { kind: 'item', uid: it.uid, from: null })}
              onDragEnd={() => (dragging.value = null)}
              {...tipFor(it.rarity, () => <ItemTip session={session} item={it} equipped={false} />)}
            >
              <span class="inv-ico">
                <Icon kind={iconOf(it)} />
              </span>
              <span class="inv-slot-txt">
                <b>{d.name}</b>
                <small>
                  {d.name !== d.base ? `${d.base} · ` : ''}ilvl {it.itemLevel}
                </small>
              </span>
            </button>
            <SalvageBtn label={d.name} onClick={() => askSalvage(it)} />
          </div>
        );
      })}
    </div>
  );
}

function Parts({ session, hero }: { session: Session; hero: Readonly<HeroState>; rev: number }) {
  if (hero.parts.length === 0) return <p class="mn-muted">No Fuse parts. Monsters drop them.</p>;
  return (
    <div class="inv-grid">
      {hero.parts.map((p) => (
        <div class="inv-cardwrap" key={p.uid}>
          <button
            type="button"
            class="inv-card r-magic"
            draggable
            aria-label={`${partName(p)}. Click to fuse, Delete to salvage`}
            onClick={() => fuse(session, p)}
            onKeyDown={(e) => {
              if (e.key === 'Delete' || e.key === 'Backspace') askSalvage(p);
            }}
            onDragStart={(e) => startDrag(e, { kind: 'part', uid: p.uid })}
            onDragEnd={() => (dragging.value = null)}
            {...tipFor('magic', () => <PartTip part={p} fused={false} />)}
          >
            <span class="inv-ico">
              <Icon kind="part" />
            </span>
            <span class="inv-slot-txt">
              <b>{partName(p)}</b>
              <small>Fuse part</small>
            </span>
          </button>
          <SalvageBtn label={partName(p)} onClick={() => askSalvage(p)} />
        </div>
      ))}
    </div>
  );
}

function Runes({ session, hero }: { session: Session; hero: Readonly<HeroState>; rev: number }) {
  const used = new Map<string, number>();
  for (const s of session.state.weaves.slots) {
    const p = s.notation ? parseWeave(s.notation) : null;
    if (p?.ok) usedBy(p.tree, used);
  }
  const groups = new Map<string, RuneItem[]>();
  for (const r of hero.runes) groups.set(r.rune, [...(groups.get(r.rune) ?? []), r]);
  const ids = [...groups.keys()].sort((a, b) => {
    const ka = KIND_ORDER.indexOf(getRune(a)?.kind ?? 'trigger');
    const kb = KIND_ORDER.indexOf(getRune(b)?.kind ?? 'trigger');
    return ka - kb || a.localeCompare(b);
  });
  if (ids.length === 0) return <p class="mn-muted">No runes yet.</p>;
  return (
    <div class="inv-grid runes">
      {ids.map((id) => {
        const copies = groups.get(id)!;
        const def = getRune(id);
        const inUse = used.get(id) ?? 0;
        const best = copies.reduce((a, b) => (b.level > a.level ? b : a));
        return (
          <button
            type="button"
            key={id}
            class={`inv-card rune k-${def?.kind ?? 'form'} r-${id}`}
            aria-label={`${def?.name ?? id}: ${copies.length} owned, ${inUse} in weaves`}
            {...tipFor('normal', () => <RuneTip rune={best} copies={copies} inUse={inUse} />)}
          >
            <span class={`lm-medal k-${def?.kind ?? 'form'} r-${id}`}>
              <RuneGlyph id={id} />
            </span>
            <span class="inv-slot-txt">
              <b>{def?.name ?? id}</b>
              <small>
                {inUse}/{copies.length} in use · best lv {best.level}
              </small>
            </span>
            <span class="inv-count">×{copies.length}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Bag({ session, hero, rev }: { session: Session; hero: Readonly<HeroState>; rev: number }) {
  const tab = bagTab.value;
  const worn = new Set(EQUIP_SLOTS.map((s) => hero.equipped[s]));
  const counts: Record<BagTab, number> = {
    items: hero.items.filter((i) => !worn.has(i.uid)).length,
    parts: hero.parts.length,
    runes: hero.runes.length,
  };
  const drag = dragging.value;
  const from = drag?.kind === 'item' ? drag.from : null;
  return (
    <section
      class={`mn-panel inv-bag${from && from !== 'spindle' ? ' lit' : ''}`}
      aria-label="Bag"
      {...dropTarget(
        (p) => p.kind === 'item' && p.from !== null,
        (p) => p.kind === 'item' && p.from && unequip(session, p.from),
      )}
    >
      <div class="inv-tabs" role="tablist" aria-label="Bag">
        {(['items', 'parts', 'runes'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            class="mn-tab"
            aria-selected={tab === t}
            onClick={() => (bagTab.value = t)}
          >
            {t === 'items' ? 'Items' : t === 'parts' ? 'Fuse parts' : 'Rune pouch'} <kbd>{counts[t]}</kbd>
          </button>
        ))}
      </div>
      <div class="mn-scroll">
        {tab === 'items' ? <Items session={session} hero={hero} rev={rev} /> : null}
        {tab === 'parts' ? <Parts session={session} hero={hero} rev={rev} /> : null}
        {tab === 'runes' ? <Runes session={session} hero={hero} rev={rev} /> : null}
      </div>
      <p class="mn-help">
        {tab === 'items'
          ? 'Click an item to equip it, or drag it onto a slot. Drag gear here to unequip. × salvages.'
          : tab === 'parts'
            ? 'Click a part to fuse it into your spindle, or drag it onto a socket. × salvages.'
            : 'Each rune sits in one weave at a time. Weave them in the Loom (Tab).'}
      </p>
    </section>
  );
}
