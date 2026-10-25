/** The bench's wallet: each currency with its picture, count and one-line rule; Thread Scrap; the way to the Spindlewright. */
import type { Session } from '../../app/session';
import { currencies, type CurrencyId } from '../../../data/currency';
import { spindlewrightPrices } from '../../../data/hearth';
import type { HeroState } from '../../sim/hero/types';
import { Icon } from '../adventure/icons';
import { hearthTab } from '../hearth/hearthSignals';
import { readHearthSummary } from '../hearth/adapter';
import { CurrencyArt } from '../items/itemArt';
import { tipFor, type MenuId } from '../menus/frame';
import { wallet } from './craftModel';
import { currencyTip, shortRule } from './craftRules';
import { chooseCurrency, craftArmed, craftCurrency } from './craftState';

export function CurrencyTip({ id }: { id: CurrencyId }) {
  const t = currencyTip(id);
  return (
    <>
      <h4>{t.name}</h4>
      <ul class="cr-tip-lines">
        {t.lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </>
  );
}

/** Opens the Hearth menu on the Spindlewright's tab. */
export function openSpindlewright(onTab: (id: MenuId) => void): void {
  hearthTab.value = 'spindlewright';
  onTab('hearth');
}

/** "Buy from the Spindlewright": a button at the Hearth, a hint elsewhere once it is lit. */
export function BuyFromSpindlewright(p: { session: Session; hero: Readonly<HeroState>; currency: CurrencyId; onTab(id: MenuId): void; /** The bench shows its own copy on the narrow layout when the stack is empty. */ twin?: boolean }) {
  const hearth = readHearthSummary(p.session);
  if (!hearth.lit) return null;
  const cls = `cr-buy${p.twin ? ' twin' : ''}`;
  if (!hearth.inHearth)
    return (
      <div class={cls}>
        <p class="cr-hint">The Spindlewright sells these for Thread Scrap at the Hearth.</p>
      </div>
    );
  const price = spindlewrightPrices[p.currency];
  const poor = p.hero.threadScrap < price;
  return (
    <div class={cls}>
      <button type="button" class={`mn-btn${poor ? '' : ' gold'}`} onClick={() => openSpindlewright(p.onTab)}>
        Buy from the Spindlewright
      </button>
      <p class="cr-hint">
        {currencies[p.currency].name}: {price} Thread Scrap{poor ? ` (you have ${p.hero.threadScrap})` : ''}
      </p>
    </div>
  );
}

export function Wallet(p: { session: Session; hero: Readonly<HeroState>; rev: number; onTab(id: MenuId): void }) {
  const cur = craftCurrency.value;
  const armed = craftArmed.value;
  return (
    <section class="mn-panel cr-wallet" aria-label="Currency">
      <h3>
        Currency
        <small class="cr-scrap" title="Thread Scrap">
          <Icon kind="scrap" /> {p.hero.threadScrap} Scrap
        </small>
      </h3>
      <div class="mn-scroll cr-list" role="listbox" aria-label="Currency">
        {wallet(p.hero).map(({ id, count }) => {
          const sel = armed && id === cur;
          return (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={sel}
              class={`cr-cur${sel ? ' sel' : ''}${!armed && id === cur ? ' cur' : ''}${count === 0 ? ' none' : ''}`}
              onClick={() => chooseCurrency(id)}
              {...tipFor(undefined, () => <CurrencyTip id={id} />)}
            >
              <span class="cr-art">
                <CurrencyArt currency={id} size="sm" />
              </span>
              <span class="cr-text">
                <b>{currencies[id].name}</b>
                <small>{shortRule[id]}</small>
              </span>
              <span class="cr-count">×{count}</span>
            </button>
          );
        })}
      </div>
      <BuyFromSpindlewright session={p.session} hero={p.hero} currency={cur} onTab={p.onTab} twin={(p.hero.currency[cur] ?? 0) === 0} />
    </section>
  );
}
