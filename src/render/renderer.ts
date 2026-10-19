import { Application, Container } from 'pixi.js';
import { actionSpeed, type GameState, type SimEvent } from '../sim';
import { settings } from '../app/settings';
import { AiOverlay } from './aiOverlay';
import { AilmentFx } from './ailmentFx';
import { ailmentAtlasEntries } from './ailmentShapes';
import { AmbientView } from './ambientView';
import { labStations, type LabStation } from '../../data/lab';
import { LabLabels } from './labLabels';
import { DEBUG_BITS } from './terrain/glslDebug';
import { TerrainFx } from './terrain/terrainFx';
import { TerrainView } from './terrain/terrainView';
import { Atlas } from './atlas';
import { Camera } from './camera';
import { CombatEvents } from './combatEvents';
import { FX } from './combatPalette';
import { DamageNumbers } from './damageNumbers';
import { elementAtlasEntries, spellLook } from './elementLook';
import { FormLayer } from './forms/formLayer';
import { formAtlasEntries } from './forms/formShapes';
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
  /** Grid overlays (M3): flat material colors, fire heat, charge, wet, effect owner. */
  material: boolean;
  fire: boolean;
  charge: boolean;
  wet: boolean;
  owner: boolean;
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
  stats(): {
    enemies: number;
    projectiles: number;
    particles: number;
    playerFxAlpha: number;
    /** CPU ms of the last terrain pack + upload (0 on frames without a grid change). */
    terrainUploadMs: number;
    /** CPU ms of the last terrain pack alone. */
    terrainPackMs: number;
  };
  /**
   * Chemistry Lab plaques: the stations whose labels to draw. By default the lab scene
   * (`?scene=lab`) shows data/lab.ts `labStations` and other scenes none.
   */
  setLabStations(stations: readonly LabStation[]): void;
  destroy(): void;
}

/** Staff glow color for the slot being cast: its root spell's element, gold for melee forms. */
function castTint(s: GameState): number {
  const slot = s.player.castSlot;
  const root = slot >= 0 ? s.weaves.slots[slot]?.program?.root : undefined;
  if (!root) return FX.strikeEdge;
  if (root.elements.length === 0 && (root.form === 'strike' || root.form === 'swath')) return FX.strikeEdge;
  return spellLook(root.elements).rim;
}

function smoothstep(a: number, b: number, v: number): number {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * The renderer. Reads sim state and never writes it (CLAUDE.md rule 2). All animation state
 * (camera, springs, particles, shake) lives here, driven by frameDt.
 *
 * World layers, bottom to top (1 unit = 1 cell): grid terrain floor → baked blocks and props →
 * brazier flames → terrain fire, glow and hazard edges → corpses → enemy shadows → player bolts
 * and effects (dimmed when busy) → enemy telegraphs → ember glows → enemies → afterimages →
 * player → smoke and steam → enemy shots → readable effects (clanks, hurt) → lab plaques → debug
 * (AI, grid overlays, hitboxes).
 * Screen layers: damage numbers, AI labels, hurt vignette.
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
    // The terrain shader is GLSL (src/render/terrain).
    preference: 'webgl',
  });
  host.appendChild(app.canvas);

  const atlas = new Atlas(app.renderer, [
    ...enemyAtlasEntries(),
    ...fxAtlasEntries(),
    ...ailmentAtlasEntries(),
    ...elementAtlasEntries(),
    ...formAtlasEntries(),
  ]);
  const world = new Container();
  const terrain = new TerrainView();
  const room = new RoomView();
  const ambient = new AmbientView();
  const labels = new LabLabels();
  const labScene = new URLSearchParams(location.search).get('scene') === 'lab';
  let labOverride: readonly LabStation[] | null = null;
  const player = new PlayerView();
  const overlay = new OverlayView();
  const enemies = new EnemyLayer(atlas);
  const fx = new FxView(atlas);
  const projectiles = new ProjectileView(atlas, fx.pNorm);
  const telegraphs = new TelegraphView(app.renderer);
  const numbers = new DamageNumbers();
  const ailments = new AilmentFx(atlas);
  const forms = new FormLayer(atlas, fx);
  const ai = new AiOverlay();
  const shake = new Shake();
  const terrainFx = new TerrainFx(atlas, shake);
  world.addChild(
    terrain.ground,
    room.root,
    ambient.root,
    terrain.fire,
    terrainFx.ground,
    enemies.corpses,
    enemies.shadows.container,
    forms.ground,
    projectiles.player,
    fx.player,
    telegraphs.root,
    enemies.glows.container,
    ailments.glows.container,
    enemies.bodies,
    ailments.over.container,
    ailments.fx,
    forms.air,
    player.ghostLayer,
    player.root,
    ailments.threat,
    terrain.air,
    terrainFx.top,
    projectiles.enemy,
    fx.top,
    ailments.icons.pool.container,
    labels.root,
    ai.world,
    terrain.debug,
    overlay.root,
  );
  app.stage.addChild(world, ailments.edge, numbers.root, ai.labels, ailments.debug.labels, fx.vignette);
  ai.hide();

  const camera = new Camera();
  const overlays: Overlays = {
    grid: false,
    hitboxes: false,
    aiTargets: false,
    material: false,
    fire: false,
    charge: false,
    wet: false,
    owner: false,
  };
  let time = 0;
  let current = state;
  let dim = 1;
  const events = new CombatEvents({
    enemies,
    fx,
    ailments,
    forms,
    projectiles,
    player,
    numbers,
    telegraphs,
    shake,
    state: () => current,
  });

  const setRoom = (s: GameState): void => {
    current = s;
    terrain.setGrid(s.grid);
    const map = room.build(s.room, s.grid);
    room.sync(s.grid, terrain.blockCells);
    ambient.build(map);
    labels.set(labOverride ?? (labScene ? labStations : []));
    player.reset();
    overlay.invalidate();
    enemies.reset();
    projectiles.reset();
    telegraphs.reset();
    fx.reset();
    terrainFx.reset();
    ailments.reset();
    forms.reset();
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

      terrain.debugFlags =
        (overlays.material ? DEBUG_BITS.material : 0) |
        (overlays.fire ? DEBUG_BITS.fire : 0) |
        (overlays.charge ? DEBUG_BITS.charge : 0) |
        (overlays.wet ? DEBUG_BITS.wet : 0) |
        (overlays.owner ? DEBUG_BITS.owner : 0);
      const version = terrain.version;
      terrain.update(s.grid, time);
      terrainFx.update(dt);
      terrain.setPulses(terrainFx.pulses, terrainFx.clock);
      // Burnable props char and vanish with their cells (16 cells per prop, cheap); blocks
      // re-bake only when the count of block cells changes.
      if (terrain.version !== version) room.sync(s.grid, terrain.blockCells);
      ambient.update(time);
      player.animSpeed = actionSpeed(s, p);
      player.castTint = castTint(s);
      player.update(p, x, y, s.tuning.player, dt);
      enemies.update(s, alpha, dt);
      const xf = { scale: camera.scale, ox, oy, screenScale };
      ailments.update(s, enemies, player, dt, xf, screen.width, screen.height, overlays.hitboxes);
      projectiles.update(s, alpha, dt);
      forms.update(s, alpha, dt, x, y);
      telegraphs.update(s, dt);
      fx.update(dt, screen.width, screen.height);
      numbers.root.visible = settings.damageNumbers;
      numbers.update(dt, camera.scale, ox, oy, screenScale);

      // Busy screens dim the player's own effects toward the effect-density setting (DESIGN §14).
      const busy = enemies.count + projectiles.count / 4 + (fx.particleCount + ailments.particleCount + forms.particleCount) / 40;
      const target = 1 - smoothstep(FX.busyStart, FX.busyFull, busy) * (1 - settings.effectDensity);
      dim += (target - dim) * (1 - Math.exp(-dt / 0.3));
      projectiles.player.alpha = dim;
      fx.player.alpha = dim;
      ailments.fx.alpha = dim;
      forms.ground.alpha = forms.air.alpha = dim;

      if (overlays.aiTargets) ai.update(s, enemies, camera.scale, ox, oy, screenScale);
      else ai.hide();
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
      terrainFx.handle(list, current);
    },
    stats: () => ({
      enemies: enemies.count,
      projectiles: projectiles.count,
      particles: fx.particleCount + ailments.particleCount + forms.particleCount + terrainFx.particleCount,
      playerFxAlpha: dim,
      terrainUploadMs: terrain.lastUploadMs,
      terrainPackMs: terrain.lastPackMs,
    }),
    setLabStations(stations) {
      labOverride = stations;
      labels.set(stations);
    },
    destroy() {
      terrain.destroy();
      app.destroy(true, { children: true });
    },
  };
}
