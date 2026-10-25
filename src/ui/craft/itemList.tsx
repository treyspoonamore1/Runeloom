/**
 * The bench's list of what to craft on: items (equipped first, marked) or runes (for Rune
 * Polish), with slot and rarity chips, a name search, and dimmed cards that say why they can't
 * take the picked currency. Clicking a card selects it and, with a currency picked, uses it.
 */
import type { Session } from '../../app/session';
import { currencies } from '../../../data/currency';
import type { HeroState } from '../../sim/hero/types';
import { ItemArt } from '../items/itemArt';
import { Padlock } from '../inventory/badges';
import { RuneMedal } from './runeMedal';
import { tipFor } from '../menus/frame';
import {
  filterEntries,
  isFiltered,
  itemEntries,
  noFilter,
  rarityFilters,
  runeEntries,
  slotFilters,
  slotLabel,
  type Entry,
  type ListFilter,
} from './craftModel';
import { EntryTip } from './craftTips';
import { clickTarget, craftArmed, craftCurrency, craftFilter, craftTab, craftTarget } from './craftState';

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

function Card({ session, hero, e, armed }: { session: Session; hero: Readonly<HeroState>; e: Entry; armed: boolean }) {
  const sel = craftTarget.value === e.uid;
  const state = armed ? (e.problem ? ' no' : ' ok') : '';
  const label = `${e.name}${armed && e.problem ? `: ${e.problem}` : ''}`;
  const rarity = e.kind === 'item' ? e.item.rarity : 'normal';
  return (
    <button
      type="button"
      class={`cr-item r-${rarity}${state}${sel ? ' sel' : ''}`}
      aria-pressed={sel}
      aria-label={label}
      onClick={() => clickTarget(session, e.uid)}
      {...tipFor(rarity, () => <EntryTip hero={hero} entry={e} armed={armed} />)}
    >
      <span class="cr-art">
        {e.kind === 'item' ? <ItemArt item={e.item} size="sm" /> : <RuneMedal id={e.rune.rune} />}
      </span>
      <span class="cr-text">
        <span class="cr-nameline">
          <b>{e.name}</b>
          {e.kind === 'item' && e.item.locked ? (
            <span class="cr-lock" title="Kept: salvage skips it. You can still craft on it">
              <Padlock locked />
            </span>
          ) : null}
          {e.kind === 'item' && e.equipped ? <span class="cr-eq">Equipped</span> : null}
        </span>
        {armed && e.reason ? (
          <small>{e.reason}</small>
        ) : e.kind === 'item' ? (
          <small>
            {e.name !== e.base ? `${e.base} · ` : ''}ilvl {e.item.itemLevel}
            {e.item.rarity === 'unique' ? '' : ` · ${e.item.affixes.length} affix${e.item.affixes.length === 1 ? '' : 'es'}`}
          </small>
        ) : (
          <small>
            Level {e.rune.level} · Quality {e.rune.quality}%
          </small>
        )}
      </span>
    </button>
  );
}

function Chips<T extends string>(p: { label: string; values: readonly T[]; value: T; text(v: T): string; onPick(v: T): void }) {
  return (
    <div class="cr-chips" role="group" aria-label={p.label}>
      {p.values.map((v) => (
        <button key={v} type="button" class="cr-chip" aria-pressed={p.value === v} onClick={() => p.onPick(v)}>
          {p.text(v)}
        </button>
      ))}
    </div>
  );
}

export function ItemList({ session, hero }: { session: Session; hero: Readonly<HeroState>; rev: number }) {
  const cur = craftCurrency.value;
  const armed = craftArmed.value;
  const tab = craftTab.value;
  const f = craftFilter.value;
  const set = (patch: Partial<ListFilter>) => (craftFilter.value = { ...f, ...patch });
  const items = itemEntries(hero, cur);
  const runes = runeEntries(hero, cur);
  const all: Entry[] = tab === 'items' ? items : runes;
  const shown = filterEntries(all, f);
  const usable = all.filter((e) => e.problem === null).length;
  const rune = currencies[cur].target === 'rune';
  return (
    <section class="mn-panel cr-targets" aria-label="Things to craft on">
      <div class="cr-tabs" role="tablist" aria-label="What to craft on">
        <button type="button" role="tab" class="cr-tab" aria-selected={tab === 'items'} onClick={() => (craftTab.value = 'items')}>
          Items<small>{items.length}</small>
        </button>
        <button type="button" role="tab" class="cr-tab" aria-selected={tab === 'runes'} onClick={() => (craftTab.value = 'runes')}>
          Runes<small>{runes.length}</small>
        </button>
      </div>
      <p class={`cr-banner${armed ? ' armed' : ''}`} role="status">
        {armed
          ? `Click to use ${currencies[cur].name}: ${usable} of ${all.length} can take it`
          : 'Pick a currency, then click what to use it on'}
      </p>
      <input
        class="cr-search"
        type="search"
        placeholder={tab === 'items' ? 'Search items by name' : 'Search runes by name'}
        aria-label="Search by name"
        value={f.search}
        onInput={(e) => set({ search: (e.currentTarget as HTMLInputElement).value })}
      />
      {tab === 'items' ? (
        <>
          <Chips label="Slot" values={slotFilters} value={f.slot} text={(v) => slotLabel[v]} onPick={(slot) => set({ slot })} />
          <Chips label="Rarity" values={rarityFilters} value={f.rarity} text={(v) => (v === 'all' ? 'All' : cap(v))} onPick={(rarity) => set({ rarity })} />
        </>
      ) : null}
      <div class="cr-chips">
        {armed ? (
          <button type="button" class="cr-chip" aria-pressed={f.usableOnly} onClick={() => set({ usableOnly: !f.usableOnly })}>
            Only what it can use
          </button>
        ) : null}
        {isFiltered(f) ? (
          <button type="button" class="cr-chip clear" onClick={() => (craftFilter.value = noFilter)}>
            Clear filters
          </button>
        ) : null}
      </div>
      <div class="mn-scroll">
        {shown.length === 0 ? (
          <p class="mn-muted cr-empty">
            {all.length === 0
              ? tab === 'items'
                ? 'No gear yet. Items you pick up show up here.'
                : 'No runes yet. Runes you find show up here.'
              : 'Nothing matches these filters.'}
            {all.length > 0 && isFiltered(f) ? (
              <>
                <br />
                <button type="button" class="mn-btn" onClick={() => (craftFilter.value = noFilter)}>
                  Clear filters
                </button>
              </>
            ) : null}
          </p>
        ) : null}
        {tab === 'items' && rune && armed ? (
          <p class="cr-hint">Rune Polish works on runes: switch to the Runes tab.</p>
        ) : null}
        <div class="cr-grid">
          {shown.map((e) => (
            <Card key={e.uid} session={session} hero={hero} e={e} armed={armed} />
          ))}
        </div>
      </div>
    </section>
  );
}
