/**
 * The weave compiler (DESIGN §5.3–5.4): validates a tree in the documented order (checks.ts),
 * computes its costs (costs.ts) and resolves it into a SpellProgram (program.ts, resolve.ts).
 * Pure; never throws on a malformed tree.
 */
import { weaveLimits, type TriggerDef } from '../../../data/runes';
import {
  checkAllowed,
  checkDuplicates,
  checkRunes,
  checkStructure,
  defOf,
  isEmpty,
  type CompileError,
} from './checks';
import { resolveContext, type CompileContext } from './context';
import { weaveCostsOf } from './costs';
import { analyzeElements } from './elements';
import { printWeave } from './notation';
import type { SpellProgram, WeaveCosts } from './program';
import { resolveSpell, resolveTrigger } from './resolve';
import { listSpells, type WeaveTree } from './tree';

export type { CompileError } from './checks';

export type CompileResult =
  | { ok: true; program: SpellProgram; costs: WeaveCosts }
  /** `costs` is present whenever every slot holds a known rune of the right kind, so the Loom can show them. */
  | { ok: false; error: CompileError; costs?: WeaveCosts };

export function compileWeave(tree: WeaveTree, context: CompileContext): CompileResult {
  const ctx = resolveContext(context);
  const runeError = checkRunes(tree, ctx);
  if (runeError) return { ok: false, error: runeError };
  const costs = hasEmptySlot(tree) ? undefined : weaveCostsOf(tree, ctx);
  const fail = (error: CompileError): CompileResult =>
    costs ? { ok: false, error, costs } : { ok: false, error };

  const els = analyzeElements(tree);
  const error = checkStructure(tree, els, ctx) ?? checkAllowed(tree, els) ?? checkDuplicates(tree);
  if (error) return fail(error);
  if (!costs) return fail({ message: 'This weave has an empty slot', path: [] });
  if (costs.complexity > ctx.capacity)
    return fail({
      message: `Needs ${costs.complexity} Capacity; this spindle has ${ctx.capacity}`,
      path: [],
    });

  const program: SpellProgram = {
    notation: printWeave(tree),
    trigger: resolveTrigger(defOf(tree.trigger) as TriggerDef, ctx),
    root: resolveSpell(tree.root, ['root'], 0, [], els, ctx),
    complexity: costs.complexity,
    mana: costs.mana,
    castTime: costs.castTime,
    runeLevel: ctx.runeLevel,
    spawnCap: weaveLimits.spawnCapPerCast,
  };
  return { ok: true, program, costs };
}

function hasEmptySlot(tree: WeaveTree): boolean {
  if (isEmpty(tree.trigger)) return true;
  return listSpells(tree).some((v) => isEmpty(v.spell.form) || (v.via !== null && isEmpty(v.via.branch)));
}
