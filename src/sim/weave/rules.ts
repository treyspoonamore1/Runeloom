/**
 * Rule-changing passives and Fuse parts that change compiled numbers (M4; CONTENT §4 and §7).
 * The compiler applies them after resolving a tree, so the Loom's costs and tooltips show them.
 * Built from HeroMods by compileRulesOf (src/sim/hero/effects.ts); NO_RULES compiles exactly as
 * before M4.
 *
 * - firstFireFree (Tinder Tooth): the first Fire rune in the weave costs 0 complexity.
 * - projectileSpeedMult (Ember Feather): Bolt speed ×, Lob flight time ÷ (range unchanged).
 * - unmodifiedMore (Single Thread): a weave with no modifier runes anywhere gets this "more" on
 *   every spell in it (1 = off).
 * - echoFullDamage (Echoing Thread): Echo's repeat deals full damage.
 */
import { elements } from '../../../data/runes';
import { defOf } from './checks';
import type { SpellSpec } from './program';
import { listSpells, type WeaveTree } from './tree';

export interface CompileRules {
  firstFireFree: boolean;
  projectileSpeedMult: number;
  unmodifiedMore: number;
  echoFullDamage: boolean;
}

export const NO_RULES: Readonly<CompileRules> = Object.freeze({
  firstFireFree: false,
  projectileSpeedMult: 1,
  unmodifiedMore: 1,
  echoFullDamage: false,
});

export function sameRules(a: Readonly<CompileRules>, b: Readonly<CompileRules>): boolean {
  return (
    a.firstFireFree === b.firstFireFree &&
    a.projectileSpeedMult === b.projectileSpeedMult &&
    a.unmodifiedMore === b.unmodifiedMore &&
    a.echoFullDamage === b.echoFullDamage
  );
}

/** Tinder Tooth: complexity to subtract (the Fire rune's cost when the weave has one). */
export function ruleComplexityDiscount(tree: WeaveTree, rules: Readonly<CompileRules>): number {
  if (!rules.firstFireFree) return 0;
  for (const v of listSpells(tree)) if (v.spell.items.includes('fire')) return elements.fire.cx;
  return 0;
}

function hasModifier(tree: WeaveTree): boolean {
  for (const v of listSpells(tree))
    for (const id of v.spell.items) if (defOf(id).kind === 'modifier') return true;
  return false;
}

/** Applies the rules to a freshly resolved spec tree in place (specs are never shared yet). */
export function applyCompileRules(
  root: SpellSpec,
  tree: WeaveTree,
  rules: Readonly<CompileRules>,
): SpellSpec {
  const single = rules.unmodifiedMore !== 1 && !hasModifier(tree);
  if (!single && rules.projectileSpeedMult === 1 && !rules.echoFullDamage) return root;
  const visit = (spec: SpellSpec): void => {
    if (single) {
      spec.more.push({ source: 'single_thread', label: 'Single Thread', mult: rules.unmodifiedMore });
      spec.moreProduct *= rules.unmodifiedMore;
    }
    const p = spec.params;
    if (p.form === 'bolt') p.speed *= rules.projectileSpeedMult;
    else if (p.form === 'lob') p.flightTime /= rules.projectileSpeedMult;
    if (rules.echoFullDamage && spec.echo) spec.echo.damageMult = 1;
    for (const c of spec.children) visit(c.spec);
  };
  visit(root);
  return root;
}
