import { signal } from '@preact/signals';
import { ControlsList } from './controls';
import { SettingsRows } from './settingsPanel';
import { MANUAL_SLOTS, SLOT_LABEL, type ManualSlot, type SaveRecord } from '../app/saveStore';

/** Adventure-only pause actions: saving to a slot, export, back to the title. */
export interface PauseAdventure {
  slots: readonly SaveRecord[];
  saveTo(slot: ManualSlot): Promise<string | null>;
  exportSave(): void;
  quitToTitle(): void;
  /** False when saves only last for this page. */
  persistent: boolean;
}

export interface PauseActions {
  resume(): void;
  restart(): void;
  /** Places to play (scenes), the current one, and a switch to another. */
  places: ReadonlyArray<{ id: string; short: string }>;
  place: string;
  goTo(id: string): void;
  /** Feedback blip when a setting is committed. */
  tick(): void;
  /** Present in adventure mode: replaces Restart and the place picker. */
  adventure?: PauseAdventure | null;
}

const saveMsg = signal<string | null>(null);

function SaveRow({ a }: { a: PauseAdventure }) {
  return (
    <>
      <div class="rl-row">
        <span>Save game</span>
        <div class="rl-seg" role="group" aria-label="Save to slot">
          {MANUAL_SLOTS.map((slot) => {
            const rec = a.slots.find((r) => r.slot === slot);
            return (
              <button
                key={slot}
                type="button"
                title={rec ? `Overwrite: level ${rec.level}, ${rec.roomName}` : 'Empty slot'}
                onClick={() => {
                  saveMsg.value = 'Saving…';
                  void a.saveTo(slot).then((why) => (saveMsg.value = why ?? `Saved to ${SLOT_LABEL[slot]}`));
                }}
              >
                {SLOT_LABEL[slot]}
                {rec ? ' ✓' : ''}
              </button>
            );
          })}
        </div>
      </div>
      <div class="rl-row">
        <span class="rl-savemsg" aria-live="polite">
          {saveMsg.value ??
            (a.persistent
              ? 'The game also autosaves on every room and Loom Stone.'
              : 'This browser blocks storage: saves last until you close the page. Export to keep one.')}
        </span>
        <button class="rl-btn quiet rl-small" type="button" onClick={a.exportSave}>
          Export .json
        </button>
      </div>
    </>
  );
}

export function PauseMenu(p: PauseActions) {
  const a = p.adventure ?? null;
  return (
    <div class="rl-screen rl-pausebg rl-pause" role="dialog" aria-label="Paused">
      <div class="rl-card">
        <h2>Paused</h2>
        <div class="rl-actions">
          <button
            class="rl-btn"
            type="button"
            ref={(el) => el?.focus({ preventScroll: true })}
            onClick={() => {
              saveMsg.value = null;
              p.resume();
            }}
          >
            Resume
          </button>
          {a ? (
            <button class="rl-btn quiet" type="button" onClick={a.quitToTitle}>
              Quit to title
            </button>
          ) : (
            <button class="rl-btn quiet" type="button" onClick={p.restart}>
              Restart
            </button>
          )}
        </div>
        {a ? (
          <SaveRow a={a} />
        ) : (
          <div class="rl-row">
            <span>Place</span>
            <div class="rl-seg" role="group" aria-label="Place">
              {p.places.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  aria-pressed={p.place === pl.id}
                  onClick={() => p.goTo(pl.id)}
                >
                  {pl.short}
                </button>
              ))}
            </div>
          </div>
        )}
        <SettingsRows tick={p.tick} />
        <div class="rl-subhead">Controls</div>
        <ControlsList />
      </div>
    </div>
  );
}
