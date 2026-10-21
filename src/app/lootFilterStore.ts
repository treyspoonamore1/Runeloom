/**
 * The player's loot filter (src/sim/items/lootFilter.ts): presentation only, so it lives with
 * the settings, not in the sim or saves. Persisted per browser when storage is available.
 */
import { signal } from '@preact/signals';
import {
  EMPTY_FILTER,
  lootAction,
  parseLootFilter,
  type LootAction,
  type LootFilter,
} from '../sim/items/lootFilter';
import type { LootContent } from '../sim/items/loot';

const KEY = 'runeloom.lootFilter.v1';

function load(): LootFilter {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return parseLootFilter(JSON.parse(raw));
  } catch {
    // Storage blocked or bad JSON: show everything.
  }
  return { rules: [...EMPTY_FILTER.rules] };
}

/** The live filter. Change it with setLootFilter. */
export const lootFilter = signal<LootFilter>(load());

export function setLootFilter(f: LootFilter): void {
  lootFilter.value = parseLootFilter(f);
  try {
    localStorage.setItem(KEY, JSON.stringify(lootFilter.value));
  } catch {
    // Not persisted; still applies for this session.
  }
}

/** What the current filter does with a drop. */
export function filterAction(c: LootContent): LootAction {
  return lootAction(lootFilter.peek(), c);
}
