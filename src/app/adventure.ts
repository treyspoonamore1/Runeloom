/**
 * The adventure flow behind the title screen and the pause menu: new game, continue, load, save
 * slots, autosave, export and import. Owns the save store; changes the game only by handing the
 * Session a whole new GameState (Session.adopt), like a reset.
 */
import { signal, type Signal } from '@preact/signals';
import type { SimEvent } from '../sim';
import type { Session } from './session';
import { adventureFromSave, makeSave, newAdventure, parseSave, type SaveData } from './saveFormat';
import { openSaveStore, SaveStore, type ManualSlot, type SaveRecord, type SaveSlot } from './saveStore';
import { downloadText, saveFileName } from './saveFiles';
import { HUD_EVENT } from '../ui/adventure/hudEvents';
import { roomName } from '../ui/adventure/hudAdapter';
import { heroRev } from '../ui/heroAdapter';

/** Events that trigger an autosave (names in the HUD's mapping table). */
const AUTOSAVE_ON: readonly string[] = [HUD_EVENT.roomEnter, HUD_EVENT.loomStone];

export interface AdventureFlow {
  /** Filled save slots, newest data after refresh(). */
  readonly slots: Signal<SaveRecord[]>;
  /** False when saves only last for this page (IndexedDB blocked). */
  readonly persistent: Signal<boolean>;
  refresh(): Promise<void>;
  newGame(): void;
  /** Loads a slot; returns why not, or null. */
  load(slot: SaveSlot): Promise<string | null>;
  /** Imports pasted or file text: starts that game and autosaves it. Returns why not, or null. */
  importText(text: string): Promise<string | null>;
  saveTo(slot: ManualSlot): Promise<string | null>;
  /** Writes the autosave now (quitting to the title). */
  autosaveNow(): Promise<string | null>;
  remove(slot: SaveSlot): Promise<void>;
  exportCurrent(): void;
  exportSlot(slot: SaveSlot): Promise<string | null>;
  inAdventure(): boolean;
  handleEvents(events: readonly SimEvent[]): void;
}

export function createAdventureFlow(
  session: Session,
  opts: { store?: Promise<SaveStore>; seed?: () => number } = {},
): AdventureFlow {
  const store = opts.store ?? openSaveStore();
  const slots = signal<SaveRecord[]>([]);
  const persistent = signal(true);
  const seed = opts.seed ?? (() => (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
  const inAdventure = () => session.state.mode === 'adventure';

  const refresh = async () => {
    const s = await store;
    persistent.value = s.persistent;
    slots.value = await s.list();
  };
  const write = async (slot: SaveSlot): Promise<string | null> => {
    if (!inAdventure()) return 'Only adventures can be saved';
    try {
      await (await store).write(slot, makeSave(session.state), roomName(session, session.state.room.id));
      await refresh();
      return null;
    } catch (e) {
      return `Couldn't save: ${e instanceof Error ? e.message : String(e)}`;
    }
  };
  const start = (save: SaveData) => {
    session.adopt(adventureFromSave(save), 'adventure');
    heroRev.value++;
  };
  // One autosave at a time; a trigger while one is writing runs one more afterwards.
  let autosaving = false;
  let again = false;
  const autosave = (): void => {
    if (autosaving) {
      again = true;
      return;
    }
    autosaving = true;
    void write('auto').finally(() => {
      autosaving = false;
      if (again) {
        again = false;
        autosave();
      }
    });
  };

  void refresh();
  return {
    slots,
    persistent,
    refresh,
    newGame() {
      session.adopt(newAdventure(seed()), 'adventure');
      heroRev.value++;
      autosave();
    },
    async load(slot) {
      const r = await (await store).read(slot);
      if (!r.ok) return r.error;
      start(r.save);
      return null;
    },
    async importText(text) {
      const p = parseSave(text.trim());
      if (!p.ok) return p.error;
      start(p.save);
      return write('auto');
    },
    saveTo: (slot) => write(slot),
    autosaveNow: () => write('auto'),
    async remove(slot) {
      await (await store).remove(slot);
      await refresh();
    },
    exportCurrent() {
      if (!inAdventure()) return;
      const save = makeSave(session.state);
      downloadText(saveFileName(save.hero.level, Date.now()), JSON.stringify(save, null, 1));
    },
    async exportSlot(slot) {
      const r = await (await store).read(slot);
      if (!r.ok) return r.error;
      downloadText(saveFileName(r.rec.level, r.rec.savedAt), r.rec.data);
      return null;
    },
    inAdventure,
    handleEvents(events) {
      if (inAdventure() && events.some((e) => AUTOSAVE_ON.includes(e.type))) autosave();
    },
  };
}
