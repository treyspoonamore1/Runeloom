/**
 * Passive tree screen (P): the Pattern with points, a refund mode, the hovered node's details and
 * a legend. Allocate and refund are HeroEdits through heroAdapter.sendEdit.
 */
import { signal } from '@preact/signals';
import type { Session } from '../../app/session';
import { heroOf, heroRev, sendEdit } from '../heroAdapter';
import { MenuFrame, note, type MenuId } from '../menus/frame';
import { allocReason, passiveIndex, pointsOf, refundPrice, refundReason, type PassiveArea } from './adapter';
import { allocatedSet, nodeState, type NodeState } from './treeModel';
import { injectTreeStyle } from './treeStyle';
import { focused, hovered, TreeView } from './treeView';

const refundMode = signal(false);

const AREA_NAMES: Record<PassiveArea, string> = {
  ember: 'Ember',
  rime: 'Rime',
  tempest: 'Tempest',
  weaver: 'Weaver',
  warden: 'Warden',
};
const TYPE_NAMES = { start: 'Start', small: 'Small node', notable: 'Notable', keystone: 'Keystone' } as const;

/** Reads the hovered node itself, so hovering re-renders only this panel, not the tree. */
function Details({ session, states }: { session: Session; states: ReadonlyMap<string, NodeState> }) {
  const ix = passiveIndex();
  const id = hovered.value ?? focused.value;
  const st = id ? (states.get(id) ?? null) : null;
  const n = id ? ix.byId.get(id) : undefined;
  if (!n || !st)
    return <p class="mn-muted">Hover a node to read it. Arrow keys walk the tree from the start.</p>;
  const hero = heroOf(session);
  const cost = refundPrice(hero);
  const why = st === 'allocated' ? refundReason(hero, n.id) : allocReason(hero, n.id);
  return (
    <div class={`tr-detail a-${n.area}`}>
      <h4>{n.name}</h4>
      <p class="tr-kind">
        {TYPE_NAMES[n.type]} · {AREA_NAMES[n.area]}
      </p>
      <ul>
        {n.text.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
      <p class={`tr-act${why ? ' no' : ''}`}>
        {st === 'allocated'
          ? (why ??
            `Right-click or Delete to refund${cost ? ` (${cost} Thread Scrap)` : ' (free until level 10)'}`)
          : (why ?? 'Click or Enter to allocate')}
      </p>
    </div>
  );
}

export function TreeScreen(p: { session: Session; onTab(id: MenuId): void; onClose(): void }) {
  injectTreeStyle();
  void heroRev.value;
  const hero = heroOf(p.session);
  const ix = passiveIndex();
  const alloc = allocatedSet(ix, hero.passives);
  const states = new Map(ix.tree.nodes.map((n) => [n.id, nodeState(ix, alloc, n.id)]));
  const pts = pointsOf(hero);
  const cost = refundPrice(hero);

  const activate = (id: string, rightClick: boolean) => {
    const st = states.get(id);
    const refund = rightClick || refundMode.peek();
    if (refund) {
      if (st !== 'allocated') return note('Not allocated');
      const why = sendEdit(p.session, { kind: 'refund', node: id });
      note(why ?? `Refunded ${ix.byId.get(id)?.name ?? id}`, why === null);
    } else {
      if (st === 'allocated') return;
      const why = sendEdit(p.session, { kind: 'allocate', node: id });
      if (why) note(why);
    }
  };

  return (
    <MenuFrame
      id="tree"
      title="The Pattern"
      onTab={p.onTab}
      onClose={p.onClose}
      bodyClass="tr-body"
      extra={
        <div class={`tr-points${pts.free > 0 ? ' has' : ''}`} aria-live="polite">
          <b>{pts.free}</b> point{pts.free === 1 ? '' : 's'} to spend{' '}
          <small>
            ({pts.spent} of {pts.total} spent)
          </small>
        </div>
      }
    >
      <section class="mn-panel tr-main" aria-label="Passive tree">
        <TreeView ix={ix} states={states} onActivate={activate} />
      </section>
      <aside class="mn-panel tr-side" aria-label="Node details">
        <div class="tr-modes" role="radiogroup" aria-label="Click mode">
          <button
            type="button"
            role="radio"
            class="mn-tab"
            aria-checked={!refundMode.value}
            aria-selected={!refundMode.value}
            onClick={() => (refundMode.value = false)}
          >
            Allocate
          </button>
          <button
            type="button"
            role="radio"
            class="mn-tab"
            aria-checked={refundMode.value}
            aria-selected={refundMode.value}
            onClick={() => (refundMode.value = true)}
          >
            Refund
          </button>
        </div>
        <p class="mn-help">
          Refunds are{' '}
          {cost ? `${cost} Thread Scrap per point (you have ${hero.threadScrap})` : 'free until level 10'}.
          Right-click refunds in either mode.
        </p>
        <Details session={p.session} states={states} />
        <div class="tr-legend" aria-hidden="true">
          {(Object.keys(AREA_NAMES) as PassiveArea[]).map((a) => (
            <span key={a} class={`a-${a}`}>
              <i /> {AREA_NAMES[a]}
            </span>
          ))}
          <span class="st allocated">
            <i /> Allocated
          </span>
          <span class="st available">
            <i /> Available
          </span>
          <span class="st locked">
            <i /> Locked
          </span>
        </div>
      </aside>
    </MenuFrame>
  );
}
