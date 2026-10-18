import { h, render } from 'preact';
import { signal, type Signal } from '@preact/signals';
import type { GameState, SimEvent } from '../sim';
import type { Session } from '../app/session';
import type { GameLoop } from '../app/loop';
import type { InputSampler } from '../app/input';
import type { Renderer } from '../render/renderer';
import type { AudioSystem } from '../audio/audio';
import { fmtCost, readSnap, snapEqual, waveText, type HudSnap } from './hudModel';
import { readArena, WaveWatcher } from './arena';
import { consoleOpen } from './console/Console';
import { injectHudStyle } from './hudStyle';
import { SpellIcon } from './icons';
import { PauseMenu } from './pauseMenu';
import { StartScreen } from './startScreen';

export interface HudContext {
  session: Session;
  loop: GameLoop;
  input: InputSampler;
  /** DOM layer above the canvas. */
  uiRoot: HTMLElement;
  audio: AudioSystem;
  /** Used to give the canvas focus after menus close. */
  renderer?: Pick<Renderer, 'app'>;
  /** Skip the start screen. Default: true when the URL has paused=1 or autostart=1. */
  skipStart?: boolean;
}

/** The player-facing HUD: life, mana, dodge charges, spell slots, waves, start screen. */
export interface Hud {
  /** Sim events since the last frame (same batch the renderer gets). */
  handleEvents(events: readonly SimEvent[]): void;
  /** Called once per rendered frame after the sim has stepped. */
  frame(state: GameState): void;
}

type Screen = 'start' | 'play' | 'pause';
interface Banner {
  id: number;
  title: string;
  sub: string;
}

interface Sigs {
  snap: Signal<HudSnap>;
  screen: Signal<Screen>;
  /** Bumped on each hit taken, to restart the red edge flash. */
  hurt: Signal<number>;
  /** Slot and counter of the last failed cast, to restart that slot's red flash. */
  deny: Signal<{ slot: number; n: number }>;
  banner: Signal<Banner | null>;
}

const num = (v: number): string => String(v);

function Globe(p: {
  kind: 'life' | 'mana';
  value: number;
  max: number;
  frac: number;
  low?: boolean;
  flash?: number;
}) {
  return (
    <div
      class={`rl-globe rl-${p.kind}${p.low ? ' low' : ''}`}
      role="meter"
      aria-label={p.kind}
      aria-valuenow={p.value}
      aria-valuemax={p.max}
    >
      <div class={`rl-fill${p.frac <= 0 ? ' empty' : ''}`} style={`--f:${p.frac}`} />
      <div class="rl-num rl-outline">
        <b>{num(p.value)}</b>
        <span>/ {num(p.max)}</span>
      </div>
      {p.flash ? <i class="rl-deny" key={p.flash} /> : null}
    </div>
  );
}

function Bar({ s }: { s: Sigs }) {
  const v = s.snap.value;
  const deny = s.deny.value;
  return (
    <div class="rl-bar">
      <Globe kind="life" value={v.life} max={v.maxLife} frac={v.lifeFrac} low={v.lifeFrac < 0.3 && !v.dead} />
      <div class="rl-plate" style="position:relative">
        {v.god ? <span class="rl-godtag">GOD MODE</span> : null}
        <div class="rl-pips" aria-label="Dodge charges">
          <small>Dodge</small>
          {v.pips.map((fill, i) => (
            <i key={i} class={`rl-pip${fill >= 1 ? ' full' : ''}`} style={`--p:${fill}`} />
          ))}
          <small>Space</small>
        </div>
        <div class="rl-slots">
          {v.slots.map((sl) => (
            <div class="rl-slotwrap" key={sl.slot}>
              <div
                class={`rl-slot${sl.affordable ? '' : ' poor'}${sl.casting ? ' casting' : ''}`}
                title={sl.name}
              >
                <SpellIcon spell={sl.spell} />
                <i class={`rl-sweep${sl.casting ? '' : ' idle'}`} style={`--p:${sl.progress}`} />
                <span class="rl-cost" title="Mana cost">
                  {fmtCost(sl.cost)}
                </span>
                {deny.slot === sl.slot && deny.n > 0 ? <i class="rl-deny" key={deny.n} /> : null}
              </div>
              <span class="rl-key">{sl.key}</span>
              <span class="rl-spellname">{sl.name}</span>
            </div>
          ))}
        </div>
      </div>
      <Globe kind="mana" value={v.mana} max={v.maxMana} frac={v.manaFrac} flash={deny.n} />
    </div>
  );
}

function WavePanel({ s }: { s: Sigs }) {
  const w = s.snap.value.wave;
  if (!w) return null;
  const t = waveText(w);
  return (
    <div class="rl-wave">
      <div class="rl-wave-title rl-outline">{t.title}</div>
      <div class="rl-wave-detail">{t.detail}</div>
    </div>
  );
}

function HudApp({
  s,
  play,
  pause,
}: {
  s: Sigs;
  play(): void;
  pause: { resume(): void; restart(): void; tick(): void };
}) {
  const screen = s.screen.value;
  const v = s.snap.value;
  const banner = s.banner.value;
  return (
    <>
      {screen !== 'start' ? (
        <>
          {s.hurt.value > 0 && !v.dead ? <div class="rl-hurt" key={s.hurt.value} /> : null}
          {v.lifeFrac < 0.3 && !v.dead ? <div class="rl-lowlife" /> : null}
          <Bar s={s} />
          <WavePanel s={s} />
          {banner ? (
            <div class="rl-banner" key={banner.id}>
              <h2>{banner.title}</h2>
              {banner.sub ? <p>{banner.sub}</p> : null}
            </div>
          ) : null}
          {v.dead ? (
            <div class="rl-dead">
              <div>
                <h2>You fell.</h2>
                <p>Rewoven in {num(v.respawnSec)}…</p>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      {screen === 'start' ? <StartScreen onPlay={play} /> : null}
      {screen === 'pause' ? <PauseMenu {...pause} /> : null}
    </>
  );
}

const isTypingTarget = (t: EventTarget | null): boolean =>
  t instanceof HTMLInputElement && t.type !== 'range' && t.type !== 'checkbox'
    ? true
    : t instanceof HTMLTextAreaElement;

export function createHud(ctx: HudContext): Hud {
  injectHudStyle();
  const params = new URLSearchParams(location.search);
  const skipStart = ctx.skipStart ?? (params.get('paused') === '1' || params.get('autostart') === '1');

  const s: Sigs = {
    snap: signal(readSnap(ctx.session.state)),
    screen: signal<Screen>(skipStart ? 'play' : 'start'),
    hurt: signal(0),
    deny: signal({ slot: -1, n: 0 }),
    banner: signal<Banner | null>(null),
  };
  let bannerId = 0;
  const watcher = new WaveWatcher();
  const showBanner = (title: string, sub = ''): void =>
    void (s.banner.value = { id: ++bannerId, title, sub });

  const root = document.createElement('div');
  root.className = 'rl-root';
  ctx.uiRoot.appendChild(root);

  const focusGame = (): void => {
    const c = ctx.renderer?.app.canvas;
    if (!c) return;
    if (!c.hasAttribute('tabindex')) c.tabIndex = -1;
    c.focus({ preventScroll: true });
  };

  /** The arena starts its first wave by itself (tuning.arena.firstWaveDelay), so nothing to do. */
  const beginRun = (): void => {};

  const play = (): void => {
    if (s.screen.value !== 'start') return;
    ctx.audio.unlock();
    ctx.audio.play('uiStart');
    s.screen.value = 'play';
    ctx.loop.paused = false;
    focusGame();
    beginRun();
  };
  const pause = (): void => {
    if (s.screen.value !== 'play') return;
    s.screen.value = 'pause';
    ctx.loop.paused = true;
  };
  const resume = (): void => {
    if (s.screen.value !== 'pause') return;
    s.screen.value = 'play';
    ctx.loop.paused = false;
    ctx.audio.play('uiClick');
    focusGame();
  };
  const restart = (): void => {
    ctx.session.reset();
    beginRun();
    s.screen.value = 'play';
    ctx.loop.paused = false;
    ctx.audio.play('uiClick');
    focusGame();
  };

  if (s.screen.value === 'start') ctx.loop.paused = true;
  s.screen.subscribe((v) => ctx.uiRoot.classList.toggle('rl-starting', v === 'start'));

  // Browsers only start audio after a gesture; this covers URLs that skip the start screen.
  const unlockOnce = (): void => {
    ctx.audio.unlock();
    window.removeEventListener('pointerdown', unlockOnce, true);
    window.removeEventListener('keydown', unlockOnce, true);
  };
  window.addEventListener('pointerdown', unlockOnce, true);
  window.addEventListener('keydown', unlockOnce, true);

  // Registered before the debug UI's own capture handler, so it sees the console still open
  // when Esc is pressed to close it and leaves that keypress alone.
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.repeat) return;
      if (e.code === 'Escape') {
        if (consoleOpen.value) return;
        if (s.screen.value === 'play') pause();
        else if (s.screen.value === 'pause') resume();
      } else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && s.screen.value === 'start') {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        play();
      }
    },
    true,
  );

  // Losing focus (alt-tab, devtools) pauses so nobody dies unseen. An already-paused sim stays as is.
  const autoPause = (): void => {
    if (s.screen.value === 'play' && !ctx.loop.paused) pause();
  };
  window.addEventListener('blur', autoPause);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) autoPause();
  });

  render(h(HudApp, { s, play, pause: { resume, restart, tick: () => ctx.audio.play('uiClick') } }), root);

  return {
    handleEvents(events) {
      for (const e of events) {
        if (e.type === 'castFailed') s.deny.value = { slot: e.slot, n: s.deny.peek().n + 1 };
        else if (e.type === 'hit' && e.target === 'player') s.hurt.value = s.hurt.peek() + 1;
      }
    },
    frame(state) {
      const next = readSnap(state);
      if (!snapEqual(s.snap.peek(), next)) s.snap.value = next;
      const w = watcher.update(readArena(state));
      if (w.transition === 'cleared') showBanner(`Wave ${w.wave} cleared`, 'Catch your breath');
      else if (w.transition === 'started') showBanner(`Wave ${w.wave}`, 'Incoming');
    },
  };
}
