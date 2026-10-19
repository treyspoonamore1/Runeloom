/** What a weave is compiled against: the spindle, rune levels and which milestones' runes exist. */
import { defaultTuning } from '../../../data/tuning';
import { weaveLimits, type RuneShip } from '../../../data/runes';
import type { SpindleDef } from '../../../data/spindles';
import { NO_RULES, type CompileRules } from './rules';

export interface CompileContext {
  /** Spindle Capacity (complexity budget), including Loom Shards and affixes. */
  capacity: number;
  /** Milestones whose runes may be used; others fail with "<Rune> arrives in <M>". */
  allowShips: ReadonlySet<RuneShip> | 'all';
  /** Cast time divisor. Default 1. */
  castSpeed?: number;
  /** Deepest branch spell allowed. Default 3 (weaveLimits.maxDepth). */
  maxDepth?: number;
  /** Level of every rune (per-rune levels arrive with rune items in M4). Default 1. */
  runeLevel?: number;
  /** Flat Strike base damage (Ironbark implicit). Default 0. */
  strikeFlat?: number;
  /** Base crit multiplier. Default tuning.combat.critMultiplier (1.5). */
  critMultiplier?: number;
  /** Passive and Fuse rules that change compiled numbers (weave/rules.ts). Default NO_RULES. */
  rules?: Readonly<CompileRules>;
}

export type ResolvedContext = Required<CompileContext>;

export function resolveContext(ctx: CompileContext): ResolvedContext {
  return {
    capacity: ctx.capacity,
    allowShips: ctx.allowShips,
    castSpeed: ctx.castSpeed ?? 1,
    maxDepth: ctx.maxDepth ?? weaveLimits.maxDepth,
    runeLevel: ctx.runeLevel ?? 1,
    strikeFlat: ctx.strikeFlat ?? 0,
    critMultiplier: ctx.critMultiplier ?? defaultTuning.combat.critMultiplier,
    rules: ctx.rules ?? NO_RULES,
  };
}

/**
 * A context for a spindle: Capacity + Loom Shards, its cast speed, and the implicits that change
 * compiled numbers (Strike bonus, +rune levels). Damage-type "increased" and chill gain are
 * character stats the runtime applies.
 */
export function spindleContext(
  spindle: SpindleDef,
  opts: { allowShips: ReadonlySet<RuneShip> | 'all'; loomShards?: number; runeLevel?: number },
): CompileContext {
  return {
    capacity: spindle.capacity + (opts.loomShards ?? 0),
    allowShips: opts.allowShips,
    castSpeed: spindle.castSpeed,
    runeLevel: (opts.runeLevel ?? 1) + (spindle.implicit.runeLevels ?? 0),
    strikeFlat: spindle.implicit.strikeFlat ?? 0,
  };
}
