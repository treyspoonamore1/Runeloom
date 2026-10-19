/** What a weave is compiled against: the spindle, rune levels and which milestones' runes exist. */
import { defaultTuning } from '../../../data/tuning';
import { weaveLimits, type RuneShip } from '../../../data/runes';
import type { SpindleDef } from '../../../data/spindles';

export interface CompileContext {
  /** Spindle Capacity (complexity budget), including Loom Shards and affixes. */
  capacity: number;
  /** Milestones whose runes may be used; others fail with "<Rune> arrives in <M>". */
  allowShips: ReadonlySet<RuneShip> | 'all';
  /** Cast time divisor. Default 1. */
  castSpeed?: number;
  /** Deepest branch spell allowed. Default 3 (weaveLimits.maxDepth). */
  maxDepth?: number;
  /** Level of every rune not named in `runeLevels`. Default 1. */
  runeLevel?: number;
  /**
   * Per-rune levels from rune items (adventure mode), keyed by the rune's path joined with '.'
   * (`runeKey`): 'trigger', 'root.form', 'root.b0.form', 'root.i1', 'root.b0.branch'. Missing
   * keys use `runeLevel`. A spell's damage scales with its form rune's level and Pulse's period
   * with the trigger's (DESIGN §7); other runes' levels don't change numbers in M4.
   */
  runeLevels?: Readonly<Record<string, number>>;
  /** Multiplier on mana costs (1 − reduced mana cost). Default 1. */
  manaCostMult?: number;
  /** Flat Strike base damage (Ironbark implicit). Default 0. */
  strikeFlat?: number;
  /** Base crit multiplier. Default tuning.combat.critMultiplier (1.5). */
  critMultiplier?: number;
}

export type ResolvedContext = Required<CompileContext>;

const NO_LEVELS: Readonly<Record<string, number>> = {};

/** The key of a rune's path in `CompileContext.runeLevels` ('root.b0.form'). */
export function runeKey(path: readonly string[]): string {
  return path.join('.');
}

/** The level of the rune at `path`. */
export function levelAt(ctx: ResolvedContext, path: readonly string[]): number {
  return ctx.runeLevels[runeKey(path)] ?? ctx.runeLevel;
}

export function resolveContext(ctx: CompileContext): ResolvedContext {
  return {
    capacity: ctx.capacity,
    allowShips: ctx.allowShips,
    castSpeed: ctx.castSpeed ?? 1,
    maxDepth: ctx.maxDepth ?? weaveLimits.maxDepth,
    runeLevel: ctx.runeLevel ?? 1,
    runeLevels: ctx.runeLevels ?? NO_LEVELS,
    manaCostMult: ctx.manaCostMult ?? 1,
    strikeFlat: ctx.strikeFlat ?? 0,
    critMultiplier: ctx.critMultiplier ?? defaultTuning.combat.critMultiplier,
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
