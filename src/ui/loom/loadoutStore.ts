/**
 * The UI's single way to change the loadout: the Loom, the console and boot restore call these,
 * which go through the loadout contract (src/app/loadout.ts), save to storage, and bump
 * `loadoutRev` so the HUD and the Loom re-read getLoadout.
 */
import { signal } from '@preact/signals';
import {
  getLoadout,
  setSpindle,
  setWeave,
  SLOT_LABELS,
  type LoadoutView,
  type SetWeaveResult,
} from '../../app/loadout';
import type { Session } from '../../app/session';
import type { SpindleId } from '../../../data/spindles';
import { browserStorage, loadSaved, saveLoadout, type KeyValueStore } from './persist';

/** Bumped after every loadout change made through this module. */
export const loadoutRev = signal(0);

let storage: KeyValueStore | null = browserStorage();

/** Tests swap the storage (null: no storage). */
export function setLoadoutStorage(s: KeyValueStore | null): void {
  storage = s;
}

/** Adventure weaves belong to the save (src/app/saves.ts), not to the sandbox's localStorage loadout. */
const sandboxed = (session: Session): boolean => session.state.mode !== 'adventure';

function persist(session: Session): void {
  if (!sandboxed(session)) return;
  const l = getLoadout(session);
  saveLoadout(storage, { spindleId: l.spindleId, slots: l.slots.map((s) => s.notation) });
}

/** Puts a weave in a slot (null empties it). Saves it when applied. */
export function applyWeave(session: Session, slot: number, notation: string | null): SetWeaveResult {
  const r = setWeave(session, slot, notation);
  if (r.applied) persist(session);
  loadoutRev.value++;
  return r;
}

export function applySpindle(session: Session, id: SpindleId): LoadoutView {
  setSpindle(session, id);
  persist(session);
  loadoutRev.value++;
  return getLoadout(session);
}

/**
 * Restores the saved spindle and weaves (boot, and after a run reset if they were lost). Slots
 * whose saved weave no longer applies keep what they have. Returns the labels of those slots.
 */
export function restoreLoadout(session: Session): { restored: boolean; failed: string[] } {
  const saved = sandboxed(session) ? loadSaved(storage) : null;
  if (!saved) return { restored: false, failed: [] };
  const now = getLoadout(session);
  if (now.spindleId !== saved.spindleId) setSpindle(session, saved.spindleId);
  const failed: string[] = [];
  saved.slots.forEach((notation, i) => {
    if (i >= SLOT_LABELS.length || now.slots[i]?.notation === notation) return;
    if (!setWeave(session, i, notation).applied) failed.push(SLOT_LABELS[i]!);
  });
  loadoutRev.value++;
  return { restored: true, failed };
}

/** True when the live loadout differs from what is saved (e.g. a reset dropped it). */
export function differsFromSaved(session: Session): boolean {
  const saved = sandboxed(session) ? loadSaved(storage) : null;
  if (!saved) return false;
  const l = getLoadout(session);
  return l.spindleId !== saved.spindleId || l.slots.some((s, i) => s.notation !== (saved.slots[i] ?? null));
}
