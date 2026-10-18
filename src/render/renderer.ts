import { Application, Container } from 'pixi.js';
import type { GameState, SimEvent } from '../sim';
import { AmbientView } from './ambientView';
import { Camera } from './camera';
import { OverlayView } from './overlayView';
import { PAL } from './palette';
import { PlayerView } from './playerView';
import { RoomView } from './roomView';

/** Debug overlay switches, toggled from the debug UI (F1). */
export interface Overlays {
  /** Cell grid and walkability. */
  grid: boolean;
  /** Collision circles and dodge state. */
  hitboxes: boolean;
}

export interface Renderer {
  readonly app: Application;
  readonly overlays: Overlays;
  /** Draws the current state, interpolating entities by alpha between the last two ticks. */
  render(state: GameState, alpha: number, frameDt: number): void;
  /** Converts CSS pixels on the canvas to world cells, using the current camera. */
  screenToWorld(sx: number, sy: number): { x: number; y: number };
  /**
   * Cursor position in CSS pixels on the canvas. Drives the camera look-ahead,
   * which uses the cursor's screen offset (not the world aim) so it can't feed back on itself.
   */
  setCursor(sx: number, sy: number): void;
  /** Rebuilds static room graphics after a reset or room change. */
  setRoom(state: GameState): void;
  /**
   * Sim events since the last frame (Session.drainEvents), delivered once per frame before
   * render(): hit flashes, damage numbers, particles, screen shake.
   */
  handleEvents(events: readonly SimEvent[]): void;
  destroy(): void;
}

/**
 * M0 renderer. Reads sim state and never writes it (CLAUDE.md rule 2). All
 * animation state (camera, springs, trails, water phase) lives here, driven by frameDt.
 *
 * Layers, bottom to top, all in world space (1 unit = 1 cell):
 * baked room → ambient (water, flames) → afterimages → player → debug overlays.
 */
export async function createRenderer(host: HTMLElement, state: GameState): Promise<Renderer> {
  const app = new Application();
  await app.init({
    resizeTo: host,
    background: PAL.void,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    // The game loop renders once per frame after updating; no second rAF loop.
    autoStart: false,
  });
  host.appendChild(app.canvas);

  const world = new Container();
  const room = new RoomView();
  const ambient = new AmbientView();
  const player = new PlayerView();
  const overlay = new OverlayView();
  world.addChild(room.root, ambient.root, player.ghostLayer, player.root, overlay.root);
  app.stage.addChild(world);

  const camera = new Camera();
  const overlays: Overlays = { grid: false, hitboxes: false };
  let time = 0;

  const setRoom = (s: GameState): void => {
    const map = room.build(s.room);
    ambient.build(map);
    player.reset();
    overlay.invalidate();
    camera.snap();
  };
  setRoom(state);

  return {
    app,
    overlays,
    render(s, alpha, frameDt) {
      const dt = Math.max(0, frameDt);
      time += dt;
      const p = s.player;
      const x = p.prevX + (p.x - p.prevX) * alpha;
      const y = p.prevY + (p.y - p.prevY) * alpha;

      const screen = app.screen;
      camera.update(x, y, s.room, screen.width, screen.height, app.renderer.resolution, s.tuning.camera, dt);
      world.scale.set(camera.scale);
      world.position.set(camera.offsetX, camera.offsetY);

      ambient.update(time);
      player.update(p, x, y, s.tuning.player, dt);
      if (overlays.grid || overlays.hitboxes || overlay.root.visible) {
        overlay.root.visible = overlays.grid || overlays.hitboxes;
        overlay.update(s, overlays, x, y, camera.cursorWorld(), camera.scale);
      }
      app.render();
    },
    screenToWorld: (sx, sy) => camera.screenToWorld(sx, sy),
    setCursor: (sx, sy) => camera.setCursor(sx, sy),
    setRoom,
    handleEvents() {
      // M1 render task: hit flash, damage numbers, death particles, screen shake.
    },
    destroy() {
      app.destroy(true, { children: true });
    },
  };
}
