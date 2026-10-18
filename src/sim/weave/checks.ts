/**
 * Weave validation (DESIGN §5.3). Stops at the first error, checking in this order:
 *
 * 1. Runes: unknown id, a rune of the wrong kind in a position (a modifier where a form goes),
 *    a rune whose milestone isn't allowed ("Fork arrives in M5"). Tree order.
 * 2. Structure, each across the whole tree in tree order before the next: an empty slot (missing
 *    trigger, form or branch rune), a missing element, Sigil without Emit, depth over the max.
 * 3. A rune not allowed on its form (modifiers) or parent form (branches).
 * 4. A modifier or element used twice in one spell.
 * 5. Capacity (in compile.ts, from the costs).
 *
 * Messages are player-facing and use display names (CONTENT §2 must-fail table).
 */
import { forms, getRune, runes, type FormDef, type RuneDef, type RuneKind } from '../../../data/runes';
import type { ResolvedContext } from './context';
import type { EffectiveElement } from './elements';
import { listSpells, type SpellNode, type WeavePath, type WeaveTree } from './tree';

export interface CompileError {
  message: string;
  /** What the error points at (tree.ts WeavePath). [] means the whole weave. */
  path: WeavePath;
}

const article: Record<RuneKind, string> = {
  trigger: 'a trigger',
  form: 'a form',
  element: 'an element',
  modifier: 'a modifier',
  branch: 'a branch',
};

/** Pass 1. Empty ids ('') are left for the structure pass. */
export function checkRunes(tree: WeaveTree, ctx: ResolvedContext): CompileError | null {
  const one = (
    id: string,
    kinds: readonly RuneKind[],
    expected: string,
    path: WeavePath,
  ): CompileError | null => {
    // An empty trigger, form or branch slot is a structure error (pass 2); an empty item is never valid.
    if (isEmpty(id)) return kinds.includes('modifier') ? { message: 'Empty rune slot', path } : null;
    const def = getRune(id);
    if (!def) return { message: `Unknown rune '${id}'`, path };
    if (!kinds.includes(def.kind))
      return { message: `${def.name} is ${article[def.kind]}, not ${expected}`, path };
    if (ctx.allowShips !== 'all' && !ctx.allowShips.has(def.ships))
      return { message: `${def.name} arrives in ${def.ships}`, path };
    return null;
  };
  const e = one(tree.trigger, ['trigger'], 'a trigger', ['trigger']);
  if (e) return e;
  for (const v of listSpells(tree)) {
    if (v.via) {
      const b = one(v.via.branch, ['branch'], 'a branch', [...v.path, 'branch']);
      if (b) return b;
    }
    const f = one(v.spell.form, ['form'], 'a form', [...v.path, 'form']);
    if (f) return f;
    for (let i = 0; i < v.spell.items.length; i++) {
      const it = one(v.spell.items[i]!, ['element', 'modifier'], 'an element or modifier', [
        ...v.path,
        `i${i}`,
      ]);
      if (it) return it;
    }
  }
  return null;
}

/** Pass 2. `els` comes from analyzeElements. */
export function checkStructure(
  tree: WeaveTree,
  els: ReadonlyMap<SpellNode, readonly EffectiveElement[]>,
  ctx: ResolvedContext,
): CompileError | null {
  const spells = listSpells(tree);
  if (isEmpty(tree.trigger)) return { message: 'The weave needs a trigger', path: ['trigger'] };
  for (const v of spells) {
    if (v.via && isEmpty(v.via.branch))
      return { message: 'This branch needs a branch rune', path: [...v.path, 'branch'] };
    if (isEmpty(v.spell.form)) return { message: 'This spell needs a form', path: [...v.path, 'form'] };
  }
  for (const v of spells) {
    const form = formOf(v.spell);
    if (form.needsElement && (els.get(v.spell)?.length ?? 0) === 0)
      return { message: `${form.name} needs an element`, path: [...v.path, 'form'] };
  }
  for (const v of spells) {
    const form = formOf(v.spell);
    if (form.needsEmit && !v.spell.branches.some((b) => b.branch === 'emit'))
      return { message: `${form.name} needs an Emit branch`, path: [...v.path, 'form'] };
  }
  for (const v of spells) {
    if (v.depth > ctx.maxDepth)
      return { message: `Branches can nest at most ${ctx.maxDepth} deep`, path: [...v.path, 'branch'] };
  }
  return null;
}

/** Pass 3. */
export function checkAllowed(
  tree: WeaveTree,
  els: ReadonlyMap<SpellNode, readonly EffectiveElement[]>,
): CompileError | null {
  for (const v of listSpells(tree)) {
    const form = formOf(v.spell);
    const hasElement = (els.get(v.spell)?.length ?? 0) > 0;
    for (let i = 0; i < v.spell.items.length; i++) {
      const def = runes[v.spell.items[i]!];
      if (def.kind !== 'modifier') continue;
      const to = def.appliesTo;
      if (to === 'elemental' && !hasElement)
        return {
          message: `${form.name} can't take ${def.name} without an element`,
          path: [...v.path, `i${i}`],
        };
      const ok =
        to === 'any' || to === 'elemental' || (to === 'damaging' ? form.damaging : to.includes(form.id));
      if (!ok) return { message: `${form.name} can't take ${def.name}`, path: [...v.path, `i${i}`] };
    }
    for (let n = 0; n < v.spell.branches.length; n++) {
      const def = runes[v.spell.branches[n]!.branch];
      if (def.kind !== 'branch') continue;
      const ok = def.parents === 'damaging' ? form.damaging : def.parents.includes(form.id);
      if (!ok)
        return {
          message: `${form.name} can't take an ${def.name} branch`,
          path: [...v.path, `b${n}`, 'branch'],
        };
    }
  }
  return null;
}

/** Pass 4. */
export function checkDuplicates(tree: WeaveTree): CompileError | null {
  for (const v of listSpells(tree)) {
    const seen = new Set<string>();
    for (let i = 0; i < v.spell.items.length; i++) {
      const id = v.spell.items[i]!;
      if (seen.has(id))
        return { message: `${runes[id].name} can only be used once per spell`, path: [...v.path, `i${i}`] };
      seen.add(id);
    }
  }
  return null;
}

/** '' marks an empty slot in an editor-built tree. */
export function isEmpty(id: string): boolean {
  return id === '';
}

/** The form rune of a spell that passed pass 1 and the empty-slot checks. */
export function formOf(spell: SpellNode): FormDef {
  return forms[spell.form as keyof typeof forms];
}

/** A rune def known to exist (after pass 1). */
export function defOf(id: string): RuneDef {
  return runes[id as keyof typeof runes];
}
