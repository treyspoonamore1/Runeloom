/**
 * The Loom: the full-screen spell editor (DESIGN §5, BUILD_PLAN M2 task 6). The HUD owns opening
 * and closing (Tab, Esc; the sim pauses and player input is off while it is open); this module
 * owns the panel, its keyboard rules and the DPS readout requests.
 */
import { effect } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import type { Session } from '../../app/session';
import { Emblem } from '../icons';
import { Details } from './details';
import { SlotTabs, WeaveTreeView } from './editor';
import { NotationLine, SlotStatusLine } from './notationLine';
import { injectLoomStyle } from './loomStyle';
import { LoomState } from './loomState';
import { loadoutRev } from './loadoutStore';
import { Picker, RefMenu, Tooltip, tip } from './popups';
import { Pouch } from './pouch';
import { createReadoutClient, type ReadoutClient } from './readoutClient';
import { readoutKey } from './readoutQueue';

export interface LoomController {
  readonly st: LoomState;
  readonly readout: ReadoutClient;
  /** Handles a keydown while the Loom is open. Returns true when it was the Loom's key. */
  handleKey(e: KeyboardEvent, close: () => void): boolean;
}

const isTextField = (el: Element | null): boolean =>
  el instanceof HTMLTextAreaElement ||
  (el instanceof HTMLInputElement && el.type !== 'checkbox' && el.type !== 'range' && el.type !== 'button');

let rootEl: HTMLElement | null = null;
/**
 * How the player last drove the Loom. Tab moves focus only after keyboard navigation (arrow keys,
 * Tab, Enter or Space on a control); after a click it closes the Loom, like in play.
 * (:focus-visible can't tell: any keypress makes the focused control match it.)
 */
let modality: 'pointer' | 'keyboard' = 'pointer';

export function createLoom(session: Session): LoomController {
  injectLoomStyle();
  const st = new LoomState(session);
  const readout = createReadoutClient();
  // Measure what is being edited, whenever it is a working weave and the Loom is open.
  effect(() => {
    if (!st.open.value) return;
    const s = st.status;
    const spindle = st.loadout.value.spindleId;
    readout.request(s.kind === 'ok' ? readoutKey(s.notation, spindle) : null);
  });

  // Loadout changes from elsewhere (the dev console) show up in an open Loom. Deferred, so an
  // edit made by the Loom itself finishes before the check.
  effect(() => {
    void loadoutRev.value;
    queueMicrotask(() => {
      if (st.open.peek()) st.syncFromLoadout();
    });
  });
  window.addEventListener('pointerdown', () => (modality = 'pointer'), true);

  const handleKey = (e: KeyboardEvent, close: () => void): boolean => {
    const a = document.activeElement;
    const inside = !!rootEl && !!a && rootEl.contains(a) && a !== rootEl;
    if (inside && /^(Arrow\w+|Enter| )$/.test(e.key) && !isTextField(a)) modality = 'keyboard';
    if (e.key === 'Tab') {
      // Keyboard focus inside the Loom: Tab moves between controls. Otherwise it closes the Loom.
      // stopPropagation keeps the game's input sampler from swallowing the Tab.
      if (inside && modality === 'keyboard') {
        e.stopPropagation();
        return true;
      }
      e.preventDefault();
      close();
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (st.picker.peek()) st.picker.value = null;
      else if (st.refMenu.peek()) st.refMenu.value = false;
      else if (st.armed.peek()) st.armed.value = null;
      else close();
      return true;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !isTextField(a)) {
      const sel = st.selected.peek();
      if (sel) {
        e.preventDefault();
        st.remove(sel);
        return true;
      }
    }
    if (a === rootEl && /^Arrow/.test(e.key)) {
      e.preventDefault();
      modality = 'keyboard';
      document.getElementById(`lm-tab-${st.slot.peek()}`)?.focus();
      return true;
    }
    return false;
  };

  return { st, readout, handleKey };
}

export function LoomPanel({ loom, onClose }: { loom: LoomController; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { st } = loom;
  useEffect(() => {
    rootEl = ref.current;
    ref.current?.focus({ preventScroll: true });
    return () => {
      rootEl = null;
      tip.value = null;
    };
  }, []);
  return (
    <div
      class="lm-root"
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="The Loom, spell editor"
      onPointerDown={(e) => {
        const t = e.target as Element;
        if (!t.closest('.lm-pop, [data-keep-pop]')) {
          if (st.picker.peek()) st.picker.value = null;
          if (st.refMenu.peek()) st.refMenu.value = false;
        }
      }}
    >
      <div class="lm-card">
        <header class="lm-head">
          <div class="lm-title">
            <Emblem />
            <div>
              <h2>The Loom</h2>
              <p>Weave a spell from runes. The world waits while you work.</p>
            </div>
          </div>
          <div class="lm-head-acts">
            <button
              type="button"
              class="lm-btn"
              data-keep-pop
              aria-expanded={st.refMenu.value}
              aria-haspopup="menu"
              onClick={() => {
                st.picker.value = null;
                st.refMenu.value = !st.refMenu.peek();
              }}
            >
              Reference weaves ▾
            </button>
            <button type="button" class="lm-btn quiet" onClick={() => st.clearSlot()}>
              Clear slot
            </button>
            <button type="button" class="lm-btn close" onClick={onClose} aria-label="Close the Loom">
              Close <kbd>Tab</kbd>
            </button>
          </div>
        </header>
        <div class="lm-body">
          <Pouch st={st} />
          <section class="lm-center lm-panel" aria-label="Weave editor">
            <EditorColumn loom={loom} />
          </section>
          <Details st={st} readout={loom.readout.view.value} />
        </div>
      </div>
      <RefMenu st={st} />
      <Picker st={st} />
      <Tooltip />
    </div>
  );
}

function EditorColumn({ loom }: { loom: LoomController }) {
  const { st } = loom;
  return (
    <>
      <SlotTabs st={st} />
      <div class="lm-scroll lm-treewrap">
        <WeaveTreeView st={st} />
      </div>
      <NotationLine st={st} />
      <SlotStatusLine st={st} />
      <p class="lm-help">
        Pick a rune in the pouch, then click a lit spot, or drag it there. Click an empty spot or <b>+</b> to
        choose what fits. Click a placed rune to select it; <kbd>Del</kbd> removes it.
      </p>
    </>
  );
}
