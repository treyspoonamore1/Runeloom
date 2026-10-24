/**
 * When offline progress was last paid for a character (M7), so loading an older save slot of the
 * same game doesn't pay the same hours again. Keyed by the game's seed; kept beside the settings
 * in browser storage (app-side wall-clock bookkeeping, never sim state). Storage that throws or is
 * missing (private windows, sandboxed frames) just means no memory: the slot's savedAt rules.
 */
const KEY = 'runeloom.offlineClaims';

export interface ClaimStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): ClaimStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readAll(store: ClaimStorage | null): Record<string, number> {
  try {
    const raw = store?.getItem(KEY);
    const o: unknown = raw ? JSON.parse(raw) : {};
    return typeof o === 'object' && o !== null ? (o as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** The wall-clock ms offline progress was last paid up to for the game with `seed`, or 0. */
export function offlineClaimedAt(seed: number, store: ClaimStorage | null = browserStorage()): number {
  const v = readAll(store)[String(seed)];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Records that offline progress for `seed` was paid up to `ms`. */
export function claimOffline(seed: number, ms: number, store: ClaimStorage | null = browserStorage()): void {
  try {
    const all = readAll(store);
    all[String(seed)] = Math.max(all[String(seed)] ?? 0, ms);
    store?.setItem(KEY, JSON.stringify(all));
  } catch {
    // No storage: nothing remembered.
  }
}
