/**
 * When the item-get panel opens: each 'elementUnlocked' event (src/sim/hero/events.ts) queues a
 * moment, due at once for a shrine and data/ui.ts `elementAfterBossSeconds` of sim time after a
 * boss (so his death plays first). The HUD asks for the next due moment every frame while the
 * player is in play, and builds its view from the hero's runes and weaves.
 */
import { signal, type Signal } from '@preact/signals';
import { uiTuning } from '../../../data/ui';
import type { RuneId } from '../../../data/runes';
import { SIM_HZ, type SimEvent } from '../../sim';
import { getLoadout, getRuneCounts, previewWeave, unlimitedRunes } from '../../app/loadout';
import type { Session } from '../../app/session';
import type { Screen } from '../hudBar';
import type { LoomState } from '../loom/loomState';
import { itemGetView, type ItemGetView } from './itemGetModel';

interface Pending {
  rune: RuneId;
  dueTick: number;
}

export interface ItemGet {
  /** The moment on screen, or null. */
  readonly view: { value: ItemGetView | null; peek(): ItemGetView | null };
  handleEvents(events: readonly SimEvent[]): void;
  /** The next moment due now (removed from the queue), or null. */
  due(): RuneId | null;
  /** The panel's view of `rune` for the current hero. */
  build(rune: RuneId): ItemGetView;
  /** Forgets queued moments (a reset or a new game). */
  clear(): void;
}

export function createItemGet(session: Session): ItemGet {
  const view = signal<ItemGetView | null>(null);
  let pending: Pending[] = [];
  const delay = Math.round(uiTuning.elementAfterBossSeconds * SIM_HZ);
  return {
    view,
    handleEvents(events) {
      for (const e of events) {
        if (e.type !== 'elementUnlocked' || session.state.mode !== 'adventure') continue;
        if (pending.some((p) => p.rune === e.rune)) continue;
        pending.push({ rune: e.rune, dueTick: session.state.tick + (e.source === 'boss' ? delay : 0) });
      }
    },
    due() {
      const t = session.state.tick;
      const i = pending.findIndex((p) => p.dueTick <= t);
      if (i < 0) return null;
      return pending.splice(i, 1)[0]!.rune;
    },
    build(rune) {
      return itemGetView(rune, {
        counts: getRuneCounts(session),
        unlimited: unlimitedRunes(session),
        slots: getLoadout(session).slots.map((s) => s.notation),
        fits: (notation, slot) => previewWeave(session, notation, slot).compiled?.ok === true,
      });
    },
    clear() {
      pending = [];
      view.value = null;
    },
  };
}

/** What opening and closing the panel needs from the HUD (src/ui/hud.tsx). */
export interface ItemGetHost {
  screen: Signal<Screen>;
  /** Pause the sim and turn player input off, as for the Loom and menus, showing 'itemGet'. */
  enterModal(): void;
  leaveModal(): void;
  openLoom(): void;
  loom: Pick<LoomState, 'selectSlot' | 'loadNotation' | 'armed'>;
  fanfare(): void;
  /** The hero's item-get pose (render). */
  holdRune(rune: RuneId | null): void;
}

/**
 * Opening the panel (from play: fanfare, pose) and closing it; `close(true)` goes on into the Loom
 * on the suggested slot with the new rune picked, a new weave's trigger and form already placed, so
 * the player's one click is placing the element.
 */
export function itemGetActions(
  ig: ItemGet,
  h: ItemGetHost,
): { open(rune: RuneId): void; close(toLoom: boolean): void } {
  return {
    open(rune) {
      if (h.screen.value !== 'play') return;
      ig.view.value = ig.build(rune);
      h.enterModal();
      h.fanfare();
      h.holdRune(rune);
    },
    close(toLoom) {
      if (h.screen.value !== 'itemGet') return;
      const v = ig.view.peek();
      ig.view.value = null;
      h.holdRune(null);
      h.leaveModal();
      if (!toLoom || !v) return;
      h.openLoom();
      const sg = v.suggestion;
      if (sg.slot >= 0) h.loom.selectSlot(sg.slot);
      if (sg.stub) h.loom.loadNotation(sg.stub);
      h.loom.armed.value = v.rune;
    },
  };
}
