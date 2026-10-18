/** Floating parts of the Loom: the rune tooltip, the spot-first rune picker and the examples menu. */
import { signal } from '@preact/signals';
import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { RuneDef } from '../../../data/runes';
import { referenceWeaves } from '../../sim/weave/referenceWeaves';
import { SLOT_LABELS } from '../../app/loadout';
import { KIND_ORDER, KIND_TITLE, runeFacts } from './describe';
import { RuneGlyph } from './glyphs';
import type { Anchor, LoomState } from './loomState';
import { chipRune, placements, type Placement } from './model';
import { pouchRunes } from './pouch';

export const anchorOf = (el: Element): Anchor => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

/** The hovered or focused rune and where its chip is. */
export const tip = signal<{ rune: RuneDef; at: Anchor; side: 'right' | 'below'; note?: string } | null>(null);

export function tipHandlers(rune: RuneDef | undefined, side: 'right' | 'below', note?: string) {
  if (!rune) return {};
  const show = (e: Event) => (tip.value = { rune, at: anchorOf(e.currentTarget as Element), side, note });
  const hide = () => (tip.value = null);
  return { onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide };
}

/** Keeps a floating box inside the viewport. */
function place(at: Anchor, side: 'right' | 'below', w: number, h: number): JSX.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 8;
  let x = side === 'right' ? at.x + at.w + gap : at.x;
  let y = side === 'right' ? at.y : at.y + at.h + gap;
  if (x + w > vw - gap) x = side === 'right' ? at.x - w - gap : vw - w - gap;
  if (y + h > vh - gap) y = side === 'right' ? vh - h - gap : at.y - h - gap;
  return { left: `${Math.max(gap, x)}px`, top: `${Math.max(gap, y)}px` };
}

export function Tooltip() {
  const t = tip.value;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !t) return;
    Object.assign(el.style, place(t.at, t.side, el.offsetWidth, el.offsetHeight));
    el.style.visibility = 'visible';
  });
  if (!t) return null;
  const r = t.rune;
  return (
    <div class={`lm-tip k-${r.kind}`} ref={ref} role="tooltip" style="visibility:hidden">
      <div class="lm-tip-head">
        <span class={`lm-medal k-${r.kind} r-${r.id}`}>
          <RuneGlyph id={r.id} />
        </span>
        <b>{r.name}</b>
        <span class="lm-tip-kind">{r.kind}</span>
      </div>
      <p>{r.description}</p>
      <dl>
        {runeFacts(r).map(([k, v]) => (
          <>
            <dt key={`${k}t`}>{k}</dt>
            <dd key={`${k}d`}>{v}</dd>
          </>
        ))}
      </dl>
      {t.note ? <p class="lm-tip-note">{t.note}</p> : null}
    </div>
  );
}

/** Spot-first editing: the runes that fit the clicked spot. */
export function Picker({ st }: { st: LoomState }) {
  const pk = st.picker.value;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !pk) return;
    Object.assign(el.style, place(pk.at, 'below', el.offsetWidth, el.offsetHeight));
    el.style.visibility = 'visible';
    el.querySelector<HTMLButtonElement>('button[role=menuitem]')?.focus({ preventScroll: true });
  }, [pk?.key]);
  if (!pk) return null;
  const tree = st.draft;
  const opts: Array<{ rune: RuneDef; p: Placement }> = [];
  for (const r of pouchRunes) {
    const p = placements(tree, r.id).find((x) => x.ok && x.key === pk.key);
    if (p) opts.push({ rune: r, p });
  }
  const current = pk.path ? chipRune(tree, pk.path) : undefined;
  return (
    <div
      class="lm-pop lm-picker"
      ref={ref}
      role="menu"
      aria-label="Runes for this spot"
      style="visibility:hidden"
    >
      <div class="lm-pop-head">
        {current ? `Swap ${current.name} for…` : 'Place a rune here'}
        <button type="button" class="lm-x" aria-label="Close" onClick={() => (st.picker.value = null)}>
          ×
        </button>
      </div>
      {opts.length === 0 ? <p class="lm-muted">Nothing fits here.</p> : null}
      {KIND_ORDER.map((k) => {
        const list = opts.filter((o) => o.rune.kind === k);
        if (list.length === 0) return null;
        return (
          <div key={k} class="lm-pick-group">
            <h5>{KIND_TITLE[k]}</h5>
            <div class="lm-pick-list">
              {list.map(({ rune, p }) => (
                <button
                  key={rune.id}
                  type="button"
                  role="menuitem"
                  aria-label={`${rune.name}, ${rune.kind}, complexity ${rune.cx}`}
                  class={`lm-chip sm k-${rune.kind} r-${rune.id}`}
                  onClick={() => {
                    st.place(p, rune.id);
                    // Back to the spot that opened the picker (keyboard users keep their place).
                    requestAnimationFrame(() => {
                      const a = document.activeElement;
                      if (a && a !== document.body) return;
                      document.querySelector<HTMLElement>(`[data-spot="${pk.key}"]`)?.focus();
                    });
                  }}
                  {...tipHandlers(rune, 'right')}
                >
                  <span class={`lm-medal k-${rune.kind} r-${rune.id}`}>
                    <RuneGlyph id={rune.id} />
                  </span>
                  <span class="lm-name">{rune.name}</span>
                  <span class="lm-cx">{rune.cx}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** CONTENT §2 reference weaves, loadable into the current slot. */
export function RefMenu({ st }: { st: LoomState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button.lm-ref')?.focus({ preventScroll: true });
  }, [st.refMenu.value]);
  if (!st.refMenu.value) return null;
  const cap = st.loadout.value.capacity;
  return (
    <div class="lm-pop lm-refmenu" ref={ref} role="menu" aria-label="Reference weaves">
      <div class="lm-pop-head">
        Reference weaves <small>load into {SLOT_LABELS[st.slot.value]}</small>
        <button type="button" class="lm-x" aria-label="Close" onClick={() => (st.refMenu.value = false)}>
          ×
        </button>
      </div>
      <div class="lm-ref-list">
        {referenceWeaves.map((w) => (
          <button
            key={w.n}
            type="button"
            role="menuitem"
            class="lm-ref"
            onClick={() => st.loadNotation(w.notation)}
          >
            <span class="lm-ref-n">{w.n}</span>
            <span class="lm-ref-body">
              <b>{w.name}</b>
              <code>{w.notation}</code>
            </span>
            <span
              class={`lm-ref-cx${w.cx > cap ? ' over' : ''}`}
              title={w.cx > cap ? `Needs ${w.cx} Capacity` : 'Fits'}
            >
              {w.cx}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
