import { h, render } from 'preact';
import { signal } from '@preact/signals';
import type { Session } from '../app/session';
import type { GameLoop, FrameStats } from '../app/loop';
import type { InputSampler } from '../app/input';
import type { Renderer } from '../render/renderer';
import { roomTexts } from '../app/rooms';
import { makeReplay, replayFileName } from '../app/replay';
import { saveFile, sendToClaude } from '../app/handoff';
import { CommandRegistry } from './console/commands';
import { registerBuiltins, type ConsoleEnv } from './console/builtins';
import { Console, consoleLines, consoleOpen } from './console/Console';
import { StatsOverlay, createStats } from './stats';
import { OverlayMenu } from './overlayMenu';
import { createTuningPanel } from './tuningPanel';
import { injectStyle } from './style';
import { showToast } from './toast';
import { installLabControls } from './labHint';

export interface DebugContext {
  session: Session;
  loop: GameLoop;
  renderer: Renderer;
  input: InputSampler;
  /** DOM layer above the canvas for overlay UI. */
  uiRoot: HTMLElement;
}

export interface DebugUI {
  /** Called once per rendered frame. */
  frame(stats: FrameStats): void;
  /** Console command registry, so later milestones can register commands. */
  readonly commands: CommandRegistry<ConsoleEnv>;
}

/** Shared registry: milestone modules call `commands.register(...)` at startup. */
export const commands = new CommandRegistry<ConsoleEnv>();
registerBuiltins(commands);

const isTextField = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement &&
  (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') &&
  !(t instanceof HTMLInputElement && (t.type === 'checkbox' || t.type === 'button'));

export function createDebugUI(ctx: DebugContext): DebugUI {
  injectStyle();
  const { uiRoot } = ctx;
  const toast = (msg: string): void => showToast(uiRoot, msg);

  // On in dev builds, off in release builds (F3 toggles it either way).
  const statsVisible = signal(import.meta.env.DEV);
  const menuVisible = signal(false);
  const menuRev = signal(0);
  const stats = createStats(ctx);
  const tuning = createTuningPanel(ctx, toast);

  const saveReplay = (): void => {
    const replay = makeReplay(ctx.session);
    const name = replayFileName(replay);
    const text = JSON.stringify(replay);
    const edited = replay.tuningEdited ? ' (tuning was edited during recording)' : '';
    // In a claude.ai Artifact the replay also goes to Claude (app/handoff.ts).
    void sendToClaude('replay', name, text, { roomId: replay.roomId, ticks: replay.ticks }).then((id) => {
      if (id) toast(`Replay sent to Claude (${id})${edited}`);
    });
    void saveFile(name, text).then((m) => toast(`${m}${edited}`));
  };

  const env: ConsoleEnv = {
    ...ctx,
    roomIds: () => Object.keys(roomTexts),
    saveReplay,
    refreshTuning: () => tuning.refresh(),
    clearOutput: () => void (consoleLines.value = []),
  };

  const left = document.createElement('div');
  left.className = 'dbg-left';
  const consoleHost = document.createElement('div');
  uiRoot.append(left, consoleHost);
  const statsHost = document.createElement('div');
  const menuHost = document.createElement('div');
  left.append(statsHost, menuHost);
  render(h(StatsOverlay, { snap: stats.snap, visible: statsVisible }), statsHost);
  render(h(OverlayMenu, { overlays: ctx.renderer.overlays, visible: menuVisible, rev: menuRev }), menuHost);
  render(
    h(Console, { reg: commands, env, onFocus: (on: boolean) => (ctx.input.enabled = !on) }),
    consoleHost,
  );

  // Typing in any text field (console, lil-gui number boxes) must not move the player.
  let textFocused = false;
  document.addEventListener('focusin', (e) => {
    if (isTextField(e.target)) {
      textFocused = true;
      ctx.input.enabled = false;
    }
  });
  document.addEventListener('focusout', (e) => {
    if (isTextField(e.target)) {
      textFocused = false;
      ctx.input.enabled = true;
    }
  });
  consoleOpen.subscribe((open) => {
    if (open) ctx.input.enabled = false;
    else if (!textFocused || !(document.activeElement instanceof HTMLInputElement)) ctx.input.enabled = true;
  });

  window.addEventListener(
    'keydown',
    (e) => {
      if (e.repeat) return;
      switch (e.code) {
        case 'F1':
          menuVisible.value = !menuVisible.value;
          break;
        case 'F2':
          tuning.toggle();
          break;
        case 'F3':
          statsVisible.value = !statsVisible.value;
          break;
        case 'F9':
          saveReplay();
          break;
        case 'Backquote':
          if (isTextField(e.target) && !consoleOpen.value) return;
          consoleOpen.value = !consoleOpen.value;
          break;
        case 'Escape':
          if (!consoleOpen.value) return;
          consoleOpen.value = false;
          break;
        default:
          return;
      }
      e.preventDefault();
    },
    true,
  );

  installLabControls(ctx);

  return { frame: (s) => stats.update(s), commands };
}
