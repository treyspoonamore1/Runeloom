import { Container, Graphics, GraphicsContext, Rectangle, Texture, type Renderer } from 'pixi.js';
import { Pen } from './pen';

/**
 * One texture atlas for every baked combat shape (enemy parts, projectiles, particles), so
 * sprites batch into few draw calls and ParticleContainers (which need one shared source) work.
 *
 * Entries are drawn in cells with a Pen (tessellated at pixel scale), with (0, 0) as the anchor. The atlas is
 * rendered once at RES pixels per cell with mipmaps; its textures measure in cells, so a sprite
 * at scale 1 shows the drawing at its drawn size in world space.
 */
export const RES = 24;
const SIZE = 2048;
/** Gap around each entry, cells, so mipmaps and linear filtering never bleed into neighbours. */
const PAD = 0.5;

export interface AtlasEntry {
  name: string;
  /** Bounds of the drawing relative to its anchor (0, 0), cells. Strokes included. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  draw(p: Pen): void;
}

export class Atlas {
  private readonly textures = new Map<string, Texture>();

  constructor(renderer: Renderer, entries: readonly AtlasEntry[]) {
    // Whole cells: generateTexture truncates its frame to whole units.
    const sizeCells = Math.floor(SIZE / RES);
    const stage = new Container();
    // Shelf packing, tallest first.
    const order = [...entries].sort((a, b) => b.y1 - b.y0 - (a.y1 - a.y0));
    let cx = 0;
    let cy = 0;
    let shelf = 0;
    const placed: Array<{ e: AtlasEntry; frame: Rectangle; ox: number; oy: number }> = [];
    for (const e of order) {
      const w = e.x1 - e.x0 + PAD * 2;
      const h = e.y1 - e.y0 + PAD * 2;
      if (cx + w > sizeCells) {
        cx = 0;
        cy += shelf;
        shelf = 0;
      }
      if (cy + h > sizeCells) throw new Error(`Atlas full at "${e.name}"`);
      const ctx = new GraphicsContext();
      e.draw(new Pen(ctx, RES));
      const g = new Graphics(ctx);
      g.scale.set(1 / RES);
      const ox = cx + PAD - e.x0;
      const oy = cy + PAD - e.y0;
      g.position.set(ox, oy);
      stage.addChild(g);
      // Frame: the entry plus half the pad, snapped outward to whole pixels.
      const fx0 = Math.floor((cx + PAD / 2) * RES) / RES;
      const fy0 = Math.floor((cy + PAD / 2) * RES) / RES;
      const fx1 = Math.ceil((cx + w - PAD / 2) * RES) / RES;
      const fy1 = Math.ceil((cy + h - PAD / 2) * RES) / RES;
      placed.push({ e, frame: new Rectangle(fx0, fy0, fx1 - fx0, fy1 - fy0), ox, oy });
      cx += w;
      shelf = Math.max(shelf, h);
    }
    const base = renderer.generateTexture({
      target: stage,
      frame: new Rectangle(0, 0, sizeCells, sizeCells),
      resolution: RES,
      antialias: true,
      textureSourceOptions: { autoGenerateMipmaps: true, scaleMode: 'linear' },
    });
    stage.destroy({ children: true, context: true });
    for (const { e, frame, ox, oy } of placed) {
      const tex = new Texture({
        source: base.source,
        frame,
        defaultAnchor: { x: (ox - frame.x) / frame.width, y: (oy - frame.y) / frame.height },
      });
      this.textures.set(e.name, tex);
    }
  }

  get(name: string): Texture {
    const t = this.textures.get(name);
    if (!t) throw new Error(`No atlas texture "${name}"`);
    return t;
  }
}

/**
 * Bakes one drawing (cells, anchor at (0, 0), bounds x0..y1) into its own texture at `res`
 * pixels per cell. For shapes too large or too rare for the atlas (telegraphs).
 */
export function bakeTexture(
  renderer: Renderer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  res: number,
  draw: (p: Pen) => void,
): Texture {
  const stage = new Container();
  const ctx = new GraphicsContext();
  draw(new Pen(ctx, res));
  const g = new Graphics(ctx);
  g.scale.set(1 / res);
  g.position.set(-x0, -y0);
  stage.addChild(g);
  // generateTexture truncates the frame to whole units, so round up.
  const w = Math.ceil(x1 - x0);
  const h = Math.ceil(y1 - y0);
  const rt = renderer.generateTexture({
    target: stage,
    frame: new Rectangle(0, 0, w, h),
    resolution: res,
    antialias: true,
    textureSourceOptions: { scaleMode: 'linear' },
  });
  stage.destroy({ children: true, context: true });
  return new Texture({ source: rt.source, frame: new Rectangle(0, 0, w, h), defaultAnchor: { x: -x0 / w, y: -y0 / h } });
}
