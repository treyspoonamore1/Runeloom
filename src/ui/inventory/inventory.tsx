/**
 * Inventory and character screen (I): equipment and Fuse on the left, the bag in the middle, the
 * character sheet on the right. Every action is a HeroEdit through heroAdapter.sendEdit.
 */
import type { Session } from '../../app/session';
import { heroOf, heroRev } from '../heroAdapter';
import { MenuFrame, type MenuId } from '../menus/frame';
import { Bag } from './bag';
import { Equipment } from './equipment';
import { FusePanel } from './fusePanel';
import { Dialogs } from './invDialogs';
import { injectInvStyle } from './invStyle';
import { Sheet } from './sheet';

export function InventoryScreen(p: { session: Session; onTab(id: MenuId): void; onClose(): void }) {
  injectInvStyle();
  // Passed down as `rev`: the hero is mutated in place, and @preact/signals skips children whose
  // props are shallowly equal, so without it the panels would keep showing the old hero.
  const rev = heroRev.value;
  const hero = heroOf(p.session);
  return (
    <MenuFrame
      id="inventory"
      title="Character"
      onTab={p.onTab}
      onClose={p.onClose}
      bodyClass="inv-body"
      rootClass="inv-root"
    >
      <section class="mn-panel inv-left" aria-label="Equipment">
        <h3>Equipped</h3>
        <div class="mn-scroll">
          <Equipment session={p.session} hero={hero} rev={rev} />
          <FusePanel session={p.session} hero={hero} rev={rev} />
        </div>
      </section>
      <Bag session={p.session} hero={hero} rev={rev} onTab={p.onTab} />
      <Sheet session={p.session} rev={rev} onTab={p.onTab} />
      <Dialogs session={p.session} />
    </MenuFrame>
  );
}
