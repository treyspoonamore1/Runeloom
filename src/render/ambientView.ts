import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { TILE_CELLS as T } from '../sim';
import { LINE, PAL, hash2 } from './palette';
import type { TileMap } from './roomTiles';

interface Flame {
  root: Container;
  glow: Graphics;
  flame: Graphics;
  seed: number;
}

/**
 * Brazier flames over the baked props. Only transforms change per frame. (Water ripples moved to
 * the grid terrain shader in M3.)
 */
export class AmbientView {
  readonly root = new Container();
  private flames: Flame[] = [];
  private flameCtx: GraphicsContext | null = null;
  private glowCtx: GraphicsContext | null = null;

  build(map: TileMap): void {
    for (const f of this.flames) f.root.destroy({ children: true });
    this.flames = [];
    this.flameCtx ??= buildFlame();
    if (!this.glowCtx) {
      // Soft falloff from stacked additive discs.
      this.glowCtx = new GraphicsContext();
      for (let i = 0; i < 6; i++)
        this.glowCtx.circle(0, 0, 1 - i * 0.15).fill({ color: PAL.flameOuter, alpha: 0.2 });
    }
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) {
        if (map.at(tx, ty)?.prop !== 'brazier') continue;
        const root = new Container();
        root.position.set(tx * T + T / 2, ty * T + T / 2 + 0.1);
        const glow = new Graphics(this.glowCtx);
        glow.blendMode = 'add';
        const flame = new Graphics(this.flameCtx);
        root.addChild(glow, flame);
        this.root.addChild(root);
        this.flames.push({ root, glow, flame, seed: hash2(tx, ty, 99) * 10 });
      }
    }
  }

  update(time: number): void {
    for (const f of this.flames) {
      const t = time + f.seed;
      const n = 0.6 * Math.sin(t * 9.1) + 0.4 * Math.sin(t * 23.7 + 1.3);
      f.flame.scale.set(1 - 0.07 * n, 1 + 0.16 * n);
      f.flame.rotation = 0.07 * Math.sin(t * 5.3);
      const r = 4.2 + 0.4 * n;
      f.glow.scale.set(r, r * 0.8);
      f.glow.alpha = 0.55 + 0.12 * n;
    }
  }
}

/** Flame drawn around its base at (0, 0), pointing up. */
function buildFlame(): GraphicsContext {
  const ctx = new GraphicsContext();
  const tongue = (s: number, oy: number): GraphicsContext =>
    ctx
      .moveTo(0, -2.6 * s + oy)
      .bezierCurveTo(0.5 * s, -1.6 * s + oy, 1.25 * s, -0.9 * s + oy, 1.0 * s, -0.1 * s + oy)
      .bezierCurveTo(0.8 * s, 0.5 * s + oy, -0.8 * s, 0.5 * s + oy, -1.0 * s, -0.1 * s + oy)
      .bezierCurveTo(-1.25 * s, -0.9 * s + oy, -0.5 * s, -1.6 * s + oy, 0, -2.6 * s + oy)
      .closePath();
  tongue(1, 0)
    .fill(PAL.flameOuter)
    .stroke({ width: LINE.detail * 1.4, color: PAL.ink, join: 'round' });
  tongue(0.62, 0.05).fill(PAL.flameInner);
  tongue(0.3, 0.05).fill(PAL.flameCore);
  return ctx;
}
