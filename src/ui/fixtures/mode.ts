/**
 * M4 UI fixtures. The menus were built before the hero/items, passive-tree and world agents'
 * code was merged, so every screen reads through an adapter (src/ui/<screen>/adapter.ts) that can
 * serve local fixture data instead of the real calls.
 *
 * The real hero, passive tree and region map are merged, so fixtures are off by default;
 * `?fixture=1` (screenshots of the menus with rich fixture data) turns them on.
 */
import { signal } from '@preact/signals';

export const FIXTURES_BY_DEFAULT = false;

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
