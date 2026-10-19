/**
 * Loom pouch adapter: how many copies of each rune the player owns.
 *
 * EXPECTED (hero/items agent, src/app/loadout.ts "rune pouch info"): owned copies per rune id
 * in adventure mode, and "unlimited" in sandbox, arena and lab. Read here from the hero's rune
 * items (hero.runes, pouch and socketed alike); free copies are worked out against the Loom's
 * drafts in pouchCounts.ts. The sim's own check when a weave is applied stays the source of truth.
 */
import type { Session } from '../../app/session';
import { heroOf } from '../heroAdapter';
import { totalsOf, type RuneTotals } from './pouchCounts';

export function runeTotals(session: Session): RuneTotals {
  if (session.state.mode !== 'adventure') return null;
  return totalsOf(heroOf(session).runes);
}
