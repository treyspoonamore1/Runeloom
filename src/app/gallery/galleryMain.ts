/**
 * `?scene=gallery`: every M4 sprite, object state, loot type, rarity look and telegraph on a plain
 * floor, labeled, for screenshots (`npm run shots -- --set gallery`). Render-only: it builds a game
 * state, poses stand-ins every frame and never steps the sim.
 *
 * window.__gallery drives it from Playwright: show a section, advance time, run the crowd stress
 * test and measure render time.
 */
import { Container } from 'pixi.js';
import { label } from './galleryLabel';
import { createGame, type GameState, type SimEvent } from '../../sim';
import { createRenderer, type Renderer } from '../../render/renderer';
import { poseActors, spawnActor, type Actor, type ActorSpec } from './galleryActors';
import { beastSpecs, raritySpecs, telegraphSpecs } from './galleryBeasts';
import {
  crowdRoomText,
  galleryRoomText,
  sectionAt,
  sectionCenter,
  SECTION_IDS,
  type SectionId,
} from './galleryRoom';
import { GalleryWorld } from './galleryWorld';
import { crowdSpecs } from './galleryCrowd';

export interface GalleryHandle {
  ready: boolean;
  state: GameState;
  renderer: Renderer;
  sections: readonly SectionId[];
  /** Points the camera at a section (zoom 2, or 1 for the crowd) and restarts its clock. */
  show(id: SectionId): void;
  /**
   * Swaps to the crowd room with n wandering enemies at 1× zoom (M4 kinds, or the M1 kinds as a
   * baseline). show() returns to the gallery.
   */
  crowd(n: number, legacy?: boolean): void;
  /** Advances gallery time by `seconds` in steps of 1/60 s, rendering every `every`-th frame. */
  advance(seconds: number, every?: number): Promise<void>;
  /** Plays a room transition (fade from black) now. */
  roomFade(): void;
  /** Stops windups at this progress (0–1), or null to let them cycle. */
  hold(progress: number | null): void;
  /** Mean and p95 CPU ms of renderer.render over `frames` frames (the loop is paused meanwhile). */
  measure(frames: number): Promise<{ mean: number; p95: number; fps: number }>;
}

declare global {
  interface Window {
    __gallery?: GalleryHandle;
  }
}

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

export async function bootGallery(): Promise<void> {
  const state = createGame({ seed: 1, roomText: galleryRoomText(), spawnRoomEnemies: false });
  state.cheats.god = true;
  state.tuning.camera.lookAhead = 0;
  state.tuning.camera.zoom = 2;
  const renderer = await createRenderer(document.getElementById('game')!, state);
  const actors: Actor[] = [];
  const labels = new Container();
  renderer.world.addChild(labels);
  const add = (specs: ActorSpec[]): void => {
    for (const spec of specs) {
      actors.push(spawnActor(state, spec));
      labels.addChild(label(spec.label, spec.x, spec.y + 4.2));
    }
  };
  add(beastSpecs());
  add(raritySpecs());
  add(telegraphSpecs());
  const world = new GalleryWorld(state, renderer, labels);
  for (const id of SECTION_IDS) {
    const c = sectionCenter(id);
    labels.addChild(label(id.toUpperCase(), c.x, c.y - 23.2, 1.5, 0xffe58a));
  }
  state.events.length = 0;

  let current = state;
  let crowd: Actor[] = [];
  let t = 0;
  let hold: number | null = null;
  let section: SectionId = 'beasts';
  let paused = false;
  let spawnClock = 0;
  /** Seconds since the last drawn frame (advance() draws every n-th frame). */
  let undrawn = 0;
  /** Events since the last drawn frame, delivered with it (as the game loop does). */
  let pending: SimEvent[] = [];
  const frame = (dt: number, draw: boolean): void => {
    t += dt;
    undrawn += dt;
    const rdt = undrawn;
    if (draw) undrawn = 0;
    if (current !== state) {
      poseActors(crowd, t, null);
      if (draw) {
        renderer.handleEvents([]);
        renderer.render(current, 1, rdt);
      }
      return;
    }
    poseActors(actors, t, hold, (a) => sectionAt(a.spec.x, a.spec.y) === section);
    world.update(t, dt);
    // Brood Kilns that hatch: a mite spawn event beside them every 5 s (the signals time the glow).
    const events: SimEvent[] = world.takeEvents();
    spawnClock += dt;
    if (spawnClock >= 5 || t === dt) {
      spawnClock = t === dt ? 3.6 : 0;
      for (const a of actors)
        if (a.spec.spawns)
          events.push({ type: 'enemySpawn', id: -1, kind: 'kiln_mite', x: a.e.x, y: a.e.y + 2 });
    }
    pending.push(...events);
    if (draw) {
      renderer.handleEvents(pending);
      pending = [];
      renderer.render(state, 1, rdt);
    }
  };
  const show = (id: SectionId): void => {
    if (current !== state) {
      current = state;
      labels.visible = true;
      renderer.setRoom(state);
    }
    section = id;
    const c = sectionCenter(id);
    renderer.follow = c;
    state.tuning.camera.zoom = 2;
    t = 0;
    spawnClock = 0;
    world.show(id);
  };
  show('beasts');

  let last = performance.now();
  const loop = (): void => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!paused) frame(dt, true);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  window.__gallery = {
    ready: false,
    state,
    renderer,
    sections: SECTION_IDS,
    show,
    crowd(n, legacy = false) {
      const cs = createGame({ seed: 2, roomText: crowdRoomText(), spawnRoomEnemies: false });
      cs.tuning.camera.lookAhead = 0;
      cs.tuning.camera.zoom = 1;
      crowd = crowdSpecs(n, legacy).map((spec) => spawnActor(cs, spec));
      cs.events.length = 0;
      cs.player.x = cs.player.prevX = 104;
      cs.player.y = cs.player.prevY = 64;
      current = cs;
      labels.visible = false;
      renderer.setRoom(cs);
      renderer.follow = { x: 104, y: 64 };
      t = 0;
    },
    async advance(seconds, every = 6) {
      paused = true;
      const n = Math.round(seconds * 60);
      for (let i = 0; i < n; i++) {
        const draw = i % every === every - 1 || i === n - 1;
        frame(1 / 60, draw);
        if (draw) await raf();
      }
    },
    hold(p) {
      hold = p;
    },
    roomFade() {
      world.roomFade(t);
    },
    async measure(frames) {
      paused = true;
      const ms: number[] = [];
      const t0 = performance.now();
      for (let i = 0; i < frames; i++) {
        const a = performance.now();
        frame(1 / 60, true);
        ms.push(performance.now() - a);
        await raf();
      }
      const wall = (performance.now() - t0) / 1000;
      ms.sort((x, y) => x - y);
      const mean = ms.reduce((x, y) => x + y, 0) / ms.length;
      return { mean, p95: ms[Math.floor(ms.length * 0.95)]!, fps: frames / wall };
    },
  };
  await raf();
  await raf();
  window.__gallery.ready = true;
}
