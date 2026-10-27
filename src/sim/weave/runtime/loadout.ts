/**
 * The player's weave slots and spindle, in sim state (`GameState.weaves`). Only notation
 * strings, the spindle, trigger timers and the bar state are real state (hashed); compiled
 * programs are derived from notation + spindle and rebuilt whenever either changes.
 *
 * Edits happen between ticks: the app records them (src/app/loadout.ts) and replays apply them
 * at the same tick (applyLoadoutEdit). An invalid weave never replaces a working one; a spindle
 * switch keeps weaves that no longer fit, which then don't fire until they fit (DECISIONS).
 *
 * Slots (runtime/slots.ts): bar 1 (0–3), R (4), bar 2 (5–8). Twin Threads (M7, CONTENT §11): R
 * is locked unless the hero owns the mutation. A locked slot takes no weave (setSlotWeave refuses
 * one with LOCKED_SLOT_MESSAGE), and a weave still in it (only a debug edit can leave one) doesn't
 * fire. The second bar (playtest 8): only the live bar's slots and R act (runtime/bars.ts).
 */
import type { TriggerEvent } from '../../../../data/runes';
import { spells, type SpellId } from '../../../../data/spells';
import { isSpindleId, type SpindleId } from '../../../../data/spindles';
import type { Tuning } from '../../../../data/tuning';
import type { GameState } from '../../state';
import { compileWeave, type CompileResult } from '../compile';
import { parseWeave } from '../notation';
import type { SpellProgram } from '../program';
import type { WeaveTree } from '../tree';
import { NO_RULES, sameRules, type CompileRules } from '../rules';
import { cancelCast } from './castState';
import { assignRunes, runeLevelMap, runeQualityMap, usesRuneItems } from '../../hero/runes';
import { previewFor, stateContext, type WeavePreview } from './loadoutContext';
import { actingSlots, LOADOUT_SLOTS, LOCKED_SLOT_MESSAGE, slotOpen } from './slots';

export {
  BAR_SLOTS,
  BASE_SLOTS,
  barOf,
  LOADOUT_SLOTS,
  LOCKED_SLOT_MESSAGE,
  actingSlots,
  liveSlots,
  openSlotCount,
  slotOpen,
  TWIN_SLOT,
} from './slots';

/** Button for each slot, in slot order. */
export { SLOT_BUTTONS } from './channel';

export { RUNTIME_SHIPS } from './ships';
export { compileContextFor, previewFor, stateContext, type WeavePreview } from './loadoutContext';

/** The starting loadout: Fire Bolt on LMB, Strike on RMB, Twig Spindle (CONTENT §9.1). */
export const DEFAULT_LOADOUT: LoadoutSpec = {
  spindleId: 'twig',
  capacity: null,
  notations: ['Cast > Bolt[Fire]', 'Cast > Strike[]', null, null, null],
};

export interface WeaveSlot {
  /** The weave's canonical notation, or null when the slot is empty. Hashed. */
  notation: string | null;
  /** Compiled against the current spindle; null when empty or when it doesn't compile. Derived. */
  program: SpellProgram | null;
  /** Full compile result for the Loom (null when empty or unparsable). Derived. */
  compiled: CompileResult | null;
  /** Why a non-empty slot can't fire (parse or compile message), else null. Derived. */
  error: string | null;
  /** Seconds left on the trigger's internal cooldown. Hashed. */
  cooldownLeft: number;
  /** Pulse: seconds until the next pulse (0 or less: on the next tick). Hashed. */
  periodLeft: number;
  /**
   * Adventure mode: uids of the rune items socketed in this weave, in rune order
   * (hero/runes.ts runeOrder). Null for empty slots and in sandbox, arena and lab games, whose
   * runes are unlimited. Hashed when present.
   */
  runes: number[] | null;
}

export interface WeaveLoadout {
  spindleId: SpindleId;
  /** Capacity override (dev test_spindle), or null for the spindle's own. */
  capacity: number | null;
  slots: WeaveSlot[];
  /** The live weave bar: 0 (slots 0–3) or 1 (slots 5–8); R is live on both. Hashed and saved. */
  activeBar: number;
  /** Seconds left of the swap lockout: the new bar's slots don't act until it is 0. Hashed. */
  swapLeft: number;
  /**
   * Passive and Fuse rules every slot is compiled with (weave/rules.ts). Derived from HeroMods
   * by refreshHero (setCompileRules); not hashed. NO_RULES without passives or parts.
   */
  rules: Readonly<CompileRules>;
}

/** A loadout as plain data, for new games and replays. */
export interface LoadoutSpec {
  spindleId: SpindleId;
  capacity?: number | null;
  /** One per slot; missing entries are empty. */
  notations: readonly (string | null)[];
  /** Adventure mode: socketed rune uids per slot (WeaveSlot.runes). Absent means none anywhere. */
  runes?: readonly (readonly number[] | null)[];
  /** The live weave bar (WeaveLoadout.activeBar); absent means bar 1 (0). */
  activeBar?: number;
}

/**
 * One Loom edit, applied between ticks: before stepping tick `tick + 1`, i.e. when
 * `state.tick === tick`. 'weave': `slot` gets `value` (null empties it). 'spindle': `value` is
 * the spindle id.
 */
export interface LoadoutEdit {
  tick: number;
  kind: 'weave' | 'spindle';
  slot?: number;
  value: string | null;
}

/** M1-era slot contents for the legacy HUD: an M1 spell id per slot, or null. Derived. */
export type Loadout = (SpellId | null)[];

/** A weave planned for a slot: what it compiles to and, in adventure mode, the rune items it would socket. */
interface WeavePlan {
  preview: WeavePreview;
  runes: number[] | null;
}

/** Compiles a parsed tree for the state, with the levels of the given socketed items. */
function compileTree(state: GameState, tree: WeaveTree, runes: readonly number[] | null): CompileResult {
  const ctx = stateContext(state);
  if (runes) {
    ctx.runeLevels = runeLevelMap(state, tree, runes);
    const q = runeQualityMap(state, tree, runes);
    if (q) ctx.runeQualities = q;
  }
  return compileWeave(tree, ctx);
}

/**
 * Parses and compiles `notation` for `slot` (-1: no slot), and in adventure mode picks the rune
 * items it would socket. A rune the hero doesn't have enough free items of fails like a compile
 * error ("Needs 2 Fire runes; you have 1 free"), after the compiler's own checks.
 */
function planWeave(state: GameState, slot: number, notation: string): WeavePlan {
  const parsed = parseWeave(notation);
  if (!parsed.ok) return { preview: { parseError: parsed.error }, runes: null };
  const plain = compileTree(state, parsed.tree, null);
  if (!plain.ok || !usesRuneItems(state)) return { preview: { compiled: plain }, runes: null };
  const a = assignRunes(state, parsed.tree, slot);
  if (!a.ok) {
    const failed: CompileResult = {
      ok: false,
      error: { message: a.message, path: a.path },
      costs: plain.costs,
    };
    return { preview: { compiled: failed }, runes: null };
  }
  return { preview: { compiled: compileTree(state, parsed.tree, a.uids) }, runes: a.uids };
}

/**
 * Compiles `notation` against the state's current spindle and character without changing
 * anything. In adventure mode it also checks the hero has the rune items, counting the items
 * already in `slot` as free (default: no slot, so only pouch items count).
 */
export function previewWeave(state: GameState, notation: string, slot = -1): WeavePreview {
  return planWeave(state, slot, notation).preview;
}

function emptySlot(): WeaveSlot {
  return {
    notation: null,
    program: null,
    compiled: null,
    error: null,
    cooldownLeft: 0,
    periodLeft: 0,
    runes: null,
  };
}

/** Recomputes a slot's derived fields from its notation, without a character (createWeaveLoadout). */
function compileSlot(w: WeaveLoadout, tuning: Tuning, slot: WeaveSlot): void {
  slot.program = slot.compiled = slot.error = null;
  if (slot.notation === null) return;
  const p = previewFor(w.spindleId, w.capacity, tuning, slot.notation, w.rules);
  if (p.parseError) {
    slot.error = p.parseError.message;
    return;
  }
  const c = p.compiled!;
  slot.compiled = c;
  if (c.ok) slot.program = c.program;
  else slot.error = c.error.message;
}

/**
 * Recomputes a slot's derived fields for the state's spindle, character and socketed rune
 * levels. In adventure mode a weave without socketed runes doesn't fire, and nothing in a locked
 * slot does.
 */
function compileStateSlot(state: GameState, slot: WeaveSlot, index: number): void {
  slot.program = slot.compiled = slot.error = null;
  if (slot.notation === null) return;
  if (!slotOpen(state, index)) {
    slot.error = LOCKED_SLOT_MESSAGE;
    return;
  }
  const parsed = parseWeave(slot.notation);
  if (!parsed.ok) {
    slot.error = parsed.error.message;
    return;
  }
  const c = compileTree(state, parsed.tree, slot.runes);
  slot.compiled = c;
  if (!c.ok) slot.error = c.error.message;
  else if (usesRuneItems(state) && slot.runes === null) slot.error = 'No runes are socketed in this weave';
  else slot.program = c.program;
}

/** Recompiles the given slots (default: all) after the character, spindle or rune levels changed. Timers keep running. */
export function recompileWeaves(state: GameState, slots?: readonly number[]): void {
  const w = state.weaves;
  for (let i = 0; i < w.slots.length; i++)
    if (!slots || slots.includes(i)) compileStateSlot(state, w.slots[i]!, i);
  state.loadout = legacyLoadout(w);
}

/** A new weave is ready at once: no ICD, and a Pulse fires on the next tick it finds a target. */
function resetTimers(slot: WeaveSlot): void {
  slot.cooldownLeft = 0;
  slot.periodLeft = 0;
}

/**
 * A loadout from plain data. Notations are stored as given (canonical when they compile); ones
 * that don't compile stay in their slot with their error.
 */
export function createWeaveLoadout(
  spec: LoadoutSpec,
  tuning: Tuning,
  rules: Readonly<CompileRules> = NO_RULES,
): WeaveLoadout {
  const w: WeaveLoadout = {
    spindleId: spec.spindleId,
    capacity: spec.capacity ?? null,
    slots: [],
    activeBar: spec.activeBar === 1 ? 1 : 0,
    swapLeft: 0,
    rules,
  };
  for (let i = 0; i < LOADOUT_SLOTS; i++) {
    const slot = emptySlot();
    slot.notation = spec.notations[i] ?? null;
    const runes = spec.runes?.[i];
    slot.runes = slot.notation !== null && runes ? [...runes] : null;
    compileSlot(w, tuning, slot);
    if (slot.program) slot.notation = slot.program.notation;
    resetTimers(slot);
    w.slots.push(slot);
  }
  return w;
}

/** The loadout as plain data (for new games after a reset, and replay files). */
export function loadoutSpecOf(w: WeaveLoadout): LoadoutSpec {
  const spec: LoadoutSpec = {
    spindleId: w.spindleId,
    capacity: w.capacity,
    notations: w.slots.map((s) => s.notation),
  };
  if (w.slots.some((s) => s.runes !== null)) spec.runes = w.slots.map((s) => (s.runes ? [...s.runes] : null));
  if (w.activeBar !== 0) spec.activeBar = w.activeBar;
  return spec;
}

/**
 * Replaces the whole loadout (new game, replays, loading a save), with the spec's live bar and no
 * swap lockout. Cancels any cast. Socketed rune uids in the spec are taken as given
 * (src/sim/save.ts validates saves).
 */
export function applyLoadoutSpec(state: GameState, spec: LoadoutSpec): void {
  cancelCast(state);
  state.weaves = createWeaveLoadout(spec, state.tuning, state.weaves.rules);
  recompileWeaves(state);
}

/**
 * Sets the passive and Fuse compile rules (refreshHero, through hero/effects.ts). When they
 * change, every slot is recompiled like a spindle switch: weaves that no longer fit keep their
 * notation and error and don't fire. Timers keep running. No change, no recompile.
 */
export function setCompileRules(state: GameState, rules: Readonly<CompileRules>): void {
  const w = state.weaves;
  if (sameRules(w.rules, rules)) return;
  w.rules = rules;
  recompileWeaves(state);
}

export interface SetWeaveOutcome {
  applied: boolean;
  preview: WeavePreview;
}

/** The refusal setSlotWeave gives for a weave in a locked slot, shaped like a compile error. */
function lockedPreview(): WeavePreview {
  return { compiled: { ok: false, error: { message: LOCKED_SLOT_MESSAGE, path: [] } } };
}

/**
 * Puts a weave in a slot if it parses and compiles on the current spindle (null empties it).
 * Resets the slot's trigger timers and cancels a cast from that slot. Otherwise changes nothing.
 * A locked slot (Twin Threads) refuses every weave with LOCKED_SLOT_MESSAGE; emptying it works.
 */
export function setSlotWeave(state: GameState, slot: number, notation: string | null): SetWeaveOutcome {
  if (!Number.isInteger(slot) || slot < 0 || slot >= LOADOUT_SLOTS) throw new Error(`No weave slot ${slot}`);
  if (notation !== null && !slotOpen(state, slot)) return { applied: false, preview: lockedPreview() };
  const plan: WeavePlan = notation === null ? { preview: {}, runes: null } : planWeave(state, slot, notation);
  const preview = plan.preview;
  if (notation !== null && (preview.parseError || !preview.compiled!.ok)) return { applied: false, preview };
  if (state.player.castSlot === slot) cancelCast(state);
  const s = state.weaves.slots[slot]!;
  s.notation = preview.compiled?.ok ? preview.compiled.program.notation : null;
  s.runes = plan.runes;
  compileStateSlot(state, s, slot);
  resetTimers(s);
  state.loadout = legacyLoadout(state.weaves);
  return { applied: true, preview };
}

/**
 * Switches spindle (and Capacity override). Every slot is recompiled; weaves that no longer fit
 * keep their notation and error and don't fire. Cancels any cast. Timers keep running.
 */
export function setLoadoutSpindle(
  state: GameState,
  spindleId: SpindleId,
  capacity: number | null = null,
): void {
  cancelCast(state);
  const w = state.weaves;
  w.spindleId = spindleId;
  w.capacity = capacity;
  recompileWeaves(state);
}

/**
 * Applies one recorded edit. Returns false if it was rejected (invalid weave or spindle). In
 * adventure mode the spindle follows the equipped spindle item (HeroEdit 'equip'), so 'spindle'
 * edits are rejected.
 */
export function applyLoadoutEdit(state: GameState, edit: LoadoutEdit): boolean {
  if (edit.kind === 'spindle') {
    if (usesRuneItems(state)) return false;
    if (edit.value === null || !isSpindleId(edit.value)) return false;
    setLoadoutSpindle(state, edit.value, state.weaves.capacity);
    return true;
  }
  return setSlotWeave(state, edit.slot ?? 0, edit.value).applied;
}

/** True if some acting slot's working weave fires on `event` (the live bar and R; runtime/slots.ts). */
export function listensFor(state: GameState, event: TriggerEvent): boolean {
  const w = state.weaves;
  for (const i of actingSlots(w)) if (w.slots[i]!.program?.trigger.event === event) return true;
  // Extra weaves from Fuse parts (Cinder Heart; hero/effects.ts).
  for (const s of state.heroFx.bonus) if (s.program?.trigger.event === event) return true;
  return false;
}

const LEGACY: readonly SpellId[] = ['fire_bolt', 'strike'];

/** The derived M1 view of the slots (`GameState.loadout`): an M1 spell where the weave is exactly one. */
export function legacyLoadout(w: WeaveLoadout): Loadout {
  return w.slots.map((s) => {
    if (s.program === null) return null;
    return LEGACY.find((id) => spells[id].notation === s.notation) ?? null;
  });
}
