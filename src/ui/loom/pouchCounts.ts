/**
 * Rune counts for the adventure-mode pouch (pure, no DOM). Each rune item sits in one place at a
 * time (DESIGN §5.1), so a rune is free when the hero owns more copies than the Loom's drafts
 * (all four slots, as the player sees them) use.
 */
import { getRune, type RuneId } from '../../../data/runes';
import type { WeaveTree } from '../../sim/weave/tree';
import { listSpells } from '../../sim/weave/tree';

/** Owned copies per rune id; null means unlimited (sandbox, arena, lab). */
export type RuneTotals = ReadonlyMap<string, number> | null;

export function totalsOf(runes: ReadonlyArray<{ rune: RuneId }>): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of runes) m.set(r.rune, (m.get(r.rune) ?? 0) + 1);
  return m;
}

/** Copies of each rune a tree uses (empty spots don't count). */
export function usedBy(tree: WeaveTree, into = new Map<string, number>()): Map<string, number> {
  const add = (id: string) => {
    if (id !== '') into.set(id, (into.get(id) ?? 0) + 1);
  };
  add(tree.trigger);
  for (const v of listSpells(tree)) {
    if (v.via) add(v.via.branch);
    add(v.spell.form);
    for (const id of v.spell.items) add(id);
  }
  return into;
}

/** Free copies per owned rune: owned minus used across the drafts (negative if drafts use more). */
export function freeCounts(
  totals: ReadonlyMap<string, number>,
  drafts: readonly WeaveTree[],
): Map<string, number> {
  const used = new Map<string, number>();
  for (const d of drafts) usedBy(d, used);
  const out = new Map<string, number>();
  for (const [id, n] of totals) out.set(id, n - (used.get(id) ?? 0));
  return out;
}

/** The player-facing reason a rune can't be placed, or null when a free copy exists. */
export function noFreeReason(free: ReadonlyMap<string, number> | null, id: string): string | null {
  if (!free) return null;
  if ((free.get(id) ?? 0) > 0) return null;
  const name = getRune(id)?.name ?? id;
  if (free.has(id)) return `No free ${name} rune`;
  return `You don't have ${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name} rune`;
}

/**
 * Runes a whole weave would need beyond what is free, if it replaced the draft `current`
 * (whose runes come back). For the reference-weaves menu.
 */
export function missingRunes(
  tree: WeaveTree,
  free: ReadonlyMap<string, number>,
  current: WeaveTree,
): string[] {
  const back = usedBy(current);
  const need = usedBy(tree);
  const out: string[] = [];
  for (const [id, n] of need)
    if (n > (free.get(id) ?? 0) + (back.get(id) ?? 0)) out.push(getRune(id)?.name ?? id);
  return out;
}
