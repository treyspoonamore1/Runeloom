/**
 * The player's four weave slots and spindle, in sim state (`GameState.weaves`). Only notation
 * strings, the spindle and trigger timers are real state (hashed); compiled programs are derived
 * from notation + spindle and rebuilt whenever either changes.
 *
 * Edits happen between ticks: the app records them (src/app/loadout.ts) and replays apply them
 * at the same tick (applyLoadoutEdit). An invalid weave never replaces a working one; a spindle
 * switch keeps weaves that no longer fit, which then don't fire until they fit (DECISIONS).
 */
import { shipsThrough, type TriggerEvent } from '../../../../data/runes';
import { spells, type SpellId } from '../../../../data/spells';
import { isSpindleId, spindles, type SpindleId } from '../../../../data/spindles';
import type { Tuning } from '../../../../data/tuning';
import { Button } from '../../core/input';
import type { GameState } from '../../state';
import { compileWeave, type CompileResult } from '../compile';
import { spindleContext, type CompileContext } from '../context';
import { parseWeave, type ParseError } from '../notation';
import type { SpellProgram } from '../program';
import { NO_RULES, sameRules, type CompileRules } from '../rules';
import { cancelCast } from './castState';

/** Number of weave slots (LMB, RMB, Q, E). */
export const LOADOUT_SLOTS = 4;

/** Button for each slot, in slot order. */
export const SLOT_BUTTONS: readonly number[] = [Button.Cast1, Button.Cast2, Button.Cast3, Button.Cast4];

/** Runes the sim accepts (CONTENT §1 "Ships"): M2. */
export const RUNTIME_SHIPS = shipsThrough('M2');

/** The starting loadout: Fire Bolt on LMB, Strike on RMB, Twig Spindle (CONTENT §9.1). */
export const DEFAULT_LOADOUT: LoadoutSpec = {
  spindleId: 'twig',
  capacity: null,
  notations: ['Cast > Bolt[Fire]', 'Cast > Strike[]', null, null],
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
}

export interface WeaveLoadout {
  spindleId: SpindleId;
  /** Capacity override (dev test_spindle), or null for the spindle's own. */
  capacity: number | null;
  slots: WeaveSlot[];
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

export interface WeavePreview {
  parseError?: ParseError;
  compiled?: CompileResult;
}

/** M1-era slot contents for the legacy HUD: an M1 spell id per slot, or null. Derived. */
export type Loadout = (SpellId | null)[];

/** The compile context for a loadout's spindle (and Capacity override). */
export function compileContextFor(
  spindleId: SpindleId,
  capacity: number | null,
  tuning: Tuning,
  rules: Readonly<CompileRules> = NO_RULES,
): CompileContext {
  const ctx = spindleContext(spindles[spindleId], { allowShips: RUNTIME_SHIPS });
  if (capacity !== null) ctx.capacity = capacity;
  ctx.critMultiplier = tuning.combat.critMultiplier;
  if (rules !== NO_RULES) ctx.rules = rules;
  return ctx;
}

/** Parses and compiles `notation` for a spindle without changing anything. */
export function previewFor(
  spindleId: SpindleId,
  capacity: number | null,
  tuning: Tuning,
  notation: string,
  rules: Readonly<CompileRules> = NO_RULES,
): WeavePreview {
  const parsed = parseWeave(notation);
  if (!parsed.ok) return { parseError: parsed.error };
  return { compiled: compileWeave(parsed.tree, compileContextFor(spindleId, capacity, tuning, rules)) };
}

/** Compiles `notation` against the state's current spindle without changing anything. */
export function previewWeave(state: GameState, notation: string): WeavePreview {
  const w = state.weaves;
  return previewFor(w.spindleId, w.capacity, state.tuning, notation, w.rules);
}

function emptySlot(): WeaveSlot {
  return { notation: null, program: null, compiled: null, error: null, cooldownLeft: 0, periodLeft: 0 };
}

/** Recomputes a slot's derived fields from its notation. */
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
  const w: WeaveLoadout = { spindleId: spec.spindleId, capacity: spec.capacity ?? null, slots: [], rules };
  for (let i = 0; i < LOADOUT_SLOTS; i++) {
    const slot = emptySlot();
    slot.notation = spec.notations[i] ?? null;
    compileSlot(w, tuning, slot);
    if (slot.program) slot.notation = slot.program.notation;
    resetTimers(slot);
    w.slots.push(slot);
  }
  return w;
}

/** The loadout as plain data (for new games after a reset, and replay files). */
export function loadoutSpecOf(w: WeaveLoadout): LoadoutSpec {
  return { spindleId: w.spindleId, capacity: w.capacity, notations: w.slots.map((s) => s.notation) };
}

/** Replaces the whole loadout (new game, replays). Cancels any cast. */
export function applyLoadoutSpec(state: GameState, spec: LoadoutSpec): void {
  cancelCast(state);
  state.weaves = createWeaveLoadout(spec, state.tuning, state.weaves.rules);
  state.loadout = legacyLoadout(state.weaves);
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
  for (const s of w.slots) compileSlot(w, state.tuning, s);
  state.loadout = legacyLoadout(w);
}

export interface SetWeaveOutcome {
  applied: boolean;
  preview: WeavePreview;
}

/**
 * Puts a weave in a slot if it parses and compiles on the current spindle (null empties it).
 * Resets the slot's trigger timers and cancels a cast from that slot. Otherwise changes nothing.
 */
export function setSlotWeave(state: GameState, slot: number, notation: string | null): SetWeaveOutcome {
  if (!Number.isInteger(slot) || slot < 0 || slot >= LOADOUT_SLOTS) throw new Error(`No weave slot ${slot}`);
  const preview: WeavePreview = notation === null ? {} : previewWeave(state, notation);
  if (notation !== null && (preview.parseError || !preview.compiled!.ok)) return { applied: false, preview };
  if (state.player.castSlot === slot) cancelCast(state);
  const s = state.weaves.slots[slot]!;
  s.notation = preview.compiled?.ok ? preview.compiled.program.notation : null;
  compileSlot(state.weaves, state.tuning, s);
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
  for (const s of w.slots) compileSlot(w, state.tuning, s);
  state.loadout = legacyLoadout(w);
}

/** Applies one recorded edit. Returns false if it was rejected (invalid weave or spindle). */
export function applyLoadoutEdit(state: GameState, edit: LoadoutEdit): boolean {
  if (edit.kind === 'spindle') {
    if (edit.value === null || !isSpindleId(edit.value)) return false;
    setLoadoutSpindle(state, edit.value, state.weaves.capacity);
    return true;
  }
  return setSlotWeave(state, edit.slot ?? 0, edit.value).applied;
}

/** True if some slot's working weave fires on `event`. */
export function listensFor(state: GameState, event: TriggerEvent): boolean {
  for (const s of state.weaves.slots) if (s.program?.trigger.event === event) return true;
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
