import { h, render } from 'preact';
import { signal } from '@preact/signals';
import type { GameState, SimEvent } from '../sim';
import type { Session } from '../app/session';
import type { GameLoop } from '../app/loop';
import type { InputSampler } from '../app/input';
import type { Renderer } from '../render/renderer';
import type { AudioSystem } from '../audio/audio';
import type { AdventureFlow } from '../app/adventure';
import { readSnap, snapEqual } from './hudModel';
import { barSnap, slotSnaps } from './hudSlots';
import { getLoadout, slotTimers, type LoadoutView } from '../app/loadout';
import { createLoom } from './loom/loom';
import { differsFromSaved, loadoutRev, restoreLoadout } from './loom/loadoutStore';
import { readArena, WaveWatcher } from './arena';
import { consoleOpen } from './console/Console';
import { injectHudStyle } from './hudStyle';
import { findScene, sandboxScenes } from '../app/scenes';
import { createAdventureHud, holdToasts } from './adventure/adventureHud';
import type { LooseEvent } from './adventure/hudEvents';
import { HudApp } from './hudApp';
import type { Banner, Screen, Sigs } from './hudBar';
import type { MenuId } from './menus/frame';
import { isMenu, menuForKey, menuKey } from './menus/menuHost';
import { titleView, type TitleView } from './title/titleScreen';
import { createItemGet, itemGetActions } from './itemGet/itemGetFlow';
import { itemGetKey } from './itemGet/itemGetPanel';
import { stationTabFor } from './hearth/hearthEvents';
import { hearthTab, hearthUnlocked } from './hearth/hearthSignals';
import { readHearthSummary } from './hearth/adapter';

export interface HudContext {
  session: Session;
  loop: GameLoop;
  input: InputSampler;
  /** DOM layer above the canvas. */
  uiRoot: HTMLElement;
  audio: AudioSystem;
  /** Used to give the canvas focus after menus close, and for the item-get pose. */
  renderer?: Pick<Renderer, 'app'> & Partial<Pick<Renderer, 'holdRune'>>;
  /** Skip the start screen. Default: true when the URL has paused=1 or autostart=1. */
  skipStart?: boolean;
  /** Saves and the title screen's actions (adventure mode). */
  flow?: AdventureFlow;
  /** Open on the title screen (the adventure demo without ?scene=). */
  title?: boolean;
  /** Offer the dev scenes on the title screen (dev builds). */
  devScenes?: boolean;
}

/** Screenshot and test hooks (window.__runeloom.ui). Never used by gameplay. */
export interface HudDebug {
  /** Opens a screen: 'title', 'inventory', 'tree', 'map', 'pause', 'loom', 'play'; or a title sub-view. */
  open(screen: Screen | `title:${TitleView}`): void;
  /** Feeds events to the HUD as if a step had sent them (the M4 events don't exist yet). */
  events(events: LooseEvent[]): void;
  /** Keeps toasts and banners on screen (slow screenshot captures). */
  hold(on: boolean): void;
}

/** The player-facing HUD: life, mana, dodge charges, spell slots, waves, start screen. */
export interface Hud {
  /** Sim events since the last frame (same batch the renderer gets). */
  handleEvents(events: readonly SimEvent[]): void;
  /** Called once per rendered frame after the sim has stepped. */
  frame(state: GameState): void;
  readonly debug: HudDebug;
}

const isTypingTarget = (t: EventTarget | null): boolean =>
  t instanceof HTMLInputElement && t.type !== 'range' && t.type !== 'checkbox'
    ? true
    : t instanceof HTMLTextAreaElement;

export function createHud(ctx: HudContext): Hud {
  injectHudStyle();
  // The player's saved weaves and spindle (DESIGN §5.1), applied before the first tick.
  restoreLoadout(ctx.session);
  ctx.session.onReset(() => {
    if (differsFromSaved(ctx.session)) restoreLoadout(ctx.session);
    else loadoutRev.value++;
  });
  const loom = createLoom(ctx.session);
  // The dungeon-item moment for a new element rune (src/ui/itemGet).
  const itemGet = createItemGet(ctx.session);
  ctx.session.onReset(() => {
    itemGet.clear();
    ctx.renderer?.holdRune?.(null);
  });
  const params = new URLSearchParams(location.search);
  const skipStart = ctx.skipStart ?? (params.get('paused') === '1' || params.get('autostart') === '1');
  const flow = ctx.flow ?? null;

  const s: Sigs = {
    snap: signal(readSnap(ctx.session.state)),
    screen: signal<Screen>(ctx.title && flow ? 'title' : skipStart ? 'play' : 'start'),
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
  const toPlay = (): void => {
    s.screen.value = 'play';
    ctx.loop.paused = false;
    ctx.input.enabled = true;
    focusGame();
  };

  const play = (): void => {
    if (s.screen.value !== 'start') return;
    ctx.audio.unlock();
    ctx.audio.play('uiStart');
    toPlay();
  };
  const pause = (): void => {
    if (s.screen.value !== 'play') return;
    s.screen.value = 'pause';
    ctx.loop.paused = true;
  };
  const resume = (): void => {
    if (s.screen.value !== 'pause') return;
    ctx.audio.play('uiClick');
    toPlay();
  };
  const restart = (): void => {
    ctx.session.reset();
    ctx.audio.play('uiClick');
    toPlay();
  };
  const goTo = (id: string): void => {
    const scene = findScene(id);
    if (!scene) return;
    ctx.session.switchScene(scene);
    ctx.audio.play('uiClick');
    toPlay();
  };
  /** Back to the title; an adventure is autosaved first, so Continue resumes right here. */
  const toTitle = (): void => {
    titleView.value = 'menu';
    s.screen.value = 'title';
    ctx.loop.paused = true;
    if (flow?.inAdventure()) void flow.autosaveNow();
    else void flow?.refresh();
  };

  // The Loom and the I / P / M menus: the sim pauses and player input is off while one is open.
  let pausedBefore = false;
  const enterModal = (to: Screen): void => {
    pausedBefore = ctx.loop.paused;
    ctx.loop.paused = true;
    ctx.input.enabled = false;
    s.screen.value = to;
    ctx.audio.play('uiClick');
  };
  const leaveModal = (): void => {
    s.screen.value = 'play';
    ctx.loop.paused = pausedBefore;
    ctx.input.enabled = true;
    ctx.audio.play('uiClick');
    focusGame();
  };
  const openLoom = (): void => {
    if (s.screen.value !== 'play') return;
    loom.st.syncFromLoadout();
    loom.st.open.value = true;
    ctx.uiRoot.classList.add('rl-looming');
    enterModal('loom');
  };
  const closeLoom = (): void => {
    if (s.screen.value !== 'loom') return;
    loom.st.commitNotation();
    loom.st.open.value = false;
    loom.st.disarm();
    ctx.uiRoot.classList.remove('rl-looming');
    leaveModal();
  };
  const { open: openItemGet, close: closeItemGet } = itemGetActions(itemGet, {
    screen: s.screen,
    enterModal: () => enterModal('itemGet'),
    leaveModal,
    openLoom,
    loom: loom.st,
    fanfare: () => ctx.audio.play('elementFanfare'),
    holdRune: (rune) => ctx.renderer?.holdRune?.(rune),
  });
  /**
   * The Hearth menu keeps the sim running while the player stands in the hub (nothing hostile is
   * there), so its counters and timers move live; every other menu pauses it, as does the Hearth
   * menu away from the hub. A loop that was paused before the menu stays paused.
   */
  const settlePause = (id: MenuId): void => {
    const live =
      id === 'hearth' &&
      !pausedBefore &&
      !ctx.session.state.player.dead &&
      readHearthSummary(ctx.session).inHearth;
    ctx.loop.paused = !live;
  };
  /** Opens a menu (from play, or switching from another), or closes it with null. */
  const menu = (id: MenuId | null): void => {
    const cur = s.screen.value;
    if (id === null) {
      if (isMenu(cur)) leaveModal();
    } else if (cur === 'play') {
      if (ctx.session.state.mode !== 'adventure') return;
      enterModal(id);
      settlePause(id);
    } else if (isMenu(cur) && cur !== id) {
      s.screen.value = id;
      settlePause(id);
      ctx.audio.play('uiClick');
    }
  };
  /** The "While you were away" summary: the game waits behind it. */
  const dismissOffline = (): void => {
    if (!flow?.offline.peek()) return;
    flow.offline.value = null;
    ctx.loop.paused = false;
    ctx.input.enabled = true;
    focusGame();
  };

  if (s.screen.value === 'start' || s.screen.value === 'title') ctx.loop.paused = true;
  s.screen.subscribe((v) => {
    ctx.uiRoot.classList.toggle('rl-starting', v === 'start' || v === 'title');
    ctx.uiRoot.classList.toggle('rl-menu-open', isMenu(v));
  });

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
      const screen = s.screen.value;
      if (consoleOpen.value) return;
      if (flow?.offline.peek() && screen === 'play') {
        if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Escape' || e.code === 'Space')
          dismissOffline();
        e.preventDefault();
        // The key that closes the summary must not also reach the game's input (Space would dodge).
        e.stopImmediatePropagation();
        return;
      }
      if (screen === 'itemGet') {
        itemGetKey(e, closeItemGet);
        return;
      }
      if (screen === 'loom' && loom.handleKey(e, closeLoom)) return;
      if (isMenu(screen)) {
        menuKey(e, screen, menu);
        return;
      }
      if (e.code === 'Tab' && screen === 'play' && !e.repeat) {
        e.preventDefault();
        openLoom();
        return;
      }
      if (e.repeat) return;
      const m = menuForKey(e.code);
      if (m && screen === 'play' && !isTypingTarget(e.target)) {
        e.preventDefault();
        menu(m);
      } else if (e.code === 'Escape') {
        if (screen === 'play') pause();
        else if (screen === 'pause') resume();
      } else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && screen === 'start') {
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

  // Loom Stones don't open the map by themselves (a new game starts on one, and walking past a
  // stone would interrupt a fight); their toast points to M.
  const adv = createAdventureHud({ session: ctx.session, showBanner });
  const tick = (): void => ctx.audio.play('uiClick');

  render(
    h(HudApp, {
      s,
      session: ctx.session,
      play,
      pause: {
        resume,
        restart,
        tick,
        places: sandboxScenes(),
        get place() {
          return ctx.session.sceneId;
        },
        goTo,
        get adventure() {
          if (!flow?.inAdventure()) return null;
          return {
            slots: flow.slots.value,
            persistent: flow.persistent.value,
            saveTo: flow.saveTo,
            exportSave: flow.exportCurrent,
            quitToTitle: toTitle,
          };
        },
      },
      loom,
      closeLoom,
      dismissOffline,
      itemGet: { view: itemGet.view, close: closeItemGet },
      adv,
      flow,
      menu,
      started: () => {
        ctx.audio.unlock();
        ctx.audio.play('uiStart');
        toPlay();
        // Offline progress was applied on load: show it before the game runs.
        if (flow?.offline.peek()) {
          ctx.loop.paused = true;
          ctx.input.enabled = false;
        }
      },
      scenes: ctx.devScenes ? sandboxScenes() : null,
      onScene: goTo,
      tick,
    }),
    root,
  );

  // The loadout is re-read when the UI or anything else recorded a loadout edit (console, replays,
  // scripts), and twice a second anyway.
  let view: LoadoutView = getLoadout(ctx.session);
  let viewRev = loadoutRev.peek();
  let viewEdits = ctx.session.loadoutEdits.length;
  let viewAge = 0;

  const hud: Hud = {
    handleEvents(events) {
      for (const e of events) {
        if (e.type === 'castFailed') s.deny.value = { slot: e.slot, n: s.deny.peek().n + 1 };
        else if (e.type === 'hit' && e.target === 'player') s.hurt.value = s.hurt.peek() + 1;
      }
      adv.handleEvents(events);
      // A hub station's Interact opens its Hearth screen (M7).
      const tab = stationTabFor(events as unknown as LooseEvent[]);
      if (tab && s.screen.peek() === 'play' && ctx.session.state.mode === 'adventure') {
        hearthTab.value = tab;
        menu('hearth');
      }
      itemGet.handleEvents(events);
      flow?.handleEvents(events);
    },
    frame(state) {
      const edits = ctx.session.loadoutEdits.length;
      const swapped = view.activeBar !== state.weaves.activeBar;
      if (swapped || viewRev !== loadoutRev.peek() || edits !== viewEdits || ++viewAge >= 30) {
        view = getLoadout(ctx.session);
        viewRev = loadoutRev.peek();
        viewEdits = edits;
        viewAge = 0;
      }
      const scr = s.screen.peek();
      if (scr === 'loom' || scr === 'itemGet' || isMenu(scr)) ctx.input.enabled = false;
      if (scr === 'play' && !state.player.dead) {
        const rune = itemGet.due();
        if (rune) openItemGet(rune);
      }
      const next = readSnap(
        state,
        slotSnaps(view, state.player, (i) => slotTimers(state, i)),
        barSnap(view),
      );
      if (!snapEqual(s.snap.peek(), next)) s.snap.value = next;
      adv.frame();
      hearthUnlocked.value = !!adv.snap.value.hearth && state.mode === 'adventure';
      const w = watcher.update(readArena(state));
      if (w.transition === 'cleared') showBanner(`Wave ${w.wave} cleared`, 'Catch your breath');
      else if (w.transition === 'started') showBanner(`Wave ${w.wave}`, 'Incoming');
    },
    debug: {
      open(screen) {
        if (screen.startsWith('title')) {
          s.screen.value = 'title';
          ctx.loop.paused = true;
          titleView.value = (screen.split(':')[1] as TitleView | undefined) ?? 'menu';
          return;
        }
        // Keeps the loop's paused state, so screenshots stay still.
        if (s.screen.peek() !== 'play') s.screen.value = 'play';
        if (screen === 'loom') openLoom();
        else if (screen === 'pause') pause();
        else if (isMenu(screen)) {
          if (ctx.session.state.mode === 'adventure') enterModal(screen);
        }
      },
      events(events) {
        hud.handleEvents(events as unknown as SimEvent[]);
      },
      hold(on) {
        holdToasts(on);
        ctx.uiRoot.classList.toggle('rl-hold', on);
      },
    },
  };
  return hud;
}
