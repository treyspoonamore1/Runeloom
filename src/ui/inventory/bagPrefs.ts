/**
 * The bag's sort and filters, remembered per viewer in browser storage (like src/app/settings.ts):
 * every read and write is wrapped, because storage can be blocked or empty.
 */
import { signal } from '@preact/signals';
import { inventoryUi } from '../../../data/ui';
import { DEFAULT_PREFS, parsePrefs, type BagPrefs } from './bagModel';

export function loadPrefs(): BagPrefs {
  try {
    const raw = localStorage.getItem(inventoryUi.prefsKey);
    if (raw) return parsePrefs(JSON.parse(raw));
  } catch {
    // Storage blocked, or bad JSON: the defaults.
  }
  return { ...DEFAULT_PREFS };
}

export function savePrefs(p: BagPrefs): void {
  try {
    localStorage.setItem(inventoryUi.prefsKey, JSON.stringify(p));
  } catch {
    // Not remembered; still applies for this visit.
  }
}

/** The live choice. Change it with setPrefs. */
export const bagPrefs = signal<BagPrefs>(loadPrefs());

export function setPrefs(patch: Partial<BagPrefs>): void {
  bagPrefs.value = parsePrefs({ ...bagPrefs.value, ...patch });
  savePrefs(bagPrefs.value);
}

export function clearFilters(): void {
  setPrefs({ slot: 'all', rarity: 'all', upgradesOnly: false });
}
