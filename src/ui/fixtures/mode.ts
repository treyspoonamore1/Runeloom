/**
 * M4 UI fixtures. The menus were built before the hero/items, passive-tree and world agents'
 * code was merged, so every screen reads through an adapter (src/ui/<screen>/adapter.ts) that can
 * serve local fixture data instead of the real calls.
 *
 * MERGE: set FIXTURES_BY_DEFAULT to false once src/sim/hero/edits.ts, data/passives.ts and
 * src/sim/world/regionMap.ts are real. `?fixture=1` (screenshots) and `?fixture=0` override it.
 */
import { signal } from '@preact/signals';

export const FIXTURES_BY_DEFAULT = true;

function fromUrl(): boolean | null {
  if (typeof location === 'undefined') return null;
  const v = new URLSearchParams(location.search).get('fixture');
  return v === '1' ? true : v === '0' ? false : null;
}

/** True while adapters serve fixture data. Tests set it with setFixtures. */
export const fixturesOn = signal<boolean>(fromUrl() ?? FIXTURES_BY_DEFAULT);

export function setFixtures(on: boolean): void {
  fixturesOn.value = on;
}
