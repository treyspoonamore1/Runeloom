/**
 * Remembers the player's four weaves and spindle in localStorage and restores them at boot
 * through the loadout contract (setSpindle, then setWeave per slot). Storage can be missing or
 * blocked (private windows, sandboxed frames), so every access is guarded.
 */
import { SANDBOX_SPINDLES, SLOT_LABELS } from '../../app/loadout';
import type { SpindleId } from '../../../data/spindles';

export const LOADOUT_KEY = 'runeloom.loadout.v1';

export interface SavedLoadout {
  spindleId: SpindleId;
  /** One per slot; null is an empty slot. */
  slots: (string | null)[];
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The browser's localStorage, or null when it can't be reached. */
export function browserStorage(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Validates untrusted saved data; returns null if it is unusable. */
export function parseSaved(raw: string | null): SavedLoadout | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const d = data as { spindleId?: unknown; slots?: unknown };
  if (typeof d.spindleId !== 'string' || !(SANDBOX_SPINDLES as readonly string[]).includes(d.spindleId))
    return null;
  if (!Array.isArray(d.slots)) return null;
  const slots = SLOT_LABELS.map((_, i) => {
    const v: unknown = (d.slots as unknown[])[i];
    return typeof v === 'string' && v.length <= 2000 ? v : null;
  });
  return { spindleId: d.spindleId as SpindleId, slots };
}

export function loadSaved(store: KeyValueStore | null): SavedLoadout | null {
  if (!store) return null;
  try {
    return parseSaved(store.getItem(LOADOUT_KEY));
  } catch {
    return null;
  }
}

/** Returns false when it couldn't be stored (still fine for this session). */
export function saveLoadout(store: KeyValueStore | null, saved: SavedLoadout): boolean {
  if (!store) return false;
  try {
    store.setItem(LOADOUT_KEY, JSON.stringify(saved));
    return true;
  } catch {
    return false;
  }
}
