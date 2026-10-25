/**
 * The bench's right column: the picked currency, the selected item or rune with its affixes, the
 * use buttons, and the last craft's before and after (kept until the next craft).
 */
import type { Session } from '../../app/session';
import { affixCounts } from '../../../data/affixes';
import { currencies } from '../../../data/currency';
import type { HeroState, Item, RuneItem } from '../../sim/hero/types';
import { itemDescription } from '../inventory/adapter';
import { CurrencyArt, ItemArt } from '../items/itemArt';
import type { MenuId } from '../menus/frame';
import { AffixRows } from './affixRows';
import { BuyFromSpindlewright } from './walletPanel';
import { snapshotOf, type CraftResult } from './craftDiff';
import { problemFor, repeatState } from './craftModel';
import { shortRule } from './craftRules';
import { RuneMedal } from './runeMedal';
import {
  craftArmed,
  craftCurrency,
  craftLast,
  craftResult,
  craftTarget,
  repeatCraft,
  spendCurrency,
} from './craftState';

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** "Prefixes 2/3 · Suffixes 1/3" for a Magic or Rare item. */
function sideCounts(item: Item, lines: ReturnType<typeof snapshotOf>): string | null {
  if (item.rarity !== 'magic' && item.rarity !== 'rare') return null;
  const max = affixCounts[item.rarity];
  const p = lines?.lines.filter((l) => l.side === 'prefix').length ?? 0;
  const s = lines?.lines.filter((l) => l.side === 'suffix').length ?? 0;
  return `Prefixes ${p}/${max.prefixes} · Suffixes ${s}/${max.suffixes}`;
}

function Using({ hero, session, onTab }: { hero: Readonly<HeroState>; session: Session; onTab(id: MenuId): void }) {
  const cur = craftCurrency.value;
  const armed = craftArmed.value;
  const count = hero.currency[cur] ?? 0;
  return (
    <>
      <div class="cr-using">
        <span class="cr-art">
          <CurrencyArt currency={cur} size="sm" />
        </span>
        <span class="cr-text">
          <b>
            {currencies[cur].name} <small>×{count}</small>
          </b>
          <small>{armed ? currencies[cur].text : `${shortRule[cur]}. Pick it in the wallet to use it.`}</small>
        </span>
      </div>
      {count === 0 ? <BuyFromSpindlewright session={session} hero={hero} currency={cur} onTab={onTab} /> : null}
    </>
  );
}

function Selected({ item, rune, hero, hideLines, armed }: { item?: Item; rune?: RuneItem; hero: Readonly<HeroState>; hideLines: boolean; armed: boolean }) {
  if (item) {
    const d = itemDescription(item);
    const snap = snapshotOf(hero, item.uid);
    const affixTexts = new Set((snap?.lines ?? []).map((l) => l.text));
    const extra = d.lines.filter((l) => !affixTexts.has(l));
    const sides = sideCounts(item, snap);
    return (
      <>
        <div class={`cr-head r-${item.rarity}`}>
          <span class="cr-art lg">
            <ItemArt item={item} size="lg" />
          </span>
          <div>
            <h4 class="cr-name">{d.name}</h4>
            <p class="cr-meta">
              {d.name !== d.base ? `${d.base} · ` : ''}
              {cap(item.rarity)} · item level {item.itemLevel}
            </p>
            {sides ? <p class="cr-meta">{sides}</p> : null}
          </div>
        </div>
        {extra.length > 0 ? (
          <ul class="cr-lines">
            {extra.map((l, i) => (
              <li key={i}>
                <span class="cr-txt">{l}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {hideLines ? null : snap && snap.lines.length > 0 ? (
          <AffixRows lines={snap.lines.map((line) => ({ line, mark: 'same' }))} />
        ) : item.rarity === 'unique' ? (
          <p class="mn-muted">Uniques have fixed stats and can’t be changed.</p>
        ) : (
          <p class="mn-muted">{item.rarity === 'normal' ? 'A Normal item has no affixes.' : 'No affixes left.'}</p>
        )}
      </>
    );
  }
  if (rune) {
    const snap = snapshotOf(hero, rune.uid);
    return (
      <>
        <div class="cr-head">
          <span class="cr-art lg">
            <RuneMedal id={rune.rune} />
          </span>
          <div>
            <h4 class="cr-name">{snap?.name}</h4>
            <p class="cr-meta">
              Level {rune.level} · Quality {rune.quality}%
            </p>
          </div>
        </div>
        {hideLines ? null : <AffixRows lines={(snap?.lines ?? []).map((line) => ({ line, mark: 'same' }))} />}
      </>
    );
  }
  return (
    <p class="mn-muted">
      {armed
        ? 'Click an item in the list to use it on that item. Hover an item to read its affixes first.'
        : 'Pick a currency in the wallet, then click an item to use it. Until then a click only selects an item and shows it here.'}
    </p>
  );
}

function ResultCard({ r }: { r: CraftResult }) {
  const renamed = r.before.name !== r.after.name;
  return (
    <div class="cr-result" aria-live="polite">
      <h4>Last craft</h4>
      <p class="cr-outcome">{r.outcome}</p>
      <p class="cr-rename">
        {currencies[r.currency].name} on {renamed ? `${r.before.name} → ${r.after.name}` : r.after.name}
      </p>
      <div class="cr-cols">
        <div>
          <h5>Before</h5>
          <AffixRows lines={r.diff.before} ranges="none" />
          {r.diff.before.length === 0 ? <p class="mn-muted">None</p> : null}
        </div>
        <div>
          <h5>After</h5>
          <AffixRows lines={r.diff.after} ranges="inline" />
          {r.diff.after.length === 0 ? <p class="mn-muted">None</p> : null}
        </div>
      </div>
    </div>
  );
}

export function Bench(p: { session: Session; hero: Readonly<HeroState>; rev: number; onTab(id: MenuId): void }) {
  const { hero } = p;
  const cur = craftCurrency.value;
  const def = currencies[cur];
  const uid = craftTarget.value;
  const item = uid === null ? undefined : hero.items.find((x) => x.uid === uid);
  const rune = uid === null ? undefined : hero.runes.find((x) => x.uid === uid);
  const selected = item ?? rune;
  const result = craftResult.value;
  const resultHere = result !== null && (selected === undefined || result.uid === selected.uid);
  const count = hero.currency[cur] ?? 0;
  const problem = selected ? problemFor(hero, cur, selected.uid) : null;
  const why = !selected
    ? `Pick ${def.target === 'rune' ? 'a rune' : 'an item'} first`
    : count <= 0
      ? `You have no ${def.name}`
      : problem;
  const again = repeatState(hero, craftLast.value);
  const last = craftLast.value;
  const lastName = last ? (snapshotOf(hero, last.uid)?.name ?? 'that item') : '';
  return (
    <section class="mn-panel cr-bench" aria-label="Bench">
      <h3>Bench</h3>
      <Using hero={hero} session={p.session} onTab={p.onTab} />
      <div class="mn-scroll">
        <Selected item={item} rune={rune} hero={hero} hideLines={resultHere && result?.uid === selected?.uid} armed={craftArmed.value} />
        {result && resultHere ? <ResultCard r={result} /> : null}
        {result && !resultHere ? (
          <p class="cr-past">
            <span>
              Last craft: {result.after.name}, {result.outcome}
            </span>
            <button type="button" class="cr-link" onClick={() => (craftTarget.value = result.uid)}>
              Show
            </button>
          </p>
        ) : null}
      </div>
      <div class="cr-actions">
        <div class="row">
          <button
            type="button"
            class="mn-btn gold"
            disabled={why !== null}
            title={why ?? undefined}
            onClick={() => selected && spendCurrency(p.session, cur, selected.uid)}
          >
            Use {def.name}
          </button>
          <button
            type="button"
            class="mn-btn"
            disabled={!again.ok}
            title={again.ok ? `${currencies[last!.currency].name} on ${lastName}` : (again.why ?? undefined)}
            onClick={() => repeatCraft(p.session)}
          >
            Use again <kbd>R</kbd>
          </button>
        </div>
        {why && selected ? <p class="cr-why">{why}.</p> : null}
        {again.ok && last ? (
          <p class="cr-hint">
            Again: {currencies[last.currency].name} on {lastName}
          </p>
        ) : null}
      </div>
    </section>
  );
}
