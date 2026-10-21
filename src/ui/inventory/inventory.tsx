/**
 * Inventory and character screen (I): equipment and Fuse on the left, the bag in the middle, the
 * character sheet on the right. Every action is a HeroEdit through heroAdapter.sendEdit.
 */
import type { Session } from '../../app/session';
import { UNFUSE_KEEP_COST } from '../../app/hero';
import { Icon } from '../adventure/icons';
import { heroOf, heroRev, modsOf } from '../heroAdapter';
import { Dialog, MenuFrame, type MenuId } from '../menus/frame';
import { pointsOf } from '../tree/adapter';
import { partName } from './adapter';
import { Bag } from './bag';
import { Equipment, FusePanel } from './equipment';
import { injectInvStyle } from './invStyle';
import { invDialog, keepProblem, salvage, salvageHidden, unfuse } from './slots';
import { statRows, type StatGroup } from './stats';

const GROUPS: StatGroup[] = ['Vitals', 'Offense', 'Weaving', 'Defense', 'Ailments & terrain'];

function Sheet({ session }: { session: Session; rev: number }) {
  const hero = heroOf(session);
  const rows = statRows(hero, modsOf(session), session.state.tuning);
  const pts = pointsOf(hero);
  const mods = modsOf(session);
  return (
    <section class="mn-panel inv-sheet" aria-label="Character sheet">
      <h3>
        Level {hero.level}{' '}
        <small>
          {pts.free > 0 ? `${pts.free} passive point${pts.free === 1 ? '' : 's'} (P)` : 'Loomwright'}
        </small>
      </h3>
      <div class="inv-wallet">
        <span title="Thread Scrap: unfusing and respecs">
          <Icon kind="scrap" /> <b>{hero.threadScrap}</b> Scrap
        </span>
        <span title="Heart Seeds: +8 maximum life each">
          <Icon kind="heart" /> <b>{hero.heartSeeds}</b> Seeds
        </span>
        <span title="Loom Shards: +1 Capacity each">
          <Icon kind="shard" /> <b>{hero.loomShards}</b> Shards
        </span>
      </div>
      <div class="mn-scroll">
        {GROUPS.map((g) => {
          const list = rows.filter((r) => r.group === g);
          if (list.length === 0) return null;
          return (
            <div class="inv-group" key={g}>
              <h4>{g}</h4>
              {list.map((r) => (
                <div class="inv-kv" key={r.key}>
                  <span>{r.label}</span>
                  <b>{r.text}</b>
                </div>
              ))}
            </div>
          );
        })}
        {mods.keystones.length ? (
          <div class="inv-group">
            <h4>Keystones</h4>
            {mods.keystones.map((k) => (
              <div class="inv-kv" key={k}>
                <span>{k}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Dialogs({ session }: { session: Session }) {
  const d = invDialog.value;
  if (!d) return null;
  const cancel = () => (invDialog.value = null);
  if (d.kind === 'salvageHidden')
    return (
      <Dialog
        title={`Salvage ${d.uids.length} hidden item${d.uids.length === 1 ? '' : 's'}?`}
        onCancel={cancel}
      >
        <p>
          Every unequipped item your loot filter (L) hides is destroyed for <b>{d.value} Thread Scrap</b>.
        </p>
        <div class="mn-acts">
          <button type="button" class="mn-btn" onClick={cancel}>
            Keep them
          </button>
          <button type="button" class="mn-btn danger" onClick={() => salvageHidden(session, d.uids)}>
            Salvage all
          </button>
        </div>
      </Dialog>
    );
  if (d.kind === 'salvage')
    return (
      <Dialog title={`Salvage ${d.name}?`} onCancel={cancel}>
        <p>
          It is destroyed for <b>{d.value} Thread Scrap</b>.
        </p>
        <div class="mn-acts">
          <button type="button" class="mn-btn" onClick={cancel}>
            Keep it
          </button>
          <button type="button" class="mn-btn danger" onClick={() => salvage(session, d.uid)}>
            Salvage
          </button>
        </div>
      </Dialog>
    );
  const hero = heroOf(session);
  const why = keepProblem(hero.threadScrap);
  return (
    <Dialog title={`Unfuse ${partName(d.part)}?`} onCancel={cancel}>
      <p>Take the part out of its socket. Without paying, the part is destroyed.</p>
      <div class="mn-acts">
        <button type="button" class="mn-btn" onClick={cancel}>
          Cancel
        </button>
        <button
          type="button"
          class="mn-btn danger"
          onClick={() => unfuse(session, d.spindleUid, d.socket, false)}
        >
          Destroy it
        </button>
        <button
          type="button"
          class="mn-btn gold"
          disabled={why !== null}
          title={why ?? undefined}
          onClick={() => unfuse(session, d.spindleUid, d.socket, true)}
        >
          Keep it ({UNFUSE_KEEP_COST} Thread Scrap)
        </button>
      </div>
      {why ? <p class="mn-why">{why}.</p> : null}
    </Dialog>
  );
}

export function InventoryScreen(p: { session: Session; onTab(id: MenuId): void; onClose(): void }) {
  injectInvStyle();
  // Passed down as `rev`: the hero is mutated in place, and @preact/signals skips children whose
  // props are shallowly equal, so without it the panels would keep showing the old hero.
  const rev = heroRev.value;
  const hero = heroOf(p.session);
  return (
    <MenuFrame id="inventory" title="Character" onTab={p.onTab} onClose={p.onClose} bodyClass="inv-body">
      <section class="mn-panel inv-left" aria-label="Equipment">
        <h3>Equipped</h3>
        <div class="mn-scroll">
          <Equipment session={p.session} hero={hero} rev={rev} />
          <FusePanel session={p.session} hero={hero} rev={rev} />
        </div>
      </section>
      <Bag session={p.session} hero={hero} rev={rev} />
      <Sheet session={p.session} rev={rev} />
      <Dialogs session={p.session} />
    </MenuFrame>
  );
}
