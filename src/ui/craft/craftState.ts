/**
 * The bench's state and actions: the selected currency and target, the list filter, the last
 * craft and its before/after, and the confirmation a Rare asks for. Every craft is a 'craft'
 * HeroEdit through heroAdapter.sendEdit, so replays and saves cover it.
 *
 * `craftCurrency` and `craftTarget` are read by other menus (the bag's Ctrl-click sets them and
 * switches to this tab); their names and types are a contract.
 */
import { signal } from '@preact/signals';
import type { Session } from '../../app/session';
import { currencies, type CurrencyId } from '../../../data/currency';
import { heroOf, sendEdit } from '../heroAdapter';
import { itemDescription } from '../inventory/adapter';
import { note } from '../menus/frame';
import { buildResult, snapshotOf, type CraftResult } from './craftDiff';
import { noFilter, problemFor, repeatState, type LastUse, type ListFilter } from './craftModel';
import { confirmReason } from './craftRules';

export const craftCurrency = signal<CurrencyId>('weavers_knot');
export const craftTarget = signal<number | null>(null);
/**
 * True once a currency was picked in the bench: clicking an item then uses it at once. Until
 * then a click only selects, so opening the bench can't spend the default currency by accident.
 */
export const craftArmed = signal(false);
export const craftTab = signal<'items' | 'runes'>('items');
export const craftFilter = signal<ListFilter>(noFilter);
export const craftLast = signal<LastUse | null>(null);
export const craftResult = signal<CraftResult | null>(null);

/** A craft waiting for its confirmation. */
export interface PendingCraft {
  uid: number;
  currency: CurrencyId;
  name: string;
  why: string;
}
export const craftPending = signal<PendingCraft | null>(null);
/** "Don't ask again this session": until the page reloads, nothing asks. */
export const craftSkipConfirm = signal(false);

/** Items already confirmed once, per hero (a new game or a loaded save is a new hero object). */
const seen = new WeakMap<object, Set<number>>();
const seenSet = (hero: object): Set<number> => {
  let s = seen.get(hero);
  if (!s) seen.set(hero, (s = new Set()));
  return s;
};

let resultCount = 0;

/** Picks a currency and arms it; picking the armed one again puts it away. */
export function chooseCurrency(id: CurrencyId): void {
  if (craftArmed.value && craftCurrency.value === id) {
    craftArmed.value = false;
    return;
  }
  craftCurrency.value = id;
  craftArmed.value = true;
  craftTab.value = currencies[id].target === 'rune' ? 'runes' : 'items';
}

/** A click on a card: select it, and use the armed currency on it when that applies. */
export function clickTarget(session: Session, uid: number): void {
  craftTarget.value = uid;
  if (craftArmed.value) spendCurrency(session, craftCurrency.value, uid);
}

/** Uses `currency` on `uid`, asking first when that is due. Refusals show as a note. */
export function spendCurrency(session: Session, currency: CurrencyId, uid: number): void {
  const hero = heroOf(session);
  const problem = problemFor(hero, currency, uid);
  if (problem) return note(problem);
  if ((hero.currency[currency] ?? 0) <= 0) return note(`You have no ${currencies[currency].name}`);
  const item = hero.items.find((x) => x.uid === uid);
  if (item && !craftSkipConfirm.value) {
    const why = confirmReason(item.rarity, currency, seenSet(hero).has(uid));
    if (why) {
      craftPending.value = { uid, currency, name: itemDescription(item).name, why };
      return;
    }
  }
  perform(session, currency, uid);
}

function perform(session: Session, currency: CurrencyId, uid: number): void {
  const hero = heroOf(session);
  const before = snapshotOf(hero, uid);
  const err = sendEdit(session, { kind: 'craft', currency, uid });
  if (err) return note(err);
  seenSet(hero).add(uid);
  craftLast.value = { currency, uid };
  const after = snapshotOf(heroOf(session), uid);
  if (before && after) craftResult.value = buildResult(++resultCount, currency, before, after);
  craftTarget.value = uid;
}

/** Confirms the waiting craft. `dontAsk` stops every later confirmation this session. */
export function confirmPending(session: Session, dontAsk: boolean): void {
  const p = craftPending.value;
  craftPending.value = null;
  if (dontAsk) craftSkipConfirm.value = true;
  if (p) perform(session, p.currency, p.uid);
}

export function cancelPending(): void {
  craftPending.value = null;
}

/** Repeats the last currency on the last item (the Use again button and the R key). */
export function repeatCraft(session: Session): void {
  const last = craftLast.value;
  const state = repeatState(heroOf(session), last);
  if (!state.ok || !last) return note(state.why ?? 'Nothing to repeat yet');
  craftCurrency.value = last.currency;
  craftTarget.value = last.uid;
  spendCurrency(session, last.currency, last.uid);
}

/** Leaving the bench puts the currency away, so the next visit starts safe. */
export function resetBench(): void {
  craftArmed.value = false;
  craftPending.value = null;
}
