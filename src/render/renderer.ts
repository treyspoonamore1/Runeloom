import { Application, Container } from 'pixi.js';
import type { GameState, SimEvent } from '../sim';
import { settings } from '../app/settings';
import { AmbientView } from './ambientView';
import { Atlas } from './atlas';
import { Camera } from './camera';
import { CombatEvents } from './combatEvents';
import { FX } from './combatPalette';
import { DamageNumbers } from './damageNumbers';
import { EnemyLayer } from './enemyLayer';
import { enemyAtlasEntries } from './enemyShapes';
import { fxAtlasEntries } from './fxShapes';
import { FxView } from './fxView';
import { OverlayView } from './overlayView';
import { PAL } from './palette';
import { PlayerView } from './playerView';
import { ProjectileView } from './projectileView';
import { RoomView } from './roomView';
import { Shake } from './shake';
import { TelegraphView } from './telegraphView';

/** Debug overlay switches, toggled from the debug UI (F1). */
export interface Overlays {
  /** Cell grid and walkability. */
  grid: boolean;
  /** Collision circles and dodge state. */
  hitboxes: boolean;
  /** Enemy AI targets, modes and attack ranges. */
  aiTargets: boolean;
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
  /** Live view counts, for benchmarks and the debug overlay. */
  stats(): { enemies: number; projectiles: number; particles: number };
  destroy(): void;
}

function smoothstep(a: number, b: number, v: number): number {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * The renderer. Reads sim state and never writes it (CLAUDE.md rule 2). All animation state
 * (camera, springs, particles, shake) lives here, driven by frameDt.
 *
 * World layers, bottom to top (1 unit = 1 cell): baked room → ambient → corpses → enemy
 * shadows → player bolts and effects (dimmed when busy) → enemy telegraphs → ember glows →
 * enemies → afterimages → player → enemy shots → readable effects (clanks, hurt) → debug.
 * Screen layers: damage numbers, hurt vignette.
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

  const atlas = new Atlas(app.renderer, [...enemyAtlasEntries(), ...fxAtlasEntries()]);
  const world = new Container();
  const room = new RoomView();
  const ambient = new AmbientView();
  const player = new PlayerView();
  const overlay = new OverlayView();
  const enemies = new EnemyLayer(atlas);
  const fx = new FxView(atlas);
  const projectiles = new ProjectileView(atlas, fx.pNorm);
  const telegraphs = new TelegraphView(app.renderer);
  const numbers = new DamageNumbers();
  const shake = new Shake();
  world.addChild(
    room.root,
    ambient.root,
    enemies.corpses,
    enemies.shadows.container,
    projectiles.player,
    fx.player,
    telegraphs.root,
    enemies.glows.container,
    enemies.bodies,
    player.ghostLayer,
    player.root,
    projectiles.enemy,
    fx.top,
    overlay.root,
  );
  app.stage.addChild(world, numbers.root, fx.vignette);

  const camera = new Camera();
  const overlays: Overlays = { grid: false, hitboxes: false, aiTargets: false };
  let time = 0;
  let current = state;
  let dim = 1;
  const events = new CombatEvents({ enemies, fx, player, numbers, telegraphs, shake, state: () => current });

  const setRoom = (s: GameState): void => {
    current = s;
    const map = room.build(s.room);
    ambient.build(map);
    player.reset();
    overlay.invalidate();
    enemies.reset();
    projectiles.reset();
    telegraphs.reset();
    fx.reset();
    numbers.reset();
    shake.reset();
    camera.snap();
  };
  setRoom(state);

  return {
    app,
    overlays,
    render(s, alpha, frameDt) {
      current = s;
      const dt = Math.max(0, frameDt);
      time += dt;
      const p = s.player;
      const x = p.prevX + (p.x - p.prevX) * alpha;
      const y = p.prevY + (p.y - p.prevY) * alpha;

      const screen = app.screen;
      const screenScale = screen.height / 720;
      camera.update(x, y, s.room, screen.width, screen.height, app.renderer.resolution, s.tuning.camera, dt);
      shake.update(dt, settings.screenShake, screenScale);
      const ox = camera.offsetX + shake.x;
      const oy = camera.offsetY + shake.y;
      world.scale.set(camera.scale);
      world.position.set(ox, oy);

      ambient.update(time);
      player.update(p, x, y, s.tuning.player, dt);
      enemies.update(s, alpha, dt);
      projectiles.update(s, alpha, dt);
      telegraphs.update(s, dt);
      fx.update(dt, screen.width, screen.height);
      numbers.root.visible = settings.damageNumbers;
      numbers.update(dt, camera.scale, ox, oy, screenScale);

      // Busy screens dim the player's own effects toward the effect-density setting (DESIGN §14).
      const busy = enemies.count + projectiles.count / 4 + fx.particleCount / 40;
      const target = 1 - smoothstep(FX.busyStart, FX.busyFull, busy) * (1 - settings.effectDensity);
      dim += (target - dim) * (1 - Math.exp(-dt / 0.3));
      projectiles.player.alpha = dim;
      fx.player.alpha = dim;

      if (overlays.grid || overlays.hitboxes || overlay.root.visible) {
        overlay.root.visible = overlays.grid || overlays.hitboxes;
        overlay.update(s, overlays, x, y, camera.cursorWorld(), camera.scale);
      }
      app.render();
    },
    screenToWorld: (sx, sy) => camera.screenToWorld(sx, sy),
    setCursor: (sx, sy) => camera.setCursor(sx, sy),
    setRoom,
    handleEvents(list) {
      events.handle(list);
    },
    stats: () => ({ enemies: enemies.count, projectiles: projectiles.count, particles: fx.particleCount }),
    destroy() {
      app.destroy(true, { children: true });
    },
  };
}
