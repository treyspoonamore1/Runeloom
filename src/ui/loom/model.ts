/**
 * Pure tree editing for the Loom (no DOM, runs in Node tests).
 *
 * The editor works on a WeaveTree that may hold empty slots: '' as the trigger, a form or a branch
 * rune is a dashed placeholder (the compiler reports '' as an empty slot, tree.ts). Edits return
 * new trees; untouched subtrees are shared.
 *
 * "Spots" are the places a rune can go: the trigger, a spell's form, one of its items, the [+] at
 * the end of a spell row (append an item or add a branch), or a branch rune. `placements` offers
 * only the spots a rune may take by its kind, `appliesTo`, branch parents, duplicates and depth;
 * the compiler stays the source of truth for everything else.
 */
import {
  getRune,
  runes,
  weaveLimits,
  type BranchDef,
  type FormDef,
  type ModifierDef,
  type RuneDef,
  type RuneId,
} from '../../../data/runes';
import { printWeave } from '../../sim/weave/notation';
import { noFreeReason } from './pouchCounts';
import {
  branchIndex,
  childPath,
  listSpells,
  spellAt,
  updateSpell,
  type SpellNode,
  type WeavePath,
  type WeaveTree,
} from '../../sim/weave/tree';

/** The empty slot marker. */
export const EMPTY = '' as RuneId;

export const isEmptyId = (id: string): boolean => id === '';

export function emptySpell(): SpellNode {
  return { form: EMPTY, items: [], branches: [] };
}

export function emptyTree(): WeaveTree {
  return { trigger: EMPTY, root: emptySpell() };
}

/** True when nothing at all is placed (the slot is empty). */
export function isBlank(tree: WeaveTree): boolean {
  const r = tree.root;
  return isEmptyId(tree.trigger) && isEmptyId(r.form) && r.items.length === 0 && r.branches.length === 0;
}

export type Spot =
  | { kind: 'trigger' }
  | { kind: 'form'; spell: WeavePath }
  | { kind: 'item'; spell: WeavePath; index: number }
  /** The [+] at the end of a spell row: elements and modifiers append here. */
  | { kind: 'append'; spell: WeavePath }
  /** The same [+]: a branch rune adds a new child row under `spell` here. */
  | { kind: 'addBranch'; spell: WeavePath }
  /** The branch rune leading into the spell at `spell` (a child path). */
  | { kind: 'branchRune'; spell: WeavePath };

/** Stable id of a spot. Chips use their WeavePath joined with '.'; the [+] uses "<spell>.+". */
export function spotKey(s: Spot): string {
  switch (s.kind) {
    case 'trigger':
      return 'trigger';
    case 'form':
      return [...s.spell, 'form'].join('.');
    case 'item':
      return [...s.spell, `i${s.index}`].join('.');
    case 'branchRune':
      return [...s.spell, 'branch'].join('.');
    case 'append':
    case 'addBranch':
      return [...s.spell, '+'].join('.');
  }
}

/** The chip path a spot replaces, or null for the [+]. */
export function spotPath(s: Spot): WeavePath | null {
  switch (s.kind) {
    case 'trigger':
      return ['trigger'];
    case 'form':
      return [...s.spell, 'form'];
    case 'item':
      return [...s.spell, `i${s.index}`];
    case 'branchRune':
      return [...s.spell, 'branch'];
    default:
      return null;
  }
}

export interface Placement {
  spot: Spot;
  key: string;
  /** False: shown as blocked, with `reason` (only form swaps that would break the spell). */
  ok: boolean;
  reason?: string;
}

export interface EditOptions {
  /** Deepest branch spell allowed (root is 0). */
  maxDepth?: number;
  /**
   * Adventure mode: free copies per rune id (pouchCounts.ts). A rune with none free is offered
   * nowhere: every spot it could take is blocked with the reason. Absent or null: unlimited.
   */
  available?: ReadonlyMap<string, number> | null;
}

const formDef = (id: string): FormDef | undefined => {
  const d = getRune(id);
  return d?.kind === 'form' ? d : undefined;
};

const hasOwnElement = (spell: SpellNode): boolean =>
  spell.items.some((id) => getRune(id)?.kind === 'element');

/** True when the spell has an element of its own or inherits one (DESIGN §5.3). */
export function hasEffectiveElement(tree: WeaveTree, spellPath: WeavePath): boolean {
  for (let n = spellPath.length; n >= 1; n--) {
    const s = spellAt(tree, spellPath.slice(0, n));
    if (s && hasOwnElement(s)) return true;
  }
  return false;
}

/** Whether a modifier fits a form (by `appliesTo`); empty forms take only 'any' and 'elemental'. */
export function modifierFits(mod: ModifierDef, form: FormDef | undefined, hasElement: boolean): boolean {
  const to = mod.appliesTo;
  if (to === 'any') return true;
  if (to === 'elemental') return hasElement;
  if (!form) return false;
  return to === 'damaging' ? form.damaging : to.includes(form.id);
}

export function branchFits(br: BranchDef, form: FormDef | undefined): boolean {
  if (!form) return false;
  return br.parents === 'damaging' ? form.damaging : br.parents.includes(form.id);
}

/** Why `form` can't replace the spell's form (its modifiers or branches wouldn't fit), or null. */
function formSwapProblem(tree: WeaveTree, path: WeavePath, spell: SpellNode, form: FormDef): string | null {
  const el = hasEffectiveElement(tree, path);
  for (const id of spell.items) {
    const d = getRune(id);
    if (d?.kind === 'modifier' && !modifierFits(d, form, el)) return `${form.name} can't take ${d.name}`;
  }
  for (const b of spell.branches) {
    const d = getRune(b.branch);
    if (d?.kind === 'branch' && !branchFits(d, form)) return `${form.name} can't take an ${d.name} branch`;
  }
  return null;
}

/** Every spot `runeId` can go in `tree`. */
export function placements(tree: WeaveTree, runeId: string, opts: EditOptions = {}): Placement[] {
  const def = getRune(runeId);
  if (!def) return [];
  const maxDepth = opts.maxDepth ?? weaveLimits.maxDepth;
  const scarce = noFreeReason(opts.available ?? null, def.id);
  const out: Placement[] = [];
  const add = (spot: Spot, why?: string) => {
    const reason = why ?? scarce ?? undefined;
    out.push(
      reason ? { spot, key: spotKey(spot), ok: false, reason } : { spot, key: spotKey(spot), ok: true },
    );
  };

  if (def.kind === 'trigger') {
    if (tree.trigger !== def.id) add({ kind: 'trigger' });
    return out;
  }
  for (const v of listSpells(tree)) {
    const spell = v.spell;
    const path = v.path;
    const form = formDef(spell.form);
    if (def.kind === 'form') {
      if (spell.form === def.id) continue;
      add({ kind: 'form', spell: path }, formSwapProblem(tree, path, spell, def) ?? undefined);
    } else if (def.kind === 'element' || def.kind === 'modifier') {
      if (spell.items.includes(def.id)) continue;
      const fitsWith = (el: boolean) => def.kind === 'element' || modifierFits(def, form, el);
      if (fitsWith(hasEffectiveElement(tree, path))) add({ kind: 'append', spell: path });
      spell.items.forEach((_, i) => {
        // Replacing item i: does the spell still have an element afterwards?
        const items = spell.items.slice();
        items[i] = def.id;
        const trial = updateSpell(tree, path, (s) => ({ ...s, items }));
        const el = hasEffectiveElement(trial, path);
        // Don't offer a swap that takes away the element the form needs.
        const losesNeeded = !el && hasEffectiveElement(tree, path) && (form?.needsElement ?? false);
        if (fitsWith(el) && !losesNeeded) add({ kind: 'item', spell: path, index: i });
      });
    } else if (def.kind === 'branch') {
      if (!branchFits(def, form)) continue;
      if (v.depth + 1 <= maxDepth) add({ kind: 'addBranch', spell: path });
      spell.branches.forEach((b, i) => {
        if (b.branch !== def.id) add({ kind: 'branchRune', spell: childPath(path, i) });
      });
    }
  }
  return out;
}

/** Placements keyed by spot key, for the UI. */
export function placementMap(tree: WeaveTree, runeId: string, opts?: EditOptions): Map<string, Placement> {
  return new Map(placements(tree, runeId, opts).map((p) => [p.key, p]));
}

/** The runes (from `pool`) that may go in the spot with this key, for the spot-first picker. */
export function runesForSpot(
  tree: WeaveTree,
  key: string,
  pool: readonly RuneDef[],
  opts?: EditOptions,
): RuneDef[] {
  return pool.filter((r) => placements(tree, r.id, opts).some((p) => p.ok && p.key === key));
}

export interface EditResult {
  tree: WeaveTree;
  /** Path of the chip to select afterwards, or null. */
  selected: WeavePath | null;
}

const isElement = (id: string): boolean => getRune(id)?.kind === 'element';

/** Puts `runeId` in `spot`. The caller checks the spot with `placements` first. */
export function placeRune(tree: WeaveTree, spot: Spot, runeId: RuneId): EditResult {
  switch (spot.kind) {
    case 'trigger':
      return { tree: { ...tree, trigger: runeId }, selected: ['trigger'] };
    case 'form':
      return {
        tree: updateSpell(tree, spot.spell, (s) => ({ ...s, form: runeId })),
        selected: [...spot.spell, 'form'],
      };
    case 'item':
      return {
        tree: updateSpell(tree, spot.spell, (s) => {
          const items = s.items.slice();
          items[spot.index] = runeId;
          return { ...s, items };
        }),
        selected: [...spot.spell, `i${spot.index}`],
      };
    case 'append': {
      const spell = spellAt(tree, spot.spell);
      if (!spell) return { tree, selected: null };
      // Elements go after the last element so the elements read first; modifiers go at the end.
      let at = spell.items.length;
      if (isElement(runeId)) {
        at = 0;
        spell.items.forEach((id, i) => {
          if (isElement(id)) at = i + 1;
        });
      }
      const items = spell.items.slice();
      items.splice(at, 0, runeId);
      return {
        tree: updateSpell(tree, spot.spell, (s) => ({ ...s, items })),
        selected: [...spot.spell, `i${at}`],
      };
    }
    case 'addBranch': {
      const spell = spellAt(tree, spot.spell);
      if (!spell) return { tree, selected: null };
      const n = spell.branches.length;
      return {
        tree: updateSpell(tree, spot.spell, (s) => ({
          ...s,
          branches: [...s.branches, { branch: runeId, spell: emptySpell() }],
        })),
        selected: [...childPath(spot.spell, n), 'form'],
      };
    }
    case 'branchRune': {
      const parent = spot.spell.slice(0, -1);
      const n = branchIndex(spot.spell[spot.spell.length - 1] ?? '');
      if (n === null) return { tree, selected: null };
      return {
        tree: updateSpell(tree, parent, (s) => {
          const branches = s.branches.slice();
          const b = branches[n];
          if (b) branches[n] = { branch: runeId, spell: b.spell };
          return { ...s, branches };
        }),
        selected: [...spot.spell, 'branch'],
      };
    }
  }
}

/**
 * Removes the chip at `path`: the trigger or a form leaves an empty spot, an item is taken out,
 * and a branch rune removes its whole branch (the subtree under it).
 */
export function removeAt(tree: WeaveTree, path: WeavePath): EditResult {
  if (path.length === 1 && path[0] === 'trigger')
    return { tree: { ...tree, trigger: EMPTY }, selected: null };
  const tail = path[path.length - 1];
  const spellPath = path.slice(0, -1);
  if (tail === 'form')
    return { tree: updateSpell(tree, spellPath, (s) => ({ ...s, form: EMPTY })), selected: null };
  const m = tail ? /^i(\d+)$/.exec(tail) : null;
  if (m) {
    const i = Number(m[1]);
    return {
      tree: updateSpell(tree, spellPath, (s) => ({ ...s, items: s.items.filter((_, k) => k !== i) })),
      selected: null,
    };
  }
  if (tail === 'branch') {
    const n = branchIndex(spellPath[spellPath.length - 1] ?? '');
    if (n === null) return { tree, selected: null };
    return {
      tree: updateSpell(tree, spellPath.slice(0, -1), (s) => ({
        ...s,
        branches: s.branches.filter((_, k) => k !== n),
      })),
      selected: null,
    };
  }
  return { tree, selected: null };
}

/** The first empty slot in tree order, with the compiler's wording for it. */
export function firstEmpty(tree: WeaveTree): { path: WeavePath; message: string } | null {
  if (isEmptyId(tree.trigger)) return { path: ['trigger'], message: 'The weave needs a trigger' };
  for (const v of listSpells(tree)) {
    if (v.via && isEmptyId(v.via.branch))
      return { path: [...v.path, 'branch'], message: 'This branch needs a branch rune' };
    if (isEmptyId(v.spell.form)) return { path: [...v.path, 'form'], message: 'This spell needs a form' };
  }
  return null;
}

/** Notation for display: empty slots print as '?' (which doesn't parse, on purpose). */
export function draftNotation(tree: WeaveTree): string {
  const fill = (s: SpellNode): SpellNode => ({
    form: isEmptyId(s.form) ? ('?' as RuneId) : s.form,
    items: s.items,
    branches: s.branches.map((b) => ({
      branch: isEmptyId(b.branch) ? ('?' as RuneId) : b.branch,
      spell: fill(b.spell),
    })),
  });
  return printWeave({
    trigger: isEmptyId(tree.trigger) ? ('?' as RuneId) : tree.trigger,
    root: fill(tree.root),
  });
}

/** The rune at a chip path, if any (handles '' as nothing). */
export function chipRune(tree: WeaveTree, path: WeavePath): RuneDef | undefined {
  if (path.length === 1 && path[0] === 'trigger') return getRune(tree.trigger);
  const tail = path[path.length - 1];
  const spell = spellAt(tree, path);
  if (!spell) return undefined;
  if (tail === 'form') return getRune(spell.form);
  if (tail === 'branch') {
    const parent = spellAt(tree, path.slice(0, -2));
    const n = branchIndex(path[path.length - 2] ?? '');
    return n === null ? undefined : getRune(parent?.branches[n]?.branch ?? '');
  }
  const m = tail ? /^i(\d+)$/.exec(tail) : null;
  return m ? getRune(spell.items[Number(m[1])] ?? '') : undefined;
}

export const samePath = (a: WeavePath | null | undefined, b: WeavePath | null | undefined): boolean =>
  !!a && !!b && a.length === b.length && a.every((s, i) => s === b[i]);

/** Every rune def, for pools. */
export const allRunes: readonly RuneDef[] = Object.values(runes);
