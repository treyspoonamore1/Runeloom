/**
 * Compile contexts for the player's weaves: a spindle's (with a Capacity override and the compile
 * rules) and the state's, which adds the character (HeroMods). Split from loadout.ts.
 */
import { weaveLimits } from '../../../../data/runes';
import { spindles, type SpindleId } from '../../../../data/spindles';
import type { Tuning } from '../../../../data/tuning';
import type { GameState } from '../../state';
import { compileWeave, type CompileResult } from '../compile';
import { spindleContext, type CompileContext } from '../context';
import { parseWeave, type ParseError } from '../notation';
import { NO_RULES, type CompileRules } from '../rules';
import { RUNTIME_SHIPS } from './ships';

export interface WeavePreview {
  parseError?: ParseError;
  compiled?: CompileResult;
}

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

/**
 * The compile context for the state's weaves: the spindle (and Capacity override) plus the
 * character (HeroMods Core group): added Capacity, increased cast speed, reduced mana cost, flat
 * Strike damage and added rune levels. With a spindle item equipped (adventure) its implicit
 * reaches the weave through HeroMods; without one (sandbox, arena, lab) from the spindle id, as
 * before M4. Neutral HeroMods give exactly compileContextFor's context.
 */
export function stateContext(state: GameState): CompileContext {
  const w = state.weaves;
  const mods = state.heroMods;
  const ctx = compileContextFor(w.spindleId, w.capacity, state.tuning, w.rules);
  if (state.hero.equipped.spindle !== null) {
    ctx.runeLevel = 1 + mods.runeLevelAdd.all;
    ctx.strikeFlat = mods.strikeFlatAdd;
  } else {
    ctx.runeLevel = (ctx.runeLevel ?? 1) + mods.runeLevelAdd.all;
    ctx.strikeFlat = (ctx.strikeFlat ?? 0) + mods.strikeFlatAdd;
  }
  ctx.capacity += mods.capacityAdd;
  ctx.castSpeed = (ctx.castSpeed ?? 1) * (1 + mods.castSpeedInc);
  ctx.manaCostMult = (1 - mods.manaCostReduced) * mods.manaMore;
  // Uniques (hero/uniques.ts): neutral mods give the defaults, so these stay unset as before M5.
  if (mods.maxDepth !== weaveLimits.maxDepth) ctx.maxDepth = mods.maxDepth;
  if (mods.spawnCapPerCast !== weaveLimits.spawnCapPerCast) ctx.spawnCap = mods.spawnCapPerCast;
  return ctx;
}
