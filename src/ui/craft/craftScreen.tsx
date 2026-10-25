/**
 * The crafting bench (C, M5; DESIGN §8.5): pick a currency, pick an item (or a rune for Rune
 * Polish), see its affixes with their tiers, and use the currency. Every use is a 'craft'
 * HeroEdit through heroAdapter.sendEdit; the bench marks the lines the craft added.
 */
import { signal } from '@preact/signals';
import type { Session } from '../../app/session';
import { currencies, type CurrencyId } from '../../../data/currency';
import { getRune } from '../../../data/runes';
import type { HeroState, Item, RuneItem } from '../../sim/hero/types';
import { Icon } from '../adventure/icons';
import { heroOf, heroRev, sendEdit } from '../heroAdapter';
import { RuneGlyph } from '../loom/glyphs';
import { MenuFrame, note, tipFor, type MenuId } from '../menus/frame';
import { itemDescription, runeDescription, type Description } from '../inventory/adapter';
import { iconOf } from '../inventory/slots';
import { ItemTip } from '../inventory/tips';
import { newLines, targetsFor, wallet, type CraftTarget } from './craftModel';
import { injectCraftStyle } from './craftStyle';
import { CurrencyGlyph } from '../items/currencyGlyph';

export const craftCurrency = signal<CurrencyId>('weavers_knot');
export const craftTarget = signal<number | null>(null);
/** The last craft: its target and the lines it had before, to mark what changed. */
const lastCraft = signal<{ uid: number; before: string[] } | null>(null);

export { CurrencyGlyph };

function Wallet({ hero }: { hero: Readonly<HeroState>; rev: number }) {
  const cur = craftCurrency.value;
  return (
    <section class="mn-panel cr-wallet" aria-label="Currency">
      <h3>
        Currency{' '}
        <small>
          <Icon kind="scrap" /> {hero.threadScrap} Scrap
        </small>
      </h3>
      <div class="mn-scroll cr-list" role="listbox" aria-label="Currency">
        {wallet(hero).map(({ id, count }) => (
          <button
            key={id}
            type="button"
            role="option"
            aria-selected={id === cur}
            class={`cr-cur${id === cur ? ' sel' : ''}${count === 0 ? ' none' : ''}`}
            onClick={() => {
              craftCurrency.value = id;
              lastCraft.value = null;
            }}
          >
            <span class="inv-ico">
              <CurrencyGlyph id={id} />
            </span>
            <span class="inv-slot-txt">
              <b>{currencies[id].name}</b>
              <small>{currencies[id].text}</small>
            </span>
            <span class="inv-count">×{count}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function targetLabel(hero: Readonly<HeroState>, t: CraftTarget): { d: Description; rarity: string } {
  if (t.kind === 'rune') {
    const r = hero.runes.find((x) => x.uid === t.uid)!;
    return { d: runeDescription(r), rarity: 'normal' };
  }
  const it = hero.items.find((x) => x.uid === t.uid)!;
  return { d: itemDescription(it), rarity: it.rarity };
}

function Targets({ session, hero }: { session: Session; hero: Readonly<HeroState>; rev: number }) {
  const cur = craftCurrency.value;
  const list = targetsFor(hero, cur);
  const runes = currencies[cur].target === 'rune';
  return (
    <section class="mn-panel cr-targets" aria-label={runes ? 'Runes' : 'Items'}>
      <h3>
        {runes ? 'Runes' : 'Items'} <small>{list.filter((t) => t.problem === null).length} can take it</small>
      </h3>
      <div class="mn-scroll">
        {list.length === 0 ? <p class="mn-muted">Nothing to craft on yet.</p> : null}
        <div class="inv-grid">
          {list.map((t) => {
            const { d, rarity } = targetLabel(hero, t);
            const sel = craftTarget.value === t.uid;
            const item = t.kind === 'item' ? hero.items.find((x) => x.uid === t.uid)! : null;
            const rune = t.kind === 'rune' ? hero.runes.find((x) => x.uid === t.uid)! : null;
            return (
              <button
                key={t.uid}
                type="button"
                class={`inv-card r-${rarity}${sel ? ' cr-sel' : ''}${t.problem ? ' cr-no' : ''}`}
                aria-pressed={sel}
                aria-label={`${d.name}${t.problem ? `: ${t.problem}` : ''}`}
                onClick={() => {
                  craftTarget.value = t.uid;
                  lastCraft.value = null;
                }}
                {...(item
                  ? tipFor(item.rarity, () => <ItemTip session={session} item={item} equipped />)
                  : {})}
              >
                <span class="inv-ico">
                  {rune ? <RuneGlyph id={rune.rune} /> : <Icon kind={iconOf(item!)} />}
                </span>
                <span class="inv-slot-txt">
                  <b>{d.name}</b>
                  <small>
                    {rune
                      ? `Level ${rune.level} · ${rune.quality}% quality`
                      : `${t.equipped ? 'Equipped · ' : ''}${d.name !== d.base ? `${d.base} · ` : ''}ilvl ${item!.itemLevel}`}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ItemDetail({ item, fresh }: { item: Item; fresh: Set<string> }) {
  const d = itemDescription(item);
  const affixLines = new Set((d.affixes ?? []).map((a) => a.text));
  return (
    <>
      <h4 class={`cr-name r-${item.rarity}`}>{d.name}</h4>
      <p class="mn-base">
        {d.name !== d.base ? `${d.base} · ` : ''}
        {item.rarity[0]!.toUpperCase() + item.rarity.slice(1)} · item level {item.itemLevel}
      </p>
      <ul class="cr-lines">
        {d.lines
          .filter((l) => !affixLines.has(l))
          .map((l, i) => (
            <li key={`l${i}`} class={fresh.has(l) ? 'cr-new' : ''}>
              {l}
            </li>
          ))}
        {(d.affixes ?? []).map((a, i) => (
          <li key={`a${i}`} class={fresh.has(a.text) ? 'cr-new' : ''}>
            <span
              class={`cr-tier t${a.tier}`}
              title={`${a.side === 'prefix' ? 'Prefix' : 'Suffix'}, tier ${a.tier}`}
            >
              {a.side === 'prefix' ? 'P' : 'S'}
              {a.tier}
            </span>
            {a.text}
          </li>
        ))}
      </ul>
      {item.rarity !== 'normal' && (d.affixes ?? []).length === 0 && !item.unique ? (
        <p class="mn-muted">No affixes.</p>
      ) : null}
    </>
  );
}

function RuneDetail({ rune, fresh }: { rune: RuneItem; fresh: Set<string> }) {
  const d = runeDescription(rune);
  return (
    <>
      <h4 class="cr-name">{getRune(rune.rune)?.name ?? rune.rune}</h4>
      <p class="mn-base">{d.properties.join(' · ')}</p>
      <ul class="cr-lines">
        {d.lines.map((l, i) => (
          <li key={i} class={fresh.has(l) ? 'cr-new' : ''}>
            {l}
          </li>
        ))}
      </ul>
    </>
  );
}

function linesOf(hero: Readonly<HeroState>, uid: number): string[] {
  const it = hero.items.find((x) => x.uid === uid);
  if (it) return itemDescription(it).lines;
  const r = hero.runes.find((x) => x.uid === uid);
  return r ? [...runeDescription(r).lines, ...runeDescription(r).properties] : [];
}

function Bench({ session, hero }: { session: Session; hero: Readonly<HeroState>; rev: number }) {
  const cur = craftCurrency.value;
  const def = currencies[cur];
  const target = targetsFor(hero, cur).find((t) => t.uid === craftTarget.value) ?? null;
  const count = hero.currency[cur] ?? 0;
  const item = target?.kind === 'item' ? hero.items.find((x) => x.uid === target.uid) : undefined;
  const rune = target?.kind === 'rune' ? hero.runes.find((x) => x.uid === target.uid) : undefined;
  const last = lastCraft.value;
  const fresh =
    last && target && last.uid === target.uid
      ? newLines(last.before, linesOf(hero, target.uid))
      : new Set<string>();
  const why = !target
    ? `Pick ${def.target === 'rune' ? 'a rune' : 'an item'}`
    : count <= 0
      ? `You have no ${def.name}`
      : target.problem;
  const use = () => {
    if (!target) return;
    const before = linesOf(hero, target.uid);
    const err = sendEdit(session, { kind: 'craft', currency: cur, uid: target.uid });
    if (err) note(err);
    else lastCraft.value = { uid: target.uid, before };
  };
  return (
    <section class="mn-panel cr-bench" aria-label="Bench">
      <h3>Bench</h3>
      <div class="mn-scroll">
        {item ? <ItemDetail item={item} fresh={fresh} /> : null}
        {rune ? <RuneDetail rune={rune} fresh={fresh} /> : null}
        {!target ? <p class="mn-muted">Pick a currency, then something to use it on.</p> : null}
      </div>
      <div class="cr-use">
        <p class="cr-what">
          <span class="inv-ico">
            <CurrencyGlyph id={cur} />
          </span>
          <span>
            <b>{def.name}</b> <small>×{count}</small>
            <br />
            {def.text}
          </span>
        </p>
        <button
          type="button"
          class="mn-btn gold"
          disabled={why !== null}
          title={why ?? undefined}
          onClick={use}
        >
          Use {def.name}
        </button>
        {why && target ? <p class="mn-why cr-why">{why}.</p> : null}
      </div>
    </section>
  );
}

export function CraftScreen(p: { session: Session; onTab(id: MenuId): void; onClose(): void }) {
  injectCraftStyle();
  // Passed down as `rev` (see InventoryScreen): the hero is mutated in place.
  const rev = heroRev.value;
  const hero = heroOf(p.session);
  return (
    <MenuFrame id="craft" title="Crafting Bench" onTab={p.onTab} onClose={p.onClose} bodyClass="cr-body">
      <Wallet hero={hero} rev={rev} />
      <Targets session={p.session} hero={hero} rev={rev} />
      <Bench session={p.session} hero={hero} rev={rev} />
    </MenuFrame>
  );
}
