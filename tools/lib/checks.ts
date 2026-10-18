/** Pure validation helpers (unit tested in tests/tools/checks.test.ts). */
import type { RoomData } from '../../src/sim';

/** Reports every leaf of `obj` that is not a finite number > 0, as "path: value". */
export function checkPositiveNumbers(obj: unknown, path = ''): string[] {
  if (typeof obj === 'number')
    return Number.isFinite(obj) && obj > 0 ? [] : [`${path}: ${obj} is not a finite number > 0`];
  if (obj !== null && typeof obj === 'object') {
    return Object.entries(obj).flatMap(([k, v]) => checkPositiveNumbers(v, path ? `${path}.${k}` : k));
  }
  return [`${path}: ${String(obj)} is not a number`];
}

/** Spawn digits used in the grid vs. declared by @spawn headers. */
export function spawnMarkerDiffs(room: Pick<RoomData, 'rows' | 'header'>): {
  usedNotDeclared: string[];
  declaredNotUsed: string[];
} {
  const used = new Set<string>();
  for (const row of room.rows) for (const ch of row) if (ch >= '1' && ch <= '9') used.add(ch);
  const declared = new Set(room.header.spawns.map((s) => s.marker));
  return {
    usedNotDeclared: [...used].filter((m) => !declared.has(m)).sort(),
    declaredNotUsed: [...declared].filter((m) => !used.has(m)).sort(),
  };
}

/** Ids that are referenced but not in `known`. */
export function missingRefs(
  refs: Iterable<{ from: string; id: string }>,
  known: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  for (const r of refs) if (!known.has(r.id)) out.push(`${r.from}: room "${r.id}" does not exist`);
  return out;
}
