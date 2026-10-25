/**
 * The bag's Items tab (M7.5): a grid of item tiles you can sort and filter, with the shortcuts
 * that save clicks. Click or right-click equips, Shift-click salvages, Ctrl-click sends the item
 * to the crafting bench, K keeps it (the padlock), Delete asks to salvage it, and the arrow keys
 * move around the grid. Hovering a tile compares it with what you wear (tips.tsx).
 */
import type { JSX } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { itemKinds } from '../../../data/items';
import type { Session } from '../../app/session';
import type { HeroState, Item } from '../../sim/hero/types';
import { craftTarget } from '../craft/craftScreen';
import { ItemArt } from '../items/itemArt';
import { menuTip, type MenuId } from '../menus/frame';
import { itemDescription, socketsOf } from './adapter';
import { Arrow, Padlock, Pips } from './badges';
import {
  filtersActive,
  nextIndex,
  RARITIES,
  SORT_KEYS,
  SORT_LABELS,
  viewItems,
  type RarityFilter,
  type SlotFilter,
  type SortKey,
} from './bagModel';
import { bagPrefs, clearFilters, setPrefs } from './bagPrefs';
import { kindOf, unwornItems, upgradeOf } from './invModel';
import { startDrag } from './equipment';
import { itemTipProps } from './tips';
import { askBulkSalvage, askSalvage, dragging, equip, previewUid, quickSalvage, toggleLock } from './slots';

const SLOT_LABELS: Record<string, string> = {
  all: 'All slots',
  spindle: 'Spindles',
  cloak: 'Cloaks',
  hood: 'Hoods',
  boots: 'Boots',
  charm: 'Charms',
};

/** Where focus returns after a keyboard action takes a tile out of the bag. */
let refocus: number | null = null;

/** Ctrl-click: puts the item on the crafting bench and switches to it. */
export function sendToBench(it: Item, onTab: (id: MenuId) => void): void {
  craftTarget.value = it.uid;
  menuTip.value = null;
  previewUid.value = null;
  onTab('craft');
}

function Select<T extends string>(p: {
  label: string;
  value: T;
  options: readonly { id: T; text: string }[];
  onPick(v: T): void;
}) {
  return (
    <label class="inv-sel">
      <span>{p.label}</span>
      <select value={p.value} onChange={(e) => p.onPick(e.currentTarget.value as T)}>
        {p.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.text}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toolbar({ hero, shown, total }: { hero: Readonly<HeroState>; shown: number; total: number }) {
  const prefs = bagPrefs.value;
  return (
    <div class="inv-tools" role="group" aria-label="Sort and filter the bag">
      <Select
        label="Sort"
        value={prefs.sort}
        options={SORT_KEYS.map((id) => ({ id, text: SORT_LABELS[id] }))}
        onPick={(sort: SortKey) => setPrefs({ sort })}
      />
      <Select
        label="Slot"
        value={prefs.slot}
        options={(['all', ...itemKinds] as SlotFilter[]).map((id) => ({ id, text: SLOT_LABELS[id]! }))}
        onPick={(slot: SlotFilter) => setPrefs({ slot })}
      />
      <Select
        label="Rarity"
        value={prefs.rarity}
        options={(['all', ...RARITIES] as RarityFilter[]).map((id) => ({
          id,
          text: id === 'all' ? 'All rarities' : id[0]!.toUpperCase() + id.slice(1),
        }))}
        onPick={(rarity: RarityFilter) => setPrefs({ rarity })}
      />
      <button
        type="button"
        class="inv-tog"
        aria-pressed={prefs.upgradesOnly}
        title="Only items that would improve on what you wear"
        onClick={() => setPrefs({ upgradesOnly: !prefs.upgradesOnly })}
      >
        <Arrow verdict="up" /> Upgrades
      </button>
      <span class="inv-count-note" aria-live="polite">
        {shown === total ? `${total} items` : `${shown} of ${total}`}
      </span>
      <button
        type="button"
        class="mn-btn inv-bulk"
        title="Salvage many items at once"
        onClick={() => askBulkSalvage(hero)}
      >
        Salvage…
      </button>
    </div>
  );
}

function ItemTile({
  session,
  it,
  index,
  onTab,
}: {
  session: Session;
  it: Item;
  index: number;
  onTab(id: MenuId): void;
}) {
  const d = itemDescription(it);
  const info = upgradeOf(session, it);
  const sockets = Array.from({ length: socketsOf(it) }, (_, i) => it.fused[i] != null);
  const verdictText =
    info.verdict === 'up' ? ', upgrade' : info.verdict === 'down' ? ', worse than what you wear' : '';
  const equipIt = () => equip(session, it);
  return (
    <div class="inv-tilewrap">
      <button
        type="button"
        class={`inv-tile r-${it.rarity}${it.locked ? ' kept' : ''}`}
        data-uid={it.uid}
        tabIndex={index === 0 ? 0 : -1}
        draggable
        aria-label={`${d.name}, ${it.rarity} ${d.base}, item level ${it.itemLevel}${verdictText}${it.locked ? ', kept' : ''}`}
        onClick={(e) => {
          if (e.detail === 0) refocus = index;
          if (e.shiftKey) return quickSalvage(session, it);
          if (e.ctrlKey || e.metaKey) return sendToBench(it, onTab);
          equipIt();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          // Ctrl-click is a context click on a Mac: keep it for the bench.
          if (e.ctrlKey && e.button === 0) return sendToBench(it, onTab);
          equipIt();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            refocus = index;
            askSalvage(it);
          } else if ((e.key === 'k' || e.key === 'K') && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            toggleLock(session, it);
          }
        }}
        onDragStart={(e) => startDrag(e, { kind: 'item', uid: it.uid, from: null })}
        onDragEnd={() => (dragging.value = null)}
        {...itemTipProps(session, it, false)}
      >
        <span class="inv-art">
          <ItemArt item={it} size="md" />
        </span>
        <span class="inv-lv" aria-hidden="true">
          {it.itemLevel}
        </span>
        <Pips sockets={sockets} />
        <span class="inv-mark">
          <Arrow verdict={info.verdict} />
        </span>
      </button>
      <button
        type="button"
        class={`inv-lock${it.locked ? ' on' : ''}`}
        tabIndex={-1}
        aria-pressed={!!it.locked}
        aria-label={`${it.locked ? 'Unlock' : 'Keep'} ${d.name}`}
        title={it.locked ? 'Kept: salvage skips it. Click to unlock (K)' : 'Keep: salvage skips it (K)'}
        onClick={() => toggleLock(session, it)}
      >
        <Padlock locked={!!it.locked} />
      </button>
    </div>
  );
}

function onGridKey(e: JSX.TargetedKeyboardEvent<HTMLDivElement>): void {
  const grid = e.currentTarget;
  const tiles = [...grid.querySelectorAll<HTMLElement>('.inv-tile')];
  const from = tiles.indexOf(e.target as HTMLElement);
  if (from < 0) return;
  const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  const to = nextIndex(from, tiles.length, cols, e.key);
  if (to === null) return;
  e.preventDefault();
  tiles[to]?.focus();
}

/** One tab stop for the whole grid: the focused tile is the one Tab returns to. */
function onGridFocus(e: JSX.TargetedFocusEvent<HTMLDivElement>): void {
  const t = e.target as HTMLElement;
  if (!t.classList.contains('inv-tile')) return;
  for (const el of e.currentTarget.querySelectorAll<HTMLElement>('.inv-tile'))
    el.tabIndex = el === t ? 0 : -1;
}

/** The hovered or focused item's name, or the shortcuts. */
function StatusLine({ session, hero }: { session: Session; hero: Readonly<HeroState> }) {
  const uid = previewUid.value;
  const it = uid === null ? null : hero.items.find((i) => i.uid === uid);
  if (!it)
    return (
      <p class="mn-help inv-status">
        Click or right-click: equip · Shift-click: salvage · Ctrl-click: craft · K: keep · drag to a slot
      </p>
    );
  const d = itemDescription(it);
  const v = upgradeOf(session, it).verdict;
  return (
    <p class="inv-status">
      <b class={`r-${it.rarity}`}>{d.name}</b>
      <span>
        {d.name !== d.base ? `${d.base} · ` : ''}item level {it.itemLevel}
        {it.locked ? ' · kept' : ''}
      </span>
      {v !== 'same' ? <em class={v}>{v === 'up' ? 'upgrade' : 'worse'}</em> : null}
    </p>
  );
}

export function ItemsTab({
  session,
  hero,
  onTab,
}: {
  session: Session;
  hero: Readonly<HeroState>;
  rev: number;
  onTab(id: MenuId): void;
}) {
  const prefs = bagPrefs.value;
  const ref = useRef<HTMLDivElement>(null);
  const all = unwornItems(hero);
  const list = viewItems(all, prefs, { kindOf, isUpgrade: (it) => upgradeOf(session, it).verdict === 'up' });
  useLayoutEffect(() => {
    if (refocus === null || !ref.current) return;
    const tiles = ref.current.querySelectorAll<HTMLElement>('.inv-tile');
    tiles[Math.min(refocus, tiles.length - 1)]?.focus();
    refocus = null;
  });
  return (
    <>
      {all.length > 0 ? <Toolbar hero={hero} shown={list.length} total={all.length} /> : null}
      <div class="mn-scroll">
        {all.length === 0 ? (
          <div class="inv-empty">
            <b>No items yet</b>
            <span>Enemies and chests drop gear. It shows up here.</span>
          </div>
        ) : list.length === 0 ? (
          <div class="inv-empty">
            <b>Nothing matches</b>
            <span>
              {filtersActive(prefs) ? 'These filters hide every item in your bag.' : 'Nothing to show.'}
            </span>
            <button type="button" class="mn-btn" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        ) : (
          <div
            class="inv-tiles"
            ref={ref}
            onKeyDown={onGridKey}
            onFocusIn={onGridFocus}
            role="group"
            aria-label="Items"
          >
            {list.map((it, i) => (
              <ItemTile key={it.uid} session={session} it={it} index={i} onTab={onTab} />
            ))}
          </div>
        )}
      </div>
      <StatusLine session={session} hero={hero} />
    </>
  );
}
