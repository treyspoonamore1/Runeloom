import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { TILE_CELLS as T } from '../sim';
import { LINE, PAL, WATER, hash2 } from './palette';
import { edgeRuns, type TileMap } from './roomTiles';

interface Flame {
  root: Container;
  glow: Graphics;
  flame: Graphics;
  seed: number;
}

/**
 * Cheap ambient animation over the baked room. Water ripples are pre-built into
 * a loop of GraphicsContexts at setRoom and the view swaps which one it shows,
 * so a frame does no tessellation. Brazier flames only change transforms.
 */
export class AmbientView {
  readonly root = new Container();
  private readonly water = new Graphics();
  private readonly flameLayer = new Container();
  private readonly empty = new GraphicsContext();
  private frames: GraphicsContext[] = [];
  private shown = -1;
  private flames: Flame[] = [];
  private flameCtx: GraphicsContext | null = null;
  private glowCtx: GraphicsContext | null = null;

  constructor() {
    this.root.addChild(this.water, this.flameLayer);
  }

  build(map: TileMap): void {
    this.water.context = this.empty;
    for (const f of this.frames) f.destroy();
    this.frames = [];
    for (let i = 0; i < WATER.frames; i++) this.frames.push(buildWaterFrame(map, i / WATER.frames));
    this.shown = -1;

    for (const f of this.flames) f.root.destroy({ children: true });
    this.flames = [];
    this.flameCtx ??= buildFlame();
    if (!this.glowCtx) {
      // Soft falloff from stacked additive discs.
      this.glowCtx = new GraphicsContext();
      for (let i = 0; i < 6; i++) this.glowCtx.circle(0, 0, 1 - i * 0.15).fill({ color: PAL.flameOuter, alpha: 0.2 });
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
        this.flameLayer.addChild(root);
        this.flames.push({ root, glow, flame, seed: hash2(tx, ty, 99) * 10 });
      }
    }
  }

  update(time: number): void {
    if (this.frames.length > 0) {
      const u = (time / WATER.period) * this.frames.length;
      const i = Math.floor(u) % this.frames.length;
      if (i !== this.shown) {
        this.water.context = this.frames[i]!;
        this.shown = i;
      }
      this.water.alpha = 0.85 + 0.15 * Math.sin((time / WATER.period) * Math.PI * 2);
    }
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

/** One frame of the water loop at phase in [0, 1). */
function buildWaterFrame(map: TileMap, phase: number): GraphicsContext {
  const ctx = new GraphicsContext();
  const tau = Math.PI * 2;
  for (const kind of ['shallow', 'deep'] as const) {
    let any = false;
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) {
        if (map.groundAt(tx, ty) !== kind) continue;
        const marks = kind === 'shallow' ? 2 : 1;
        for (let m = 0; m < marks; m++) {
          const q = (phase + hash2(tx, ty, 50 + m)) % 1;
          const life = Math.sin(Math.PI * q);
          if (life < 0.2) continue;
          const len = (kind === 'shallow' ? 0.55 : 0.85) * (0.5 + 0.5 * life);
          const cx = tx * T + 0.9 + hash2(tx, ty, 60 + m) * 2.2 + (q - 0.5) * WATER.drift;
          const cy = ty * T + 1.0 + hash2(tx, ty, 70 + m) * 2.2;
          ctx.moveTo(cx - len, cy).quadraticCurveTo(cx, cy - len * 0.7, cx + len, cy);
          any = true;
        }
      }
    }
    if (any) {
      ctx.stroke({
        width: LINE.detail * (kind === 'shallow' ? 1.2 : 1.5),
        color: kind === 'shallow' ? PAL.shallowRipple : PAL.deepRipple,
        cap: 'round',
      });
    }
  }

  // Dashed foam along the shallow shoreline, breathing in and out.
  const isWater = (tx: number, ty: number): boolean => {
    const g = map.groundAt(tx, ty);
    return g === 'shallow' || g === 'deep';
  };
  const inset = 0.45 + 0.2 * Math.sin(phase * tau);
  let anyFoam = false;
  for (const { edge, side } of edgeRuns(map, isWater, (x, y) => map.at(x, y) !== undefined)) {
    const horizontal = edge.y0 === edge.y1;
    const along0 = horizontal ? edge.x0 : edge.y0;
    const along1 = horizontal ? edge.x1 : edge.y1;
    const off = side === 'n' || side === 'w' ? -inset : inset;
    for (let a = along0; a < along1; a++) {
      const h = hash2(horizontal ? a : edge.x0, horizontal ? edge.y0 : a, 80);
      const s = a * T + 0.4 + h * 0.6;
      const e = (a + 1) * T - 0.4 - (1 - h) * 0.6;
      if (horizontal) ctx.moveTo(s, edge.y0 * T + off).lineTo(e, edge.y0 * T + off);
      else ctx.moveTo(edge.x0 * T + off, s).lineTo(edge.x0 * T + off, e);
      anyFoam = true;
    }
  }
  if (anyFoam) ctx.stroke({ width: LINE.detail * 1.4, color: PAL.foam, alpha: 0.8, cap: 'round' });
  return ctx;
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
  tongue(1, 0).fill(PAL.flameOuter).stroke({ width: LINE.detail * 1.4, color: PAL.ink, join: 'round' });
  tongue(0.62, 0.05).fill(PAL.flameInner);
  tongue(0.3, 0.05).fill(PAL.flameCore);
  return ctx;
}
