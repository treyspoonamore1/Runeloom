/**
 * The path the Glasswater Coil's head swam, for laying its drawn body (render only): head
 * positions sampled every STEP cells, newest first, and the points `spacing` cells apart along
 * it. A new or teleported head starts a straight body behind its facing.
 */
const STEP = 0.4;
/** A jump farther than this (respawn, room change) restarts the body. */
const JUMP = 20;

export interface TrailPoint {
  x: number;
  y: number;
  /** Unit direction toward the head along the body. */
  dx: number;
  dy: number;
}

export class CoilTrail {
  private xs: number[] = [];
  private ys: number[] = [];
  private readonly out: TrailPoint[];
  private readonly max: number;

  constructor(
    private readonly count: number,
    private readonly spacing: number,
  ) {
    this.out = Array.from({ length: count }, () => ({ x: 0, y: 0, dx: 1, dy: 0 }));
    this.max = Math.ceil(((count + 2) * spacing) / STEP) + 4;
  }

  clear(): void {
    this.xs = [];
    this.ys = [];
  }

  /** Records the head at (x, y) facing (fx, fy) and lays the segment points. */
  update(x: number, y: number, fx: number, fy: number): void {
    const xs = this.xs;
    const ys = this.ys;
    if (xs.length === 0 || Math.hypot(x - xs[0]!, y - ys[0]!) > JUMP) {
      xs.length = ys.length = 0;
      for (let i = 0; i < this.max; i++) {
        xs.push(x - fx * STEP * i);
        ys.push(y - fy * STEP * i);
      }
    } else if (Math.hypot(x - xs[0]!, y - ys[0]!) >= STEP) {
      xs.unshift(x);
      ys.unshift(y);
      if (xs.length > this.max) {
        xs.length = this.max;
        ys.length = this.max;
      }
    } else {
      // Between samples the newest point follows the head, so the neck never lags.
      xs[0] = x;
      ys[0] = y;
    }
    this.lay();
  }

  /** Segment i's point (0 nearest the head). */
  at(i: number): TrailPoint {
    return this.out[Math.max(0, Math.min(this.count - 1, i))]!;
  }

  private lay(): void {
    const xs = this.xs;
    const ys = this.ys;
    let k = 0;
    let walked = 0;
    for (let i = 0; i < this.count; i++) {
      const want = (i + 1) * this.spacing;
      while (k < xs.length - 1) {
        const seg = Math.hypot(xs[k + 1]! - xs[k]!, ys[k + 1]! - ys[k]!);
        if (walked + seg >= want) break;
        walked += seg;
        k++;
      }
      const o = this.out[i]!;
      if (k >= xs.length - 1) {
        // Past the recorded path: extend straight back.
        const n = xs.length;
        const bx = n > 1 ? xs[n - 1]! - xs[n - 2]! : -1;
        const by = n > 1 ? ys[n - 1]! - ys[n - 2]! : 0;
        const l = Math.hypot(bx, by) || 1;
        const extra = want - walked;
        o.x = xs[n - 1]! + (bx / l) * extra;
        o.y = ys[n - 1]! + (by / l) * extra;
        o.dx = -bx / l;
        o.dy = -by / l;
        continue;
      }
      const ax = xs[k]!;
      const ay = ys[k]!;
      const sx = xs[k + 1]! - ax;
      const sy = ys[k + 1]! - ay;
      const l = Math.hypot(sx, sy) || 1;
      const t = (want - walked) / l;
      o.x = ax + sx * t;
      o.y = ay + sy * t;
      o.dx = -sx / l;
      o.dy = -sy / l;
    }
  }
}
