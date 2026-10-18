/**
 * The player's weave slots and spindle, as the Loom editor, the HUD and the console see them.
 *
 * CONTRACT (M2): UI code calls only these functions and types. Weaves live in sim state
 * (`GameState.weaves`, src/sim/weave/runtime/loadout.ts); edits apply between ticks, take effect
 * from the next tick, and are recorded in the Session (`loadoutEdits`) so replays reproduce them.
 * They don't mark the session edited.
 */
import {
  previewWeave as simPreview,
  RUNTIME_SHIPS,
  setLoadoutSpindle,
  setSlotWeave,
  type CompileResult,
  type GameState,
} from '../sim';
import type { ParseError } from '../sim/weave/notation';
import { spindles, type SpindleId } from '../../data/spindles';
import type { Session } from './session';

/** Button label per slot, in slot order. */
export const SLOT_LABELS = ['LMB', 'RMB', 'Q', 'E'] as const;

/** Spindles the M2 sandbox lets the player pick (DECISIONS: M2 sandbox loadout). */
export const SANDBOX_SPINDLES: readonly SpindleId[] = [
  'twig',
  'ashwood',
  'rimeglass',
  'ironbark',
  'heartwood',
];

/** Runes the M2 build offers (CONTENT §1 "Ships"); the sim compiles with the same set. */
export const ALLOWED_SHIPS = RUNTIME_SHIPS;

export interface SlotView {
  slot: number;
  label: (typeof SLOT_LABELS)[number];
  /** Canonical notation of the weave in the slot, or null when the slot is empty. */
  notation: string | null;
  /** The slot's weave compiled against the current spindle; null when empty. */
  compiled: CompileResult | null;
  /** True when the weave fires on its own (Pulse, On Dodge, …); the slot button does nothing. */
  automatic: boolean;
}

export interface LoadoutView {
  spindleId: SpindleId;
  /** Capacity of the current spindle (plus Loom Shards from M4). */
  capacity: number;
  slots: SlotView[];
}

/** Cooldown display for a slot: ICD or Pulse period counting down. Both 0 when ready or not applicable. */
export interface SlotTimers {
  cooldownLeft: number;
  cooldownTotal: number;
}

export interface SetWeaveResult {
  /** True if the slot now holds the weave (valid, or null to empty it). */
  applied: boolean;
  /** The slot after the call. When not applied, the slot keeps its previous weave. */
  view: SlotView;
  /** Set when the text didn't parse. */
  parseError?: ParseError;
  /** Set when it parsed but didn't compile. */
  compiled?: CompileResult;
}

export interface WeavePreview {
  parseError?: ParseError;
  compiled?: CompileResult;
}

function slotView(state: GameState, slot: number): SlotView {
  const s = state.weaves.slots[slot]!;
  return {
    slot,
    label: SLOT_LABELS[slot]!,
    notation: s.notation,
    compiled: s.compiled,
    automatic: s.compiled?.ok === true ? s.compiled.program.trigger.automatic : false,
  };
}

export function getLoadout(session: Session): LoadoutView {
  const w = session.state.weaves;
  return {
    spindleId: w.spindleId,
    capacity: w.capacity ?? spindles[w.spindleId].capacity,
    slots: w.slots.map((_, i) => slotView(session.state, i)),
  };
}

/** Compiles `notation` against the current spindle without changing anything (live editor validation). */
export function previewWeave(session: Session, notation: string): WeavePreview {
  return simPreview(session.state, notation);
}

/**
 * Puts a weave in a slot if it compiles (null empties the slot). Takes effect from the next tick and
 * is recorded for replays. An invalid weave changes nothing; the result explains why.
 */
export function setWeave(session: Session, slot: number, notation: string | null): SetWeaveResult {
  const state = session.state;
  const out = setSlotWeave(state, slot, notation);
  const result: SetWeaveResult = { applied: out.applied, view: slotView(state, slot) };
  if (out.preview.parseError) result.parseError = out.preview.parseError;
  if (out.preview.compiled) result.compiled = out.preview.compiled;
  if (out.applied)
    session.recordLoadoutEdit({
      tick: state.tick,
      kind: 'weave',
      slot,
      value: state.weaves.slots[slot]!.notation,
    });
  return result;
}

/**
 * Switches spindle. Weaves that no longer fit stay in their slots, show their error, and don't fire
 * until they fit again. Recorded for replays.
 */
export function setSpindle(session: Session, spindleId: SpindleId): void {
  const state = session.state;
  setLoadoutSpindle(state, spindleId);
  session.recordLoadoutEdit({ tick: state.tick, kind: 'spindle', value: spindleId });
}

/** Cooldown display for a slot's automatic trigger: the ICD after an event trigger fires, or Pulse's period. */
export function slotTimers(state: GameState, slot: number): SlotTimers {
  const s = state.weaves.slots[slot];
  const tr = s?.program?.trigger;
  if (!s || !tr) return { cooldownLeft: 0, cooldownTotal: 0 };
  if (tr.event === 'interval' && tr.period !== null)
    return { cooldownLeft: s.periodLeft > 0 ? s.periodLeft : 0, cooldownTotal: tr.period };
  if (s.cooldownLeft > 0) return { cooldownLeft: s.cooldownLeft, cooldownTotal: tr.icd };
  return { cooldownLeft: 0, cooldownTotal: 0 };
}
