/**
 * The crafting bench (C, M5; DESIGN §8.5, reworked in M7.5): pick a currency in the wallet, then
 * click items (or runes, for Rune Polish) to use it, one click each. The bench shows the item's
 * affixes with tiers and ranges and, after every craft, what changed. Every use is a 'craft'
 * HeroEdit through heroAdapter.sendEdit. The R key repeats the last craft.
 */
import { useEffect } from 'preact/hooks';
import type { Session } from '../../app/session';
import { heroOf, heroRev } from '../heroAdapter';
import { MenuFrame, type MenuId } from '../menus/frame';
import { Bench } from './benchPanel';
import { ConfirmDialog } from './confirmDialog';
import { craftPending, craftTab, craftTarget, repeatCraft, resetBench } from './craftState';
import { injectCraftStyle } from './craftStyle';
import { ItemList } from './itemList';
import { Wallet } from './walletPanel';

export { craftCurrency, craftTarget } from './craftState';
export { CurrencyGlyph } from '../items/currencyGlyph';

const isTyping = (t: EventTarget | null): boolean =>
  t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;

export function CraftScreen(p: { session: Session; onTab(id: MenuId): void; onClose(): void }) {
  injectCraftStyle();
  // Passed down as `rev` (see InventoryScreen): the hero is mutated in place.
  const rev = heroRev.value;
  const hero = heroOf(p.session);
  useEffect(() => {
    // Coming from the bag with an item selected: show the Items tab for it.
    const uid = craftTarget.peek();
    if (uid !== null) craftTab.value = heroOf(p.session).runes.some((r) => r.uid === uid) ? 'runes' : 'items';
    // R repeats the last craft. Caught before other listeners so the lab's R keys and the
    // game's Cast5 never see it while the bench is open.
    const onKey = (e: KeyboardEvent): void => {
      if (e.code !== 'KeyR' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!craftPending.peek()) repeatCraft(p.session);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      resetBench();
    };
  }, [p.session]);
  return (
    <MenuFrame id="craft" title="Crafting Bench" onTab={p.onTab} onClose={p.onClose} bodyClass="cr-body" rootClass="cr-root">
      <Wallet session={p.session} hero={hero} rev={rev} onTab={p.onTab} />
      <ItemList session={p.session} hero={hero} rev={rev} />
      <Bench session={p.session} hero={hero} rev={rev} onTab={p.onTab} />
      <ConfirmDialog session={p.session} />
    </MenuFrame>
  );
}
