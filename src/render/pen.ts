import type { FillInput, GraphicsContext, StrokeInput } from 'pixi.js';

/**
 * Draws into a GraphicsContext in cells while emitting coordinates scaled by `k` (pixels per
 * cell). Pixi tessellates curves with a fixed tolerance in local units, so drawing at pixel
 * scale keeps small baked shapes smooth. Chainable like GraphicsContext.
 */
export class Pen {
  /** A subpath is open (arc continues it with a line instead of starting a new one). */
  private open = false;

  constructor(
    readonly c: GraphicsContext,
    readonly k: number,
  ) {}

  moveTo(x: number, y: number): this {
    this.c.moveTo(x * this.k, y * this.k);
    this.open = true;
    return this;
  }
  lineTo(x: number, y: number): this {
    if (!this.open) return this.moveTo(x, y);
    this.c.lineTo(x * this.k, y * this.k);
    return this;
  }
  quad(cx: number, cy: number, x: number, y: number): this {
    const k = this.k;
    this.c.quadraticCurveTo(cx * k, cy * k, x * k, y * k);
    return this;
  }
  bez(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): this {
    const k = this.k;
    this.c.bezierCurveTo(c1x * k, c1y * k, c2x * k, c2y * k, x * k, y * k);
    return this;
  }
  /**
   * Arc as a polyline (about 3° per segment), continuing the open subpath with a line or
   * starting a new one. Pixi's own arc doesn't fill reliably when chained with other arcs.
   */
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw = false): this {
    let sweep = a1 - a0;
    if (!ccw && sweep < 0) sweep += Math.PI * 2;
    if (ccw && sweep > 0) sweep -= Math.PI * 2;
    const n = Math.max(2, Math.ceil(Math.abs(sweep) / 0.05));
    for (let i = 0; i <= n; i++) {
      const a = a0 + (sweep * i) / n;
      this.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    return this;
  }
  circle(x: number, y: number, r: number): this {
    this.c.circle(x * this.k, y * this.k, r * this.k);
    this.open = false;
    return this;
  }
  ellipse(x: number, y: number, rx: number, ry: number): this {
    this.c.ellipse(x * this.k, y * this.k, rx * this.k, ry * this.k);
    this.open = false;
    return this;
  }
  rect(x: number, y: number, w: number, h: number): this {
    this.c.rect(x * this.k, y * this.k, w * this.k, h * this.k);
    this.open = false;
    return this;
  }
  roundRect(x: number, y: number, w: number, h: number, r: number): this {
    const k = this.k;
    this.c.roundRect(x * k, y * k, w * k, h * k, r * k);
    this.open = false;
    return this;
  }
  /** Closed polygon from flat [x0, y0, x1, y1, ...] in cells. */
  poly(pts: readonly number[]): this {
    this.c.poly(pts.map((v) => v * this.k));
    this.open = false;
    return this;
  }
  close(): this {
    this.c.closePath();
    this.open = false;
    return this;
  }
  fill(style: FillInput): this {
    this.c.fill(style);
    this.open = false;
    return this;
  }
  /** Stroke with `width` in cells. */
  stroke(width: number, color: number, alpha = 1, cap: 'round' | 'butt' = 'round'): this {
    const s: StrokeInput = { width: width * this.k, color, alpha, cap, join: 'round' };
    this.c.stroke(s);
    this.open = false;
    return this;
  }
}
