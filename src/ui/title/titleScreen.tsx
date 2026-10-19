/**
 * Title screen (adventure mode): Continue, New Game, Load, Import, Settings and, in dev builds,
 * the dev scenes. Saves come from the adventure flow (src/app/adventure.ts).
 */
import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import type { AdventureFlow } from '../../app/adventure';
import { readFileText } from '../../app/saveFiles';
import { SAVE_SLOTS, SLOT_LABEL, type SaveRecord, type SaveSlot } from '../../app/saveStore';
import { Emblem } from '../icons';
import { SettingsRows } from '../settingsPanel';
import { injectTitleStyle } from './titleStyle';

export type TitleView = 'menu' | 'load' | 'import' | 'settings' | 'dev' | 'confirmNew';
export const titleView = signal<TitleView>('menu');
const message = signal<string | null>(null);
const busy = signal(false);
const pasted = signal('');
/** Delete asks twice: the first click arms the slot's button. */
const armedDelete = signal<SaveSlot | null>(null);

export interface TitleProps {
  flow: AdventureFlow;
  /** The game is ready to play (after New Game, Continue, Load or Import). */
  onStarted(): void;
  /** Dev builds: switch to a sandbox scene. */
  scenes: ReadonlyArray<{ id: string; label: string }> | null;
  onScene(id: string): void;
  tick(): void;
}

/** "just now", "5 min ago", "3 h ago", "2 days ago" (wall clock: app-side only). */
export function ago(ms: number, now: number): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

function summary(r: SaveRecord): string {
  return `Level ${r.level} · ${r.roomName} · ${ago(r.savedAt, Date.now())}`;
}

async function run(p: TitleProps, job: () => Promise<string | null>): Promise<void> {
  if (busy.peek()) return;
  busy.value = true;
  message.value = null;
  try {
    const why = await job();
    if (why) message.value = why;
    else {
      titleView.value = 'menu';
      p.onStarted();
    }
  } finally {
    busy.value = false;
  }
}

function Back() {
  return (
    <button
      type="button"
      class="rl-btn quiet tt-back"
      onClick={() => ((titleView.value = 'menu'), (message.value = null))}
    >
      Back <kbd>Esc</kbd>
    </button>
  );
}

function Menu(p: TitleProps) {
  const slots = p.flow.slots.value;
  const latest = slots.reduce<SaveRecord | null>((b, r) => (!b || r.savedAt > b.savedAt ? r : b), null);
  return (
    <nav class="tt-menu" aria-label="Title menu">
      {latest ? (
        <button
          type="button"
          class="rl-btn rl-play tt-main"
          onClick={() => void run(p, () => p.flow.load(latest.slot))}
        >
          Continue
          <small>{summary(latest)}</small>
        </button>
      ) : null}
      <button
        type="button"
        class={latest ? 'rl-btn quiet' : 'rl-btn rl-play tt-main'}
        onClick={() => {
          if (slots.some((r) => r.slot === 'auto')) titleView.value = 'confirmNew';
          else {
            p.flow.newGame();
            p.onStarted();
          }
        }}
      >
        New Game
      </button>
      <button
        type="button"
        class="rl-btn quiet"
        disabled={slots.length === 0}
        onClick={() => (titleView.value = 'load')}
      >
        Load
      </button>
      <button type="button" class="rl-btn quiet" onClick={() => (titleView.value = 'import')}>
        Import save
      </button>
      <button type="button" class="rl-btn quiet" onClick={() => (titleView.value = 'settings')}>
        Settings
      </button>
      {p.scenes ? (
        <button type="button" class="rl-btn quiet tt-dev" onClick={() => (titleView.value = 'dev')}>
          Sandbox scenes
        </button>
      ) : null}
    </nav>
  );
}

function Load(p: TitleProps) {
  const slots = p.flow.slots.value;
  const armed = armedDelete.value;
  return (
    <div class="tt-panel" aria-label="Load a save">
      <h2>Load</h2>
      <ul class="tt-slots">
        {SAVE_SLOTS.map((slot) => {
          const r = slots.find((x) => x.slot === slot);
          return (
            <li key={slot} class={r ? '' : 'empty'}>
              <div class="tt-slot-txt">
                <b>{SLOT_LABEL[slot]}</b>
                <small>{r ? summary(r) : 'Empty'}</small>
              </div>
              {r ? (
                <div class="tt-slot-acts">
                  <button
                    type="button"
                    class="rl-btn rl-small"
                    onClick={() => void run(p, () => p.flow.load(slot))}
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    class="rl-btn quiet rl-small"
                    onClick={() => void p.flow.exportSlot(slot)}
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    class={`rl-btn quiet rl-small tt-del${armed === slot ? ' armed' : ''}`}
                    aria-label={
                      armed === slot ? `Really delete ${SLOT_LABEL[slot]}?` : `Delete ${SLOT_LABEL[slot]}`
                    }
                    onClick={() => {
                      if (armed !== slot) armedDelete.value = slot;
                      else {
                        armedDelete.value = null;
                        void p.flow.remove(slot);
                      }
                    }}
                    onBlur={() => armed === slot && (armedDelete.value = null)}
                  >
                    {armed === slot ? 'Sure?' : 'Delete'}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {!p.flow.persistent.value ? (
        <p class="tt-warn">
          This browser blocks storage: saves last until the page closes. Export to keep one.
        </p>
      ) : null}
      <Back />
    </div>
  );
}

function Import(p: TitleProps) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <div class="tt-panel" aria-label="Import a save">
      <h2>Import save</h2>
      <p class="tt-note">
        Paste the text of an exported save, or choose its .json file. It starts that game and becomes your
        autosave.
      </p>
      <textarea
        class="tt-paste"
        rows={6}
        placeholder='{"format": "runeloom-save", ...}'
        aria-label="Save text"
        value={pasted.value}
        onInput={(e) => (pasted.value = (e.currentTarget as HTMLTextAreaElement).value)}
      />
      <div class="tt-row">
        <button type="button" class="rl-btn quiet rl-small" onClick={() => file.current?.click()}>
          Choose file…
        </button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = (e.currentTarget as HTMLInputElement).files?.[0];
            if (f) void readFileText(f).then((t) => run(p, () => p.flow.importText(t)));
          }}
        />
        <button
          type="button"
          class="rl-btn rl-small"
          disabled={pasted.value.trim() === '' || busy.value}
          onClick={() => void run(p, () => p.flow.importText(pasted.peek()))}
        >
          Import pasted text
        </button>
      </div>
      <Back />
    </div>
  );
}

function ConfirmNew(p: TitleProps) {
  return (
    <div class="tt-panel" aria-label="Start a new game">
      <h2>New game?</h2>
      <p class="tt-note">Your autosave will be replaced by the new game. Saves in slots 1 to 3 stay.</p>
      <div class="tt-row">
        <button type="button" class="rl-btn quiet" onClick={() => (titleView.value = 'menu')}>
          Cancel
        </button>
        <button
          type="button"
          class="rl-btn"
          onClick={() => {
            titleView.value = 'menu';
            p.flow.newGame();
            p.onStarted();
          }}
        >
          Start a new game
        </button>
      </div>
    </div>
  );
}

export function TitleScreen(p: TitleProps) {
  injectTitleStyle();
  const view = titleView.value;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void p.flow.refresh();
  }, []);
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLElement>('button:not([disabled]), textarea')
      ?.focus({ preventScroll: true });
  }, [view]);
  return (
    <div
      class="rl-screen rl-start tt-root"
      ref={ref}
      role="dialog"
      aria-label="Runeloom"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && view !== 'menu') {
          e.stopPropagation();
          titleView.value = 'menu';
          message.value = null;
        } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && view === 'menu') {
          const list = [
            ...(ref.current?.querySelectorAll<HTMLButtonElement>('.tt-menu button:not([disabled])') ?? []),
          ];
          const i = list.indexOf(document.activeElement as HTMLButtonElement);
          list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]?.focus();
          e.preventDefault();
        }
      }}
    >
      <div class="rl-col tt-col">
        <Emblem />
        <h1 class="rl-title">Runeloom</h1>
        <p class="rl-sub">Emberwood and the Sunken Kiln</p>
        <div class="rl-rule">
          <i />
        </div>
        {view === 'menu' ? <Menu {...p} /> : null}
        {view === 'load' ? <Load {...p} /> : null}
        {view === 'import' ? <Import {...p} /> : null}
        {view === 'confirmNew' ? <ConfirmNew {...p} /> : null}
        {view === 'settings' ? (
          <div class="tt-panel rl-pause" aria-label="Settings">
            <h2>Settings</h2>
            <SettingsRows tick={p.tick} />
            <Back />
          </div>
        ) : null}
        {view === 'dev' && p.scenes ? (
          <div class="tt-panel" aria-label="Sandbox scenes">
            <h2>Sandbox scenes</h2>
            <div class="tt-scenes">
              {p.scenes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  class="rl-btn quiet rl-small"
                  onClick={() => p.onScene(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <Back />
          </div>
        ) : null}
        <p class="tt-msg" role="status" aria-live="polite">
          {busy.value ? 'Loading…' : (message.value ?? ' ')}
        </p>
      </div>
    </div>
  );
}
