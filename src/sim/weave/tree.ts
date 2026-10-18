/**
 * The weave AST (DESIGN §5.2): what the parser produces, the printer and compiler read, and the
 * Loom editor edits. Plain data, safe to clone with structuredClone and compare with deep equality.
 *
 *   weave  = trigger, spell
 *   spell  = form, items (elements and modifiers in slot order), branches
 *   branch = branch rune, spell
 *
 * The parser only checks syntax and that every name is a rune. Which kind of rune sits where is
 * the compiler's job (DESIGN §5.3 order), so a tree may hold a modifier where a form belongs. The
 * compiler also tolerates strings that aren't rune ids at all (a tree built from untrusted input):
 * '' is reported as an empty slot ("This spell needs a form"), anything else as an unknown rune.
 */
import type { RuneId } from '../../../data/runes';

export interface WeaveTree {
  trigger: RuneId;
  root: SpellNode;
}

export interface SpellNode {
  form: RuneId;
  /** Elements and modifiers, in slot order. May be empty. */
  items: RuneId[];
  /** In order; dispatch order at runtime follows it. */
  branches: BranchNode[];
}

export interface BranchNode {
  branch: RuneId;
  spell: SpellNode;
}

/**
 * Points at a place in a tree, for error messages and editor selection:
 *
 * - `['trigger']`: the trigger rune.
 * - `['root', 'b0', 'b1']`: a spell. 'root' is the root spell; each `b<n>` steps into branch n of
 *   the spell so far. Depth = number of `b` segments.
 * - A spell path plus `'form'`, `'i<n>'` (item n) or `'branch'` (the branch rune that leads into
 *   this spell, so `['root', 'b0', 'branch']` is the root's first branch rune).
 * - `[]`: the whole weave (used for Capacity errors).
 */
export type WeavePath = readonly string[];

/** The spell a path points at (ignoring a trailing 'form' / 'i<n>' / 'branch'), or undefined. */
export function spellAt(tree: WeaveTree, path: WeavePath): SpellNode | undefined {
  if (path[0] !== 'root') return undefined;
  let spell = tree.root;
  for (let i = 1; i < path.length; i++) {
    const seg = path[i]!;
    const n = branchIndex(seg);
    if (n === null) return i === path.length - 1 && isTail(seg) ? spell : undefined;
    const b = spell.branches[n];
    if (!b) return undefined;
    spell = b.spell;
  }
  return spell;
}

/** The rune id a path points at ('form', 'i<n>', 'branch' or ['trigger']), or undefined. */
export function runeAt(tree: WeaveTree, path: WeavePath): RuneId | undefined {
  if (path.length === 1 && path[0] === 'trigger') return tree.trigger;
  const tail = path[path.length - 1];
  const spell = spellAt(tree, path);
  if (!spell || tail === undefined) return undefined;
  if (tail === 'form') return spell.form;
  if (tail === 'branch') return parentBranch(tree, path.slice(0, -1))?.branch;
  const m = /^i(\d+)$/.exec(tail);
  return m ? spell.items[Number(m[1])] : undefined;
}

/** The branch node that leads into the spell at `spellPath`, or undefined for the root. */
export function parentBranch(tree: WeaveTree, spellPath: WeavePath): BranchNode | undefined {
  if (spellPath.length < 2) return undefined;
  const parent = spellAt(tree, spellPath.slice(0, -1));
  const n = branchIndex(spellPath[spellPath.length - 1]!);
  return parent && n !== null ? parent.branches[n] : undefined;
}

/** Path of branch n's spell under `spellPath`. */
export function childPath(spellPath: WeavePath, n: number): WeavePath {
  return [...spellPath, `b${n}`];
}

/** Number of branch steps in a spell path (root = 0). */
export function pathDepth(path: WeavePath): number {
  let d = 0;
  for (const seg of path) if (branchIndex(seg) !== null) d++;
  return d;
}

export interface SpellVisit {
  spell: SpellNode;
  path: WeavePath;
  depth: number;
  /** The branch that leads into this spell, null for the root. */
  via: BranchNode | null;
  /** The parent spell, null for the root. */
  parent: SpellNode | null;
}

/** Visits every spell in tree order (pre-order, branches in order). Return false to skip a subtree. */
export function walkSpells(tree: WeaveTree, visit: (v: SpellVisit) => boolean | void): void {
  const go = (
    spell: SpellNode,
    path: WeavePath,
    depth: number,
    via: BranchNode | null,
    parent: SpellNode | null,
  ) => {
    if (visit({ spell, path, depth, via, parent }) === false) return;
    spell.branches.forEach((b, i) => go(b.spell, childPath(path, i), depth + 1, b, spell));
  };
  go(tree.root, ['root'], 0, null, null);
}

/** Every spell in tree order. */
export function listSpells(tree: WeaveTree): SpellVisit[] {
  const out: SpellVisit[] = [];
  walkSpells(tree, (v) => {
    out.push(v);
  });
  return out;
}

/**
 * A new tree with the spell at `path` replaced by `fn(spell)`. Untouched subtrees are shared.
 * Returns the tree unchanged if the path doesn't point at a spell.
 */
export function updateSpell(tree: WeaveTree, path: WeavePath, fn: (s: SpellNode) => SpellNode): WeaveTree {
  if (path[0] !== 'root') return tree;
  const steps: number[] = [];
  for (const seg of path.slice(1)) {
    const n = branchIndex(seg);
    if (n === null) break;
    steps.push(n);
  }
  const rec = (spell: SpellNode, k: number): SpellNode | null => {
    if (k === steps.length) return fn(spell);
    const n = steps[k]!;
    const b = spell.branches[n];
    if (!b) return null;
    const inner = rec(b.spell, k + 1);
    if (!inner) return null;
    const next = spell.branches.slice();
    next[n] = { branch: b.branch, spell: inner };
    return { ...spell, branches: next };
  };
  const root = rec(tree.root, 0);
  return root ? { ...tree, root } : tree;
}

/** 'b3' → 3; anything else → null. */
export function branchIndex(seg: string): number | null {
  const m = /^b(\d+)$/.exec(seg);
  return m ? Number(m[1]) : null;
}

function isTail(seg: string): boolean {
  return seg === 'form' || seg === 'branch' || /^i\d+$/.test(seg);
}
