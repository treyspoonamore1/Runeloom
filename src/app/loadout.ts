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
  openSlotCount,
  type CompileResult,
  type GameState,
} from '../sim';
import type { ParseError } from '../sim/weave/notation';
import { spindles, type SpindleId } from '../../data/spindles';
import type { RuneId } from '../../data/runes';
import { assignRunes, runeCounts, usesRuneItems } from '../sim/hero/runes';
import { parseWeave } from '../sim/weave/notation';
import type { HeroState } from '../sim/hero/types';
import type { RuneItem } from '../sim/hero/types';
import type { Session } from './session';

/** Button label per slot, in slot order. R is Twin Threads' fifth slot, open only with the mutation. */
export const SLOT_LABELS = ['LMB', 'RMB', 'Q', 'E', 'R'] as const;

/** Spindles the sandbox lets the player pick (DECISIONS: M2 sandbox loadout; Loomsteel from M5). */
export const SANDBOX_SPINDLES: readonly SpindleId[] = [
  'twig',
  'ashwood',
  'rimeglass',
  'ironbark',
  'heartwood',
  'loomsteel',
];

/** Runes the build offers (CONTENT §1 "Ships": M2, M5 and M7); the sim compiles with the same set. */
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
  /**
   * The open slots, in slot order (`slots[i].slot === i`): four, or five with the Twin Threads
   * mutation (R). The HUD and the Loom show exactly these.
   */
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
    capacity: (w.capacity ?? spindles[w.spindleId].capacity) + session.state.heroMods.capacityAdd,
    slots: w.slots.slice(0, openSlotCount(session.state)).map((_, i) => slotView(session.state, i)),
  };
}

/**
 * Compiles `notation` against the current spindle and character without changing anything (live
 * editor validation). In adventure mode it also checks the hero owns enough free rune items
 * ("Needs 2 Fire runes; you have 1 free"), counting the runes already in `slot` (the slot being
 * edited) as free.
 */
export function previewWeave(session: Session, notation: string, slot = -1): WeavePreview {
  return simPreview(session.state, notation, slot);
}

/**
 * True when every rune is unlimited (sandbox, arena, lab). False in adventure mode, where weaves
 * use the hero's rune items and the Loom offers only unlocked runes.
 */
export function unlimitedRunes(session: Session): boolean {
  return !usesRuneItems(session.state);
}

/** Owned rune items per rune id. `free`: in the pouch, or in `slot` when given (the slot being edited). */
export type RuneCounts = Partial<Record<RuneId, { free: number; total: number }>>;

/** Rune item counts for the Loom's palette (adventure mode); empty when runes are unlimited. */
export function getRuneCounts(session: Session, slot = -1): RuneCounts {
  return usesRuneItems(session.state) ? runeCounts(session.state, slot) : {};
}

/** Runes the hero has unlocked, sorted (adventure mode); random drops come only from these. */
export function getUnlockedRunes(session: Session): readonly RuneId[] {
  return session.state.hero.unlockedRunes;
}

/**
 * Adventure mode: the character fields for runReadout's input (ReadoutInput.hero and .runes), so
 * the Loom's DPS readout counts gear, passives and the levels of the rune items `notation` would
 * socket in `slot`. Empty in other modes or when the hero lacks the runes.
 */
export function readoutCharacter(
  session: Session,
  notation: string,
  slot: number,
): { hero?: HeroState; runes?: number[] } {
  const state = session.state;
  if (!usesRuneItems(state)) return {};
  const parsed = parseWeave(notation);
  if (!parsed.ok) return {};
  const a = assignRunes(state, parsed.tree, slot);
  return a.ok ? { hero: structuredClone(state.hero), runes: a.uids } : {};
}

/** The rune items socketed in a slot's weave, in rune order (empty when runes are unlimited or the slot is empty). */
export function slotRuneItems(session: Session, slot: number): RuneItem[] {
  const uids = session.state.weaves.slots[slot]?.runes ?? [];
  const byUid = new Map(session.state.hero.runes.map((r) => [r.uid, r]));
  return uids.map((u) => byUid.get(u)).filter((r): r is RuneItem => r !== undefined);
}

/**
 * Puts a weave in a slot if it compiles (null empties the slot). Takes effect from the next tick and
 * is recorded for replays. An invalid weave changes nothing; the result explains why.
 */
export function setWeave(session: Session, slot: number, notation: string | null): SetWeaveResult {
  // In adventure mode the weave sockets the hero's rune items (highest level first); a weave the
  // hero lacks runes for fails with compiled.error explaining which.
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
 * until they fit again. Recorded for replays. Does nothing in adventure mode, where the spindle is
 * the equipped spindle item (src/app/hero.ts, HeroEdit 'equip').
 */
export function setSpindle(session: Session, spindleId: SpindleId): void {
  const state = session.state;
  if (usesRuneItems(state)) return;
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
