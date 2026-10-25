/**
 * The character sheet (right column): level, wallet, crafting currency and every stat. While a
 * bag item is hovered or focused, each stat it would change shows the change in green or red.
 */
import { currencies, currencyIds } from '../../../data/currency';
import type { Session } from '../../app/session';
import { Icon } from '../adventure/icons';
import { heroOf, modsFor, modsOf } from '../heroAdapter';
import { CurrencyArt } from '../items/itemArt';
import { tipFor, type MenuId } from '../menus/frame';
import { pointsOf } from '../tree/adapter';
import { itemDescription } from './adapter';
import { bestSlotFor } from './invModel';
import { previewUid } from './slots';
import { sheetRows, withEquipped, type SheetRow, type StatGroup } from './stats';

const GROUPS: StatGroup[] = ['Vitals', 'Offense', 'Weaving', 'Defense', 'Ailments & terrain'];

function Row({ r }: { r: SheetRow }) {
  return (
    <div class={`inv-kv${r.delta ? (r.delta.good ? ' up' : ' down') : ''}`}>
      <span>{r.label}</span>
      <b>
        {r.text}
        {r.delta ? (
          <i class={`inv-delta ${r.delta.good ? 'good' : 'bad'}`} aria-label={`changes by ${r.delta.text}`}>
            {r.delta.text}
          </i>
        ) : null}
      </b>
    </div>
  );
}

/** Crafting currency in your pouch: the bench (C) spends it. */
function Currency({ session, onTab }: { session: Session; onTab(id: MenuId): void }) {
  const hero = heroOf(session);
  const owned = currencyIds.filter((id) => (hero.currency[id] ?? 0) > 0);
  return (
    <div class="inv-group inv-curs">
      <h4>Crafting currency</h4>
      {owned.length === 0 ? (
        <p class="mn-muted">None yet. Enemies and chests drop it.</p>
      ) : (
        <div class="inv-curgrid">
          {owned.map((id) => (
            <button
              key={id}
              type="button"
              class="inv-cur"
              aria-label={`${currencies[id].name}: ${hero.currency[id]}. ${currencies[id].text}. Click to open the bench`}
              onClick={() => onTab('craft')}
              {...tipFor('normal', () => (
                <>
                  <h4>{currencies[id].name}</h4>
                  <p class="mn-base">{currencies[id].text}</p>
                  <p class="mn-hint">Click to open the crafting bench.</p>
                </>
              ))}
            >
              <span class="inv-art xs">
                <CurrencyArt currency={id} size="sm" />
              </span>
              <b>×{hero.currency[id]}</b>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sheet({ session, onTab }: { session: Session; rev: number; onTab(id: MenuId): void }) {
  const hero = heroOf(session);
  const mods = modsOf(session);
  const uid = previewUid.value;
  const item = uid === null ? null : hero.items.find((i) => i.uid === uid);
  const slot = item ? bestSlotFor(session, item) : null;
  const after = item && slot ? withEquipped(hero, item, slot) : null;
  const rows = sheetRows(
    hero,
    mods,
    session.state.tuning,
    after ? { hero: after, mods: modsFor(after) } : null,
  );
  const pts = pointsOf(hero);
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
      {item ? (
        <p class="inv-previewing" aria-live="polite">
          If you equip <b class={`r-${item.rarity}`}>{itemDescription(item).name}</b>
        </p>
      ) : null}
      <div class="mn-scroll">
        <Currency session={session} onTab={onTab} />
        {GROUPS.map((g) => {
          const list = rows.filter((r) => r.group === g);
          if (list.length === 0) return null;
          return (
            <div class="inv-group" key={g}>
              <h4>{g}</h4>
              {list.map((r) => (
                <Row key={r.key} r={r} />
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
