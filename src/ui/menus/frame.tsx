/**
 * Shared parts of the adventure menus: the full-screen frame with the I / P / M / C / L / H tabs, a floating
 * tooltip kept inside the viewport, a modal dialog, and a short note for refused actions.
 */
import { signal } from '@preact/signals';
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { hearthUnlocked } from '../hearth/hearthSignals';
import { injectMenuStyle, menuCss } from './menuStyle';

export type MenuId = 'inventory' | 'tree' | 'map' | 'craft' | 'filter' | 'hearth';

export const MENUS: ReadonlyArray<{ id: MenuId; label: string; key: string; code: string }> = [
  { id: 'inventory', label: 'Character', key: 'I', code: 'KeyI' },
  { id: 'tree', label: 'Pattern', key: 'P', code: 'KeyP' },
  { id: 'map', label: 'Map', key: 'M', code: 'KeyM' },
  { id: 'craft', label: 'Craft', key: 'C', code: 'KeyC' },
  { id: 'filter', label: 'Filter', key: 'L', code: 'KeyL' },
  /** Exists once the Hearth is lit (hearthUnlocked). */
  { id: 'hearth', label: 'Hearth', key: 'H', code: 'KeyH' },
];

/** The menus the player can open now: the Hearth's tab appears when it is lit. */
export const availableMenus = (): typeof MENUS => MENUS.filter((m) => m.id !== 'hearth' || hearthUnlocked.value);

export interface Anchor {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const anchorOf = (el: Element): Anchor => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

/** The open menu's tooltip: what to show and next to what. */
export const menuTip = signal<{ at: Anchor; rarity?: string; body: () => JSX.Element } | null>(null);

/** A short message for refused actions ("A spindle is always equipped"), cleared after a moment. */
export const menuNote = signal<{ text: string; ok: boolean; n: number } | null>(null);
let noteTimer: ReturnType<typeof setTimeout> | undefined;
export function note(text: string, ok = false): void {
  menuNote.value = { text, ok, n: (menuNote.peek()?.n ?? 0) + 1 };
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => (menuNote.value = null), 2200);
}

export function MenuFrame(p: {
  id: MenuId;
  title: string;
  onTab(id: MenuId): void;
  onClose(): void;
  bodyClass: string;
  /** Extra class on the menu's root (a screen's own style hooks). */
  rootClass?: string;
  extra?: ComponentChildren;
  children: ComponentChildren;
}) {
  injectMenuStyle('rl-menu-style', menuCss);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    return () => (menuTip.value = null);
  }, [p.id]);
  const n = menuNote.value;
  return (
    <div class={`mn-root${p.rootClass ? ` ${p.rootClass}` : ''}`} ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={p.title}>
      <div class="mn-card">
        <header class="mn-head">
          <h2>{p.title}</h2>
          {p.extra}
          <div class="mn-tabs" role="tablist" aria-label="Menus">
            {availableMenus().map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                class="mn-tab"
                aria-selected={m.id === p.id}
                onClick={() => p.onTab(m.id)}
              >
                {m.label} <kbd>{m.key}</kbd>
              </button>
            ))}
            <button type="button" class="mn-tab" onClick={p.onClose} aria-label="Close">
              Close <kbd>Esc</kbd>
            </button>
          </div>
        </header>
        <div class={`mn-body ${p.bodyClass}`}>{p.children}</div>
        {n ? (
          <div class={`mn-note${n.ok ? ' ok' : ''}`} key={n.n} role="status">
            {n.text}
          </div>
        ) : null}
      </div>
      <MenuTooltip />
    </div>
  );
}

/** Keeps a w×h box next to `at` and inside the viewport: right of it, else left, else below. */
export function placeBox(
  at: Anchor,
  w: number,
  h: number,
  vw: number,
  vh: number,
  gap = 10,
): { x: number; y: number } {
  let x = at.x + at.w + gap;
  if (x + w > vw - gap) x = at.x - w - gap;
  if (x < gap) x = Math.min(Math.max(gap, at.x), vw - w - gap);
  let y = at.y;
  if (y + h > vh - gap) y = vh - h - gap;
  return { x: Math.max(gap, x), y: Math.max(gap, y) };
}

function MenuTooltip() {
  const t = menuTip.value;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !t) return;
    const pos = placeBox(t.at, el.offsetWidth, el.offsetHeight, window.innerWidth, window.innerHeight);
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;
    el.style.visibility = 'visible';
  });
  if (!t) return null;
  return (
    <div class={`mn-tip r-${t.rarity ?? 'normal'}`} ref={ref} role="tooltip" style="visibility:hidden">
      {t.body()}
    </div>
  );
}

/** Hover and focus handlers that show a tooltip for an element. */
export function tipFor(rarity: string | undefined, body: () => JSX.Element) {
  const show = (e: Event) => (menuTip.value = { at: anchorOf(e.currentTarget as Element), rarity, body });
  const hide = () => (menuTip.value = null);
  return { onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide };
}

/** The open dialog's cancel action, so Esc closes the dialog before the menu. */
let cancelDialog: (() => void) | null = null;

/** Esc inside a menu: closes an open dialog or tooltip first. Returns true when it did. */
export function escapeInMenu(): boolean {
  if (cancelDialog) {
    cancelDialog();
    return true;
  }
  return false;
}

export function Dialog(p: { title: string; onCancel(): void; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  cancelDialog = p.onCancel;
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus({ preventScroll: true });
    return () => {
      cancelDialog = null;
    };
  }, []);
  return (
    <div
      class="mn-dialog-bg"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) p.onCancel();
      }}
    >
      <div class="mn-dialog" ref={ref} role="alertdialog" aria-modal="true" aria-label={p.title}>
        <h3>{p.title}</h3>
        {p.children}
      </div>
    </div>
  );
}
