/**
 * The Loom editor's state and actions, as signals. Holds one draft tree per slot; a draft that
 * compiles is applied to its slot at once (through loadoutStore → setWeave), one that doesn't
 * stays in the editor ("held") while the slot keeps its working weave.
 */
import { batch, signal, type Signal } from '@preact/signals';
import { getLoadout, previewWeave, type LoadoutView } from '../../app/loadout';
import type { Session } from '../../app/session';
import { parseWeave, printWeave, type ParseError } from '../../sim/weave/notation';
import type { SpellProgram, WeaveCosts } from '../../sim/weave/program';
import type { WeavePath, WeaveTree } from '../../sim/weave/tree';
import type { RuneId } from '../../../data/runes';
import type { SpindleId } from '../../../data/spindles';
import { applySpindle, applyWeave, loadoutRev } from './loadoutStore';
import { emptyTree, firstEmpty, isBlank, placeRune, removeAt, type Placement, type Spot } from './model';

export type SlotStatus =
  | { kind: 'empty'; applied: boolean }
  | { kind: 'incomplete'; message: string; path: WeavePath; applied: false }
  | {
      kind: 'invalid';
      notation: string;
      message: string;
      path: WeavePath;
      costs: WeaveCosts | null;
      /** True when this is the slot's live weave (it stopped fitting, e.g. after a spindle switch). */
      applied: boolean;
    }
  | { kind: 'ok'; notation: string; program: SpellProgram; costs: WeaveCosts; applied: true };

/** A popover anchored at a screen rectangle. */
export interface Anchor {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SLOTS = 4;

function treeOf(notation: string | null): WeaveTree {
  if (notation === null) return emptyTree();
  const p = parseWeave(notation);
  return p.ok ? p.tree : emptyTree();
}

export class LoomState {
  readonly open = signal(false);
  readonly slot = signal(0);
  readonly loadout: Signal<LoadoutView>;
  readonly drafts = signal<WeaveTree[]>([]);
  readonly statuses = signal<SlotStatus[]>([]);
  /** The rune picked in the pouch, waiting for a spot. */
  readonly armed = signal<RuneId | null>(null);
  /** The rune being dragged from the pouch. */
  readonly dragging = signal<RuneId | null>(null);
  readonly selected = signal<WeavePath | null>(null);
  /** Notation text while the player edits it; null shows the draft's notation. */
  readonly text = signal<string | null>(null);
  readonly parseError = signal<ParseError | null>(null);
  readonly search = signal('');
  /** Spot-first picker: the spot key and where to show it. */
  readonly picker = signal<{ key: string; spot: Spot | null; path: WeavePath | null; at: Anchor } | null>(
    null,
  );
  readonly refMenu = signal(false);
  /** Live notation per slot when its draft was last synced from it. */
  private synced: (string | null)[] = [];
  private held: boolean[] = [];
  private seenRev = -1;

  constructor(private readonly session: Session) {
    this.loadout = signal(getLoadout(session));
    this.syncFromLoadout(true);
  }

  /** The rune whose valid spots light up: the dragged one, else the armed one. */
  get activeRune(): RuneId | null {
    return this.dragging.value ?? this.armed.value;
  }

  get draft(): WeaveTree {
    return this.drafts.value[this.slot.value] ?? emptyTree();
  }

  get status(): SlotStatus {
    return this.statuses.value[this.slot.value] ?? { kind: 'empty', applied: true };
  }

  /** Re-reads the loadout; drafts that weren't edited follow their slot's live weave. */
  syncFromLoadout(force = false): void {
    if (!force && this.seenRev === loadoutRev.peek()) return;
    this.seenRev = loadoutRev.peek();
    const l = getLoadout(this.session);
    const drafts = this.drafts.peek().slice();
    const statuses = this.statuses.peek().slice();
    for (let i = 0; i < SLOTS; i++) {
      const live = l.slots[i]?.notation ?? null;
      if (force || (!this.held[i] && this.synced[i] !== live) || drafts[i] === undefined) {
        drafts[i] = treeOf(live);
        this.synced[i] = live;
        this.held[i] = false;
      }
    }
    batch(() => {
      this.loadout.value = l;
      this.drafts.value = drafts;
      drafts.forEach((t, i) => (statuses[i] = this.evaluate(i, t, l)));
      this.statuses.value = statuses;
    });
  }

  /** Validates a draft against the current spindle (no side effects). */
  private evaluate(slot: number, tree: WeaveTree, l: LoadoutView): SlotStatus {
    const live = l.slots[slot]?.notation ?? null;
    if (isBlank(tree)) return { kind: 'empty', applied: live === null };
    const gap = firstEmpty(tree);
    if (gap) return { kind: 'incomplete', message: gap.message, path: gap.path, applied: false };
    const notation = printWeave(tree);
    const pv = previewWeave(this.session, notation);
    if (pv.parseError)
      return {
        kind: 'invalid',
        notation,
        message: pv.parseError.message,
        path: [],
        costs: null,
        applied: false,
      };
    const c = pv.compiled!;
    if (c.ok)
      return { kind: 'ok', notation: c.program.notation, program: c.program, costs: c.costs, applied: true };
    return {
      kind: 'invalid',
      notation,
      message: c.error.message,
      path: c.error.path,
      costs: c.costs ?? null,
      applied: live === notation,
    };
  }

  /** Replaces the current slot's draft; applies it when it compiles (or empties the slot when blank). */
  setDraft(
    tree: WeaveTree,
    selected: WeavePath | null = this.selected.peek(),
    slot = this.slot.peek(),
  ): void {
    const l0 = getLoadout(this.session);
    let status = this.evaluate(slot, tree, l0);
    const live = l0.slots[slot]?.notation ?? null;
    if (status.kind === 'ok' && live !== status.notation) applyWeave(this.session, slot, status.notation);
    else if (status.kind === 'empty' && live !== null) applyWeave(this.session, slot, null);
    const l = getLoadout(this.session);
    if (status.kind !== 'ok' && status.kind !== 'empty') status = this.evaluate(slot, tree, l);
    this.seenRev = loadoutRev.peek();
    this.synced[slot] = l.slots[slot]?.notation ?? null;
    this.held[slot] = status.kind !== 'ok' && status.kind !== 'empty';
    batch(() => {
      const drafts = this.drafts.peek().slice();
      drafts[slot] = tree;
      this.drafts.value = drafts;
      const st = this.statuses.peek().slice();
      st[slot] = status;
      // Other slots may change validity only on a spindle switch; their statuses stay.
      this.statuses.value = st;
      this.loadout.value = l;
      this.selected.value = selected;
    });
  }

  place(p: Placement, rune: RuneId): void {
    if (!p.ok) return;
    const r = placeRune(this.draft, p.spot, rune);
    batch(() => {
      this.text.value = null;
      this.parseError.value = null;
      this.armed.value = null;
      this.picker.value = null;
      this.setDraft(r.tree, r.selected);
    });
  }

  remove(path: WeavePath): void {
    const r = removeAt(this.draft, path);
    batch(() => {
      this.text.value = null;
      this.parseError.value = null;
      this.setDraft(r.tree, r.selected);
    });
  }

  selectSlot(slot: number): void {
    if (slot === this.slot.peek()) return;
    batch(() => {
      this.slot.value = slot;
      this.selected.value = null;
      this.text.value = null;
      this.parseError.value = null;
      this.picker.value = null;
    });
  }

  /** Typing in the notation line: the tree follows whenever the text parses. */
  typeNotation(text: string): void {
    const p = parseWeave(text);
    batch(() => {
      this.text.value = text;
      if (p.ok) {
        this.parseError.value = null;
        this.setDraft(p.tree, null);
      } else if (text.trim() === '') {
        this.parseError.value = null;
        this.setDraft(emptyTree(), null);
      } else {
        this.parseError.value = p.error;
      }
    });
  }

  /** Leaving the notation line: show the canonical form again if it parsed. */
  commitNotation(): void {
    if (this.parseError.peek() === null) this.text.value = null;
  }

  loadNotation(notation: string): void {
    const p = parseWeave(notation);
    if (!p.ok) return;
    batch(() => {
      this.text.value = null;
      this.parseError.value = null;
      this.refMenu.value = false;
      this.setDraft(p.tree, null);
    });
  }

  /** Puts the slot's live weave back into the editor. */
  revert(): void {
    const live = getLoadout(this.session).slots[this.slot.peek()]?.notation ?? null;
    batch(() => {
      this.text.value = null;
      this.parseError.value = null;
      this.setDraft(treeOf(live), null);
    });
  }

  clearSlot(): void {
    batch(() => {
      this.text.value = null;
      this.parseError.value = null;
      this.setDraft(emptyTree(), null);
    });
  }

  setSpindle(id: SpindleId): void {
    applySpindle(this.session, id);
    // Validity depends on Capacity: held drafts that now compile get applied, and every slot is
    // re-checked (a live weave that no longer fits stays, but shows why it doesn't fire).
    const slot = this.slot.peek();
    this.drafts.peek().forEach((t, i) => {
      if (this.held[i]) this.setDraft(t, i === slot ? this.selected.peek() : null, i);
    });
    const l = getLoadout(this.session);
    this.seenRev = loadoutRev.peek();
    batch(() => {
      this.loadout.value = l;
      this.statuses.value = this.drafts.peek().map((t, i) => this.evaluate(i, t, l));
    });
  }

  disarm(): void {
    batch(() => {
      this.armed.value = null;
      this.picker.value = null;
    });
  }
}
