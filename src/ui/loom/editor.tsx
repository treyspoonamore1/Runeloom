/** The Loom's center: slot tabs, the weave as an indented tree, the notation line and the slot status. */
import type { JSX } from 'preact';
import { SLOT_LABELS } from '../../app/loadout';
import { getRune, type RuneDef, type RuneId } from '../../../data/runes';
import { listSpells, type SpellVisit, type WeavePath } from '../../sim/weave/tree';
import { weaveStory } from './describe';
import { RuneGlyph } from './glyphs';
import type { LoomState, SlotStatus } from './loomState';
import { isBlank, placementMap, samePath, type Placement } from './model';
import { anchorOf, tipHandlers } from './popups';
import { RUNE_MIME } from './pouch';
import { noFreeReason } from './pouchCounts';

/** Short reason a slot tab shows a warning dot, or null. */
export function slotWarning(s: SlotStatus | undefined): string | null {
  if (!s || s.kind === 'ok' || s.kind === 'empty') return null;
  if (s.kind === 'invalid' && s.applied) return `Doesn't fire: ${s.message}`;
  return `Not applied: ${s.message}`;
}

export function SlotTabs({ st }: { st: LoomState }) {
  const cur = st.slot.value;
  const statuses = st.statuses.value;
  const drafts = st.drafts.value;
  // The open slots only: R appears with the Twin Threads mutation.
  const labels = st.loadout.value.slots.map((s) => s.label);
  return (
    <div class={`lm-tabs${labels.length > 4 ? ' five' : ''}`} role="tablist" aria-label="Weave slots">
      {labels.map((label, i) => {
        const warn =
          i === cur && st.parseError.value
            ? 'Not applied: the notation has an error'
            : slotWarning(statuses[i]);
        const d = drafts[i];
        const summary =
          d && !isBlank(d)
            ? `${getRune(d.trigger)?.name ?? '?'} · ${getRune(d.root.form)?.name ?? '?'}`
            : 'Empty';
        return (
          <button
            key={label}
            type="button"
            role="tab"
            id={`lm-tab-${i}`}
            aria-selected={cur === i}
            aria-controls="lm-weave"
            class={`lm-tab${cur === i ? ' on' : ''}${warn ? ' warn' : ''}`}
            title={warn ?? undefined}
            onClick={() => st.selectSlot(i)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const n = (i + (e.key === 'ArrowRight' ? 1 : labels.length - 1)) % labels.length;
                st.selectSlot(n);
                document.getElementById(`lm-tab-${n}`)?.focus();
              }
            }}
          >
            <span class="lm-tab-key">{label}</span>
            <span class="lm-tab-sum">{summary}</span>
            {warn ? <i class="lm-dot" aria-label="warning" /> : null}
          </button>
        );
      })}
    </div>
  );
}

interface SpotCtx {
  st: LoomState;
  active: RuneId | null;
  pm: Map<string, Placement> | null;
  badKey: string | null;
}

/** A place in the tree: a placed chip, an empty dashed spot, or the [+] at the end of a row. */
function SpotButton(p: {
  c: SpotCtx;
  spotKey: string;
  /** The chip's path (null for the [+]). */
  path: WeavePath | null;
  rune: RuneDef | undefined;
  placeholder: string;
  kindHint: string;
  plus?: boolean;
}) {
  const { st, active, pm, badKey } = p.c;
  const pl = pm?.get(p.spotKey);
  const selected = p.path !== null && samePath(st.selected.value, p.path);
  const filled = !!p.rune;
  const cls = [
    'lm-spot',
    p.plus ? 'plus' : filled ? `lm-chip lg k-${p.rune!.kind} r-${p.rune!.id}` : 'empty',
    pl?.ok ? 'lit' : pl ? 'blocked' : active ? 'dim' : '',
    selected ? 'sel' : '',
    badKey === p.spotKey && !pl?.ok ? 'bad' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const openPicker = (el: Element) =>
    (st.picker.value = { key: p.spotKey, spot: null, path: p.path, at: anchorOf(el) });

  const onClick = (e: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (active && pl?.ok) return st.place(pl, active);
    if (active) st.armed.value = null;
    if (filled) st.selected.value = selected ? null : p.path;
    else openPicker(e.currentTarget);
  };
  const label = filled
    ? `${p.rune!.name}${badKey === p.spotKey ? ', has a problem' : ''}${pl?.ok ? ', click to replace' : ''}`
    : p.plus
      ? `Add to this spell${pl?.ok ? ', click to place' : ''}`
      : `Empty ${p.kindHint} spot${pl?.ok ? ', click to place' : ''}`;

  const btn = (
    <button
      type="button"
      class={cls}
      aria-label={label}
      aria-pressed={filled ? selected : undefined}
      title={pl && !pl.ok ? pl.reason : undefined}
      data-spot={p.spotKey}
      onClick={onClick}
      onDragOver={(e) => {
        if (pl?.ok) {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
          e.currentTarget.classList.add('over');
        }
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove('over')}
      onDrop={(e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('over');
        const id = (e.dataTransfer?.getData(RUNE_MIME) || st.dragging.peek()) as RuneId | null;
        st.dragging.value = null;
        if (!id) return;
        const target = placementMap(st.draft, id, st.editOpts).get(p.spotKey);
        if (target?.ok) st.place(target, id);
      }}
      {...(filled ? tipHandlers(p.rune, 'below') : {})}
    >
      {filled ? (
        <>
          <span class={`lm-medal k-${p.rune!.kind} r-${p.rune!.id}`}>
            <RuneGlyph id={p.rune!.id} />
          </span>
          <span class="lm-name">{p.rune!.name}</span>
        </>
      ) : p.plus ? (
        <span class="lm-plus">{active && getRune(active)?.kind === 'branch' ? '+ branch' : '+'}</span>
      ) : (
        <span class="lm-ph">{p.placeholder}</span>
      )}
    </button>
  );
  // Always wrapped, so selecting a chip doesn't remount its button (keyboard focus stays on it).
  const path = p.path;
  return (
    <span class="lm-selwrap">
      {btn}
      {selected && path ? (
        <span class="lm-chipacts">
          <button
            type="button"
            class="lm-act"
            aria-label={`Swap ${p.rune?.name ?? ''}`}
            title="Swap for another rune"
            onClick={(e) => {
              e.stopPropagation();
              openPicker(
                (e.currentTarget.parentElement?.previousElementSibling as Element) ?? e.currentTarget,
              );
            }}
          >
            ⇄
          </button>
          <button
            type="button"
            class="lm-act del"
            aria-label={`Remove ${p.rune?.name ?? ''}`}
            title={
              path[path.length - 1] === 'branch'
                ? 'Remove this branch and everything under it (Del)'
                : 'Remove (Del)'
            }
            onClick={(e) => {
              e.stopPropagation();
              st.remove(path);
            }}
          >
            ×
          </button>
        </span>
      ) : null}
    </span>
  );
}

const Arrow = () => (
  <span class="lm-arrow" aria-hidden="true">
    →
  </span>
);

function SpellRow({ c, v }: { c: SpotCtx; v: SpellVisit }) {
  const sp = v.path;
  const key = (tail: string) => [...sp, tail].join('.');
  const tree = c.st.draft;
  return (
    <div class={`lm-row d${v.depth}`}>
      {v.depth === 0 ? (
        <SpotButton
          c={c}
          spotKey="trigger"
          path={['trigger']}
          rune={getRune(tree.trigger)}
          placeholder="Trigger"
          kindHint="trigger"
        />
      ) : (
        <SpotButton
          c={c}
          spotKey={key('branch')}
          path={[...sp, 'branch']}
          rune={getRune(v.via!.branch)}
          placeholder="Branch"
          kindHint="branch"
        />
      )}
      <Arrow />
      <SpotButton
        c={c}
        spotKey={key('form')}
        path={[...sp, 'form']}
        rune={getRune(v.spell.form)}
        placeholder="Form"
        kindHint="form"
      />
      {v.spell.items.map((id, i) => (
        <SpotButton
          key={`${i}-${id}`}
          c={c}
          spotKey={key(`i${i}`)}
          path={[...sp, `i${i}`]}
          rune={getRune(id)}
          placeholder="?"
          kindHint="item"
        />
      ))}
      <SpotButton
        c={c}
        spotKey={key('+')}
        path={null}
        rune={undefined}
        placeholder="+"
        kindHint="item"
        plus
      />
    </div>
  );
}

function Node({ c, visits, at }: { c: SpotCtx; visits: SpellVisit[]; at: number }) {
  const v = visits[at]!;
  const kids: number[] = [];
  for (let i = at + 1; i < visits.length; i++) {
    const w = visits[i]!;
    if (w.depth <= v.depth) break;
    if (w.depth === v.depth + 1) kids.push(i);
  }
  return (
    <div class="lm-node">
      <SpellRow c={c} v={v} />
      {kids.length > 0 ? (
        <div class="lm-kids">
          {kids.map((k) => (
            <Node key={visits[k]!.path.join('.')} c={c} visits={visits} at={k} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function WeaveTreeView({ st }: { st: LoomState }) {
  const tree = st.draft;
  const active = st.activeRune;
  const status = st.status;
  const badKey =
    (status.kind === 'invalid' || status.kind === 'incomplete') && status.path.length > 0
      ? status.path.join('.')
      : null;
  const c: SpotCtx = { st, active, pm: active ? placementMap(tree, active, st.editOpts) : null, badKey };
  const visits = listSpells(tree);
  const none = active && c.pm && ![...c.pm.values()].some((p) => p.ok);
  const scarce = active ? noFreeReason(st.free.value, active) : null;
  return (
    <div
      id="lm-weave"
      class={`lm-weave${active ? ' arming' : ''}`}
      role="tabpanel"
      aria-labelledby={`lm-tab-${st.slot.value}`}
      onClick={() => {
        st.selected.value = null;
        if (st.armed.peek()) st.armed.value = null;
      }}
    >
      <Node c={c} visits={visits} at={0} />
      {none ? (
        <p class="lm-nospot">
          {scarce
            ? `${scarce}${scarce.startsWith('No free') ? ': every copy is in a weave. Remove one first.' : '.'}`
            : `No spot in this weave takes ${getRune(active)?.name}.`}
        </p>
      ) : null}
      {!isBlank(tree) ? (
        <div class="lm-story" aria-label="What this weave does">
          <h5>Reads as</h5>
          {weaveStory(tree, SLOT_LABELS[st.slot.value]!).map((l, i) => (
            <p key={i} style={`padding-left:calc(var(--u) * ${l.depth * 2.6})`}>
              {l.depth > 0 ? '↳ ' : ''}
              {l.text}
            </p>
          ))}
        </div>
      ) : null}
      <div class="lm-legend" aria-hidden="true">
        <span class="k-trigger">
          <i /> Trigger
        </span>
        <span class="k-form">
          <i /> Form
        </span>
        <span class="k-element">
          <i /> Element
        </span>
        <span class="k-modifier">
          <i /> Modifier
        </span>
        <span class="k-branch">
          <i /> Branch: fires off the row above
        </span>
      </div>
    </div>
  );
}
