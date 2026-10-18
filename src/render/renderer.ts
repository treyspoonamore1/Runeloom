import { Application, Container, Graphics } from 'pixi.js';
import { CELL_PX, TILE_CELLS, type GameState } from '../sim';

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
  /** Rebuilds static room graphics after a reset or room change. */
  setRoom(state: GameState): void;
  destroy(): void;
}

/**
 * SCAFFOLD STUB: flat tiles and a circle, camera centered on the player.
 * The M0 render task replaces this with the real renderer.
 */
export async function createRenderer(host: HTMLElement, state: GameState): Promise<Renderer> {
  const app = new Application();
  await app.init({ resizeTo: host, background: '#10171a', antialias: true });
  host.appendChild(app.canvas);
  const world = new Container();
  const roomGfx = new Graphics();
  const playerGfx = new Graphics();
  world.addChild(roomGfx, playerGfx);
  app.stage.addChild(world);
  let scale = 1;
  let camX = 0;
  let camY = 0;

  const drawRoom = (s: GameState): void => {
    roomGfx.clear();
    const { room } = s;
    for (let ty = 0; ty < room.tilesH; ty++) {
      for (let tx = 0; tx < room.tilesW; tx++) {
        const ch = String.fromCharCode(room.tiles[ty * room.tilesW + tx]!);
        const color =
          ch === '#'
            ? 0x2b3a3f
            : ch === '"'
              ? 0x4f8a3c
              : ch === '~'
                ? 0x3f88c5
                : ch === 'w'
                  ? 0x1f4f8a
                  : 0x8c8f86;
        roomGfx.rect(tx * TILE_CELLS, ty * TILE_CELLS, TILE_CELLS, TILE_CELLS).fill(color);
      }
    }
  };
  drawRoom(state);

  return {
    app,
    overlays: { grid: false, hitboxes: false },
    render(s, alpha) {
      const p = s.player;
      const x = p.prevX + (p.x - p.prevX) * alpha;
      const y = p.prevY + (p.y - p.prevY) * alpha;
      playerGfx.clear().circle(x, y, s.tuning.player.radius).fill(0xf2e6c9);
      scale = (CELL_PX * app.screen.height) / 720;
      camX = x;
      camY = y;
      world.scale.set(scale);
      world.position.set(app.screen.width / 2 - camX * scale, app.screen.height / 2 - camY * scale);
    },
    screenToWorld(sx, sy) {
      return {
        x: (sx - app.screen.width / 2) / scale + camX,
        y: (sy - app.screen.height / 2) / scale + camY,
      };
    },
    setRoom: drawRoom,
    destroy() {
      app.destroy(true);
    },
  };
}
