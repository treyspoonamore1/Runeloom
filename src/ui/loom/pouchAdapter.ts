/**
 * Loom pouch adapter: how many copies of each rune the player owns (src/app/loadout.ts
 * getRuneCounts, unlimitedRunes, getUnlockedRunes). Free copies are worked out against the
 * Loom's drafts in pouchCounts.ts; the sim's own check when a weave is applied (previewWeave
 * with the slot, whose compile error names a missing rune) stays the source of truth.
 */
import { getRuneCounts, getUnlockedRunes, unlimitedRunes } from '../../app/loadout';
import type { Session } from '../../app/session';
import { fixturesOn } from '../fixtures/mode';
import { heroOf } from '../heroAdapter';
import { totalsOf, type RuneTotals } from './pouchCounts';

/** Owned copies per rune (unlocked runes with none listed at 0); null when runes are unlimited. */
export function runeTotals(session: Session): RuneTotals {
  if (unlimitedRunes(session)) return null;
  if (fixturesOn.peek()) return totalsOf(heroOf(session).runes);
  const m = new Map<string, number>();
  for (const id of getUnlockedRunes(session)) m.set(id, 0);
  for (const [id, c] of Object.entries(getRuneCounts(session))) if (c) m.set(id, c.total);
  return m;
}
