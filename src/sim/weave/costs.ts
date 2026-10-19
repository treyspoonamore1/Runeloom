/**
 * Weave costs (DESIGN §5.4). Assumes every rune id is known and of the right kind (pass 1).
 *
 * - Complexity: Σ rune cx. A branch rune leading into a spell at depth d costs
 *   cx + branchCxPerDepth × (d − 1).
 * - Mana: spellMana = form base mana × Π element and modifier mana mults (the spell's own slots;
 *   inherited or infused elements add nothing) + 0.5 × Σ child spellMana.
 *   weaveMana = trigger mana mult × spellMana(root).
 * - Cast time: root form cast time × Π castTimeMult (Heavy) ÷ cast speed; 0 when the trigger
 *   ignores cast time.
 */
import { weaveLimits, type BranchDef, type TriggerDef } from '../../../data/runes';
import { defOf, formOf } from './checks';
import type { ResolvedContext } from './context';
import type { WeaveCosts } from './program';
import type { SpellNode, WeaveTree } from './tree';

/** Mana of the spell's own runes, before branches. */
export function ownMana(spell: SpellNode): number {
  let m = formOf(spell).baseMana;
  for (const id of spell.items) {
    const def = defOf(id);
    if (def.kind === 'element' || def.kind === 'modifier') m *= def.manaMult;
  }
  return m;
}

/** spellMana, recursive. */
export function spellMana(spell: SpellNode): number {
  let children = 0;
  for (const b of spell.branches) children += spellMana(b.spell);
  return ownMana(spell) + weaveLimits.branchManaWeight * children;
}

/** Complexity of a spell's own form and items. */
export function ownComplexity(spell: SpellNode): number {
  let cx = formOf(spell).cx;
  for (const id of spell.items) cx += defOf(id).cx;
  return cx;
}

/** Complexity of a branch rune leading into a spell at `depth` (≥ 1). */
export function branchComplexity(def: BranchDef, depth: number): number {
  return def.cx + weaveLimits.branchCxPerDepth * Math.max(0, depth - 1);
}

export function weaveComplexity(tree: WeaveTree): number {
  const go = (spell: SpellNode, depth: number): number => {
    let cx = ownComplexity(spell);
    for (const b of spell.branches)
      cx += branchComplexity(defOf(b.branch) as BranchDef, depth + 1) + go(b.spell, depth + 1);
    return cx;
  };
  return defOf(tree.trigger).cx + go(tree.root, 0);
}

export function castTime(tree: WeaveTree, ctx: ResolvedContext): number {
  const trigger = defOf(tree.trigger) as TriggerDef;
  if (!trigger.usesCastTime) return 0;
  let t = formOf(tree.root).castTime;
  for (const id of tree.root.items) {
    const def = defOf(id);
    if (def.kind === 'modifier' && def.effect.castTimeMult !== undefined) t *= def.effect.castTimeMult;
  }
  return t / ctx.castSpeed;
}

export function weaveCostsOf(tree: WeaveTree, ctx: ResolvedContext): WeaveCosts {
  const trigger = defOf(tree.trigger) as TriggerDef;
  return {
    complexity: weaveComplexity(tree),
    capacity: ctx.capacity,
    mana: trigger.manaMult * spellMana(tree.root) * ctx.manaCostMult,
    castTime: castTime(tree, ctx),
  };
}
