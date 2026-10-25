/** The bag: unequipped items, Fuse parts and the rune pouch, as tabs of tiles (M7.5). */
import { signal } from '@preact/signals';
import { lootFilter } from '../../app/lootFilterStore';
import type { Session } from '../../app/session';
import type { HeroState } from '../../sim/hero/types';
import type { MenuId } from '../menus/frame';
import { PartsTab, RunesTab } from './bagOther';
import { ItemsTab } from './bagItems';
import { dropTarget } from './equipment';
import { unwornItems } from './invModel';
import { askBulkSalvage, dragging, hiddenInBag, unequip } from './slots';

export type BagTab = 'items' | 'parts' | 'runes';
export const bagTab = signal<BagTab>('items');

const TAB_LABEL: Record<BagTab, string> = { items: 'Items', parts: 'Fuse parts', runes: 'Rune pouch' };

const HELP: Record<Exclude<BagTab, 'items'>, string> = {
  parts: 'Click a part to fuse it into your spindle, or drag it onto a socket.',
  runes: 'Each rune sits in one weave at a time. Weave them in the Loom (Tab).',
};

/** The loot filter hides these items: one click opens the bulk salvage for them. */
function HiddenBar({ hero }: { hero: Readonly<HeroState>; rev: number }) {
  void lootFilter.value; // re-render when the filter changes
  const n = hiddenInBag(hero).length;
  if (n === 0) return null;
  return (
    <div class="inv-hidden">
      <span>
        Your loot filter (L) hides {n} item{n === 1 ? '' : 's'} here.
      </span>
      <button type="button" class="mn-btn" onClick={() => askBulkSalvage(hero, 'hidden')}>
        Salvage hidden
      </button>
    </div>
  );
}

export function Bag(p: {
  session: Session;
  hero: Readonly<HeroState>;
  rev: number;
  onTab(id: MenuId): void;
}) {
  const { session, hero, rev } = p;
  const tab = bagTab.value;
  const counts: Record<BagTab, number> = {
    items: unwornItems(hero).length,
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
        (d) => d.kind === 'item' && d.from !== null,
        (d) => d.kind === 'item' && d.from && unequip(session, d.from),
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
            {TAB_LABEL[t]} <kbd>{counts[t]}</kbd>
          </button>
        ))}
      </div>
      {tab === 'items' ? (
        <ItemsTab session={session} hero={hero} rev={rev} onTab={p.onTab} />
      ) : (
        <div class="mn-scroll">
          {tab === 'parts' ? <PartsTab session={session} hero={hero} rev={rev} /> : null}
          {tab === 'runes' ? <RunesTab session={session} hero={hero} rev={rev} /> : null}
        </div>
      )}
      {tab === 'items' ? <HiddenBar hero={hero} rev={rev} /> : null}
      {tab !== 'items' ? <p class="mn-help">{HELP[tab]}</p> : null}
    </section>
  );
}
