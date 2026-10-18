/**
 * The player's weave slots and spindle, as the Loom editor, the HUD and the console see them.
 *
 * CONTRACT (M2): UI code calls only these functions and types. The runtime agent replaces the
 * bodies with the real thing (weaves live in sim state, edits apply between ticks and are
 * recorded for replays). Until then this is a STUB: it compiles weaves for validation and keeps
 * them in memory per session, without affecting the simulation.
 */
import { compileWeave, parseWeave, spindleContext, type CompileResult, type GameState } from '../sim';
import type { ParseError } from '../sim/weave/notation';
import { shipsThrough } from '../../data/runes';
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

/** Runes the M2 build offers (CONTENT §1 "Ships"). */
export const ALLOWED_SHIPS = shipsThrough('M2');

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

// ---- STUB state (replaced by the runtime agent) ----
interface StubLoadout {
  spindleId: SpindleId;
  notations: (string | null)[];
}
const stubs = new WeakMap<Session, StubLoadout>();
function stub(session: Session): StubLoadout {
  let s = stubs.get(session);
  if (!s) {
    s = { spindleId: 'twig', notations: ['Cast > Bolt[Fire]', 'Cast > Strike[]', null, null] };
    stubs.set(session, s);
  }
  return s;
}

function compileFor(spindleId: SpindleId, notation: string): WeavePreview {
  const parsed = parseWeave(notation);
  if (!parsed.ok) return { parseError: parsed.error };
  const ctx = spindleContext(spindles[spindleId], { allowShips: ALLOWED_SHIPS });
  return { compiled: compileWeave(parsed.tree, ctx) };
}

function slotView(spindleId: SpindleId, slot: number, notation: string | null): SlotView {
  const compiled = notation === null ? null : (compileFor(spindleId, notation).compiled ?? null);
  return {
    slot,
    label: SLOT_LABELS[slot]!,
    notation,
    compiled,
    automatic: compiled?.ok === true ? compiled.program.trigger.automatic : false,
  };
}
// ---- end STUB state ----

export function getLoadout(session: Session): LoadoutView {
  const s = stub(session);
  return {
    spindleId: s.spindleId,
    capacity: spindles[s.spindleId].capacity,
    slots: s.notations.map((n, i) => slotView(s.spindleId, i, n)),
  };
}

/** Compiles `notation` against the current spindle without changing anything (live editor validation). */
export function previewWeave(session: Session, notation: string): WeavePreview {
  return compileFor(stub(session).spindleId, notation);
}

/**
 * Puts a weave in a slot if it compiles (null empties the slot). Takes effect from the next tick and
 * is recorded for replays. An invalid weave changes nothing; the result explains why.
 */
export function setWeave(session: Session, slot: number, notation: string | null): SetWeaveResult {
  const s = stub(session);
  if (notation === null) {
    s.notations[slot] = null;
    return { applied: true, view: slotView(s.spindleId, slot, null) };
  }
  const p = compileFor(s.spindleId, notation);
  if (p.parseError)
    return {
      applied: false,
      view: slotView(s.spindleId, slot, s.notations[slot] ?? null),
      parseError: p.parseError,
    };
  if (!p.compiled!.ok)
    return {
      applied: false,
      view: slotView(s.spindleId, slot, s.notations[slot] ?? null),
      compiled: p.compiled,
    };
  s.notations[slot] = p.compiled!.program.notation;
  return { applied: true, view: slotView(s.spindleId, slot, s.notations[slot]!), compiled: p.compiled };
}

/**
 * Switches spindle. Weaves that no longer fit stay in their slots, show their error, and don't fire
 * until they fit again.
 */
export function setSpindle(session: Session, spindleId: SpindleId): void {
  stub(session).spindleId = spindleId;
}

/** Cooldown display for a slot's automatic trigger. */
export function slotTimers(_state: GameState, _slot: number): SlotTimers {
  return { cooldownLeft: 0, cooldownTotal: 0 };
}
