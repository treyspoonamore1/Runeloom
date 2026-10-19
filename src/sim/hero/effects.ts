/**
 * Runtime state and trigger rules of the passive tree and Fuse parts (M4): the "Rules" group of
 * HeroMods that changes how weaves compile and fire.
 *
 * - Compile rules (weave/rules.ts): Tinder Tooth, Ember Feather, Single Thread, Echoing Thread.
 *   syncHeroEffects pushes them into the loadout, which recompiles only when they change.
 * - Extra weaves (HeroMods.extraWeaves, Cinder Heart's `Harvest > Nova[Fire]`): `heroFx.bonus`,
 *   one WeaveSlot each with its own trigger timers (hashed). They fire like automatic weave slots
 *   (triggers.ts) as slot −1, use no slot and no Capacity, and pay mana like any automatic weave.
 * - Living Loom (effects.living_loom = seconds): automatic triggers cost no mana and, after any
 *   of them fires, none may fire for that long (`heroFx.autoCooldownLeft`, hashed).
 *
 * Neutral (no passives, no parts): no bonus weaves, a cooldown that stays 0 and NO_RULES, and
 * hashHeroFx writes nothing, so every pre-M4 hash is unchanged.
 */
import { DT } from '../core/constants';
import type { Hasher } from '../core/hash';
import type { GameState } from '../state';
import { compileWeave } from '../weave/compile';
import { parseWeave } from '../weave/notation';
import type { SpellProgram } from '../weave/program';
import { NO_RULES, type CompileRules } from '../weave/rules';
import { compileContextFor, setCompileRules, type WeaveSlot } from '../weave/runtime/loadout';
import type { HeroMods } from './mods';

export interface HeroFxState {
  /** Extra weaves from HeroMods.extraWeaves, in that order. Notation and timers hashed. */
  bonus: WeaveSlot[];
  /** Living Loom: seconds until an automatic trigger may fire again (0: ready). Hashed. */
  autoCooldownLeft: number;
}

export function createHeroFx(): HeroFxState {
  return { bonus: [], autoCooldownLeft: 0 };
}

/** Capacity extra weaves compile against: they use none (CONTENT §4 Cinder Heart). */
const NO_CAPACITY_LIMIT = 999;

/** Timers within this of zero count as elapsed (as in triggers.ts). */
const TIME_EPSILON = 1e-9;

/** The compile rules a build adds up to (NO_RULES itself when none apply). */
export function compileRulesOf(mods: HeroMods): Readonly<CompileRules> {
  const fx = mods.effects;
  const rules: CompileRules = {
    firstFireFree: (fx.tinder_tooth ?? 0) > 0,
    projectileSpeedMult: 1 + (fx.projectile_speed_inc ?? 0),
    unmodifiedMore: 1 + (fx.single_thread ?? 0),
    echoFullDamage: (fx.echoing_thread ?? 0) > 0,
  };
  const neutral =
    !rules.firstFireFree &&
    rules.projectileSpeedMult === 1 &&
    rules.unmodifiedMore === 1 &&
    !rules.echoFullDamage;
  return neutral ? NO_RULES : rules;
}

/**
 * Called by refreshHero after `state.heroMods` is rebuilt: recompiles the slots if the compile
 * rules changed and rebuilds the extra weaves (keeping the timers of ones that stay).
 */
export function syncHeroEffects(state: GameState): void {
  const mods = state.heroMods;
  setCompileRules(state, compileRulesOf(mods));
  const fx = state.heroFx;
  const old = fx.bonus;
  fx.bonus = mods.extraWeaves.map((notation, i) => {
    const slot = bonusSlot(state, notation);
    const prev = old[i];
    if (prev && prev.notation === slot.notation) {
      slot.cooldownLeft = prev.cooldownLeft;
      slot.periodLeft = prev.periodLeft;
    }
    return slot;
  });
  if (livingLoomCooldown(state) <= 0) fx.autoCooldownLeft = 0;
}

function bonusSlot(state: GameState, notation: string): WeaveSlot {
  const w = state.weaves;
  const slot: WeaveSlot = {
    notation,
    program: null,
    compiled: null,
    error: null,
    cooldownLeft: 0,
    periodLeft: 0,
  };
  const parsed = parseWeave(notation);
  if (!parsed.ok) {
    slot.error = parsed.error.message;
    return slot;
  }
  const ctx = compileContextFor(w.spindleId, NO_CAPACITY_LIMIT, state.tuning, w.rules);
  const c = compileWeave(parsed.tree, ctx);
  slot.compiled = c;
  if (c.ok) {
    slot.program = c.program;
    slot.notation = c.program.notation;
  } else slot.error = c.error.message;
  return slot;
}

/** Living Loom's shared cooldown in seconds, 0 without it. */
function livingLoomCooldown(state: GameState): number {
  return state.heroMods.effects.living_loom ?? 0;
}

/** Counts down the Living Loom cooldown and the extra weaves' ICDs (start of the trigger phase). */
export function tickHeroTriggers(state: GameState): void {
  const fx = state.heroFx;
  if (fx.autoCooldownLeft > 0) {
    fx.autoCooldownLeft -= DT;
    if (fx.autoCooldownLeft <= TIME_EPSILON) fx.autoCooldownLeft = 0;
  }
  for (const s of fx.bonus) {
    if (s.cooldownLeft <= 0) continue;
    s.cooldownLeft -= DT;
    if (s.cooldownLeft <= TIME_EPSILON) s.cooldownLeft = 0;
  }
}

/** False while Living Loom's shared cooldown runs (always true without it). */
export function autoTriggerReady(state: GameState): boolean {
  return state.heroFx.autoCooldownLeft <= 0;
}

/** Mana an automatic trigger pays: none with Living Loom, else the weave's mana. */
export function autoTriggerMana(state: GameState, prog: SpellProgram): number {
  return livingLoomCooldown(state) > 0 ? 0 : prog.mana;
}

/** An automatic trigger fired: start Living Loom's shared cooldown. */
export function noteAutoTriggerFired(state: GameState): void {
  const cd = livingLoomCooldown(state);
  if (cd > 0) state.heroFx.autoCooldownLeft = cd;
}

/** Hashes the hashed parts; writes nothing in the neutral state (pre-M4 hashes unchanged). */
export function hashHeroFx(h: Hasher, fx: HeroFxState): void {
  if (fx.bonus.length === 0 && fx.autoCooldownLeft === 0) return;
  h.string('heroFx').byte(0).num(fx.autoCooldownLeft).u32(fx.bonus.length);
  for (const s of fx.bonus)
    h.string(s.notation ?? '-')
      .byte(0)
      .num(s.cooldownLeft)
      .num(s.periodLeft);
}
