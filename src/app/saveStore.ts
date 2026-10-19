/**
 * Save slots (DESIGN §12): SaveData JSON in IndexedDB, one autosave slot (room enter, Loom
 * Stones) and three manual slots. The store logic runs on any SaveBackend; the browser uses
 * IndexedDB and falls back to memory when it is blocked (private windows, sandboxed frames), so
 * the game still runs, just without keeping saves. Settings stay in localStorage (settings.ts).
 * Wall-clock time (savedAt) is app-side only, never sim state.
 */
import { parseSave, saveMeta, type SaveData, type SaveMeta } from './saveFormat';

export const SAVE_SLOTS = ['auto', 'slot1', 'slot2', 'slot3'] as const;
export type SaveSlot = (typeof SAVE_SLOTS)[number];
export type ManualSlot = Exclude<SaveSlot, 'auto'>;
export const MANUAL_SLOTS: readonly ManualSlot[] = ['slot1', 'slot2', 'slot3'];

export interface SaveRecord extends SaveMeta {
  slot: SaveSlot;
  /** Wall-clock ms when written. */
  savedAt: number;
  /** Room display name at save time. */
  roomName: string;
  /** The SaveData as JSON text, exactly what export writes. */
  data: string;
}

export interface SaveBackend {
  get(slot: SaveSlot): Promise<SaveRecord | undefined>;
  put(rec: SaveRecord): Promise<void>;
  delete(slot: SaveSlot): Promise<void>;
  all(): Promise<SaveRecord[]>;
}

export function memoryBackend(): SaveBackend {
  const m = new Map<SaveSlot, SaveRecord>();
  return {
    get: async (slot) => (m.has(slot) ? { ...m.get(slot)! } : undefined),
    put: async (rec) => void m.set(rec.slot, { ...rec }),
    delete: async (slot) => void m.delete(slot),
    all: async () => [...m.values()].map((r) => ({ ...r })),
  };
}

const DB = 'runeloom';
const STORE = 'saves';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'));
  });
}

/** IndexedDB backend: database "runeloom", object store "saves" keyed by slot. */
export async function idbBackend(idb: IDBFactory): Promise<SaveBackend> {
  const open = idb.open(DB, 1);
  open.onupgradeneeded = () => {
    if (!open.result.objectStoreNames.contains(STORE))
      open.result.createObjectStore(STORE, { keyPath: 'slot' });
  };
  const db = await req(open);
  const tx = (mode: IDBTransactionMode) => db.transaction(STORE, mode).objectStore(STORE);
  return {
    get: async (slot) => (await req(tx('readonly').get(slot))) as SaveRecord | undefined,
    put: async (rec) => void (await req(tx('readwrite').put(rec))),
    delete: async (slot) => void (await req(tx('readwrite').delete(slot))),
    all: async () => (await req(tx('readonly').getAll())) as SaveRecord[],
  };
}

export class SaveStore {
  constructor(
    private readonly backend: SaveBackend,
    /** False when saves won't outlive the page (the memory fallback). */
    readonly persistent: boolean,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Every filled slot, in SAVE_SLOTS order. */
  async list(): Promise<SaveRecord[]> {
    const all = await this.backend.all();
    return SAVE_SLOTS.flatMap((s) => all.filter((r) => r.slot === s));
  }

  /** The most recently written slot, for Continue. */
  async latest(): Promise<SaveRecord | null> {
    const all = await this.backend.all();
    return all.reduce<SaveRecord | null>((best, r) => (!best || r.savedAt > best.savedAt ? r : best), null);
  }

  async write(slot: SaveSlot, save: SaveData, roomName: string): Promise<SaveRecord> {
    const rec: SaveRecord = {
      slot,
      savedAt: this.now(),
      roomName,
      data: JSON.stringify(save),
      ...saveMeta(save),
    };
    await this.backend.put(rec);
    return rec;
  }

  /** The save in a slot, parsed; an error string when it is missing or unreadable. */
  async read(
    slot: SaveSlot,
  ): Promise<{ ok: true; save: SaveData; rec: SaveRecord } | { ok: false; error: string }> {
    const rec = await this.backend.get(slot);
    if (!rec) return { ok: false, error: 'That slot is empty' };
    const p = parseSave(rec.data);
    return p.ok ? { ok: true, save: p.save, rec } : p;
  }

  async remove(slot: SaveSlot): Promise<void> {
    await this.backend.delete(slot);
  }
}

/** The browser's store: IndexedDB when it opens, else memory. */
export async function openSaveStore(): Promise<SaveStore> {
  try {
    if (typeof indexedDB !== 'undefined') return new SaveStore(await idbBackend(indexedDB), true);
  } catch {
    // Blocked storage: fall through to memory.
  }
  return new SaveStore(memoryBackend(), false);
}

export const SLOT_LABEL: Record<SaveSlot, string> = {
  auto: 'Autosave',
  slot1: 'Slot 1',
  slot2: 'Slot 2',
  slot3: 'Slot 3',
};
