/**
 * Uniform-grid spatial hash for circle bodies (DESIGN §12: buckets of 8×8 cells).
 *
 * Rebuilt from scratch from an array of bodies (counting sort into buckets, no per-tick
 * allocation once warmed up). Queries return indices into that array, in a deterministic order
 * (bucket rows top to bottom, then left to right, then array order within a bucket). It snapshots
 * positions at rebuild time, so queries see the bodies where they were when it was built.
 * Bodies outside the room are clamped into the edge buckets, so they are still found.
 */
export interface HashBody {
  x: number;
  y: number;
  radius: number;
  /** Dead bodies are left out. */
  dead?: boolean;
}

const INITIAL_CAPACITY = 64;

export class SpatialHash {
  readonly cols: number;
  readonly rows: number;
  /** Number of bodies in the hash after the last rebuild. */
  count = 0;
  /** Largest radius in the hash, so queries reach bodies centered in neighboring buckets. */
  maxRadius = 0;
  private readonly bucketStart: Int32Array;
  private items = new Int32Array(INITIAL_CAPACITY);
  private bucketOf = new Int32Array(INITIAL_CAPACITY);
  private xs = new Float64Array(INITIAL_CAPACITY);
  private ys = new Float64Array(INITIAL_CAPACITY);
  private rs = new Float64Array(INITIAL_CAPACITY);
  private srcIndex = new Int32Array(INITIAL_CAPACITY);

  /** width, height: area size in cells; bucketSize: bucket edge in cells. */
  constructor(
    width: number,
    height: number,
    readonly bucketSize: number,
  ) {
    this.cols = Math.max(1, Math.ceil(width / bucketSize));
    this.rows = Math.max(1, Math.ceil(height / bucketSize));
    this.bucketStart = new Int32Array(this.cols * this.rows + 1);
  }

  private col(x: number): number {
    const c = Math.floor(x / this.bucketSize);
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  private row(y: number): number {
    const r = Math.floor(y / this.bucketSize);
    return r < 0 ? 0 : r >= this.rows ? this.rows - 1 : r;
  }

  private ensure(n: number): void {
    if (n <= this.items.length) return;
    let cap = this.items.length;
    while (cap < n) cap *= 2;
    this.items = new Int32Array(cap);
    this.bucketOf = new Int32Array(cap);
    this.xs = new Float64Array(cap);
    this.ys = new Float64Array(cap);
    this.rs = new Float64Array(cap);
    this.srcIndex = new Int32Array(cap);
  }

  /** Re-buckets every live body. Indices returned by queries refer to `bodies`. */
  rebuild(bodies: readonly HashBody[]): void {
    this.ensure(bodies.length);
    const start = this.bucketStart;
    start.fill(0);
    let n = 0;
    let maxR = 0;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i]!;
      if (b.dead) continue;
      const bucket = this.row(b.y) * this.cols + this.col(b.x);
      this.bucketOf[n] = bucket;
      this.xs[n] = b.x;
      this.ys[n] = b.y;
      this.rs[n] = b.radius;
      this.srcIndex[n] = i;
      if (b.radius > maxR) maxR = b.radius;
      start[bucket + 1]!++;
      n++;
    }
    for (let k = 1; k < start.length; k++) start[k]! += start[k - 1]!;
    // Fill buckets in array order; `start[bucket]` advances, then is restored by shifting.
    for (let j = 0; j < n; j++) this.items[start[this.bucketOf[j]!]!++] = j;
    for (let k = start.length - 1; k > 0; k--) start[k] = start[k - 1]!;
    start[0] = 0;
    this.count = n;
    this.maxRadius = maxR;
  }

  /**
   * Fills `out` with the indices of bodies whose circles touch the circle (x, y, r) and returns
   * how many there are.
   */
  queryCircle(x: number, y: number, r: number, out: number[]): number {
    out.length = 0;
    if (this.count === 0) return 0;
    const reach = r + this.maxRadius;
    const c0 = this.col(x - reach);
    const c1 = this.col(x + reach);
    const r0 = this.row(y - reach);
    const r1 = this.row(y + reach);
    const start = this.bucketStart;
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const bucket = row * this.cols + col;
        for (let k = start[bucket]!; k < start[bucket + 1]!; k++) {
          const j = this.items[k]!;
          const dx = this.xs[j]! - x;
          const dy = this.ys[j]! - y;
          const rr = this.rs[j]! + r;
          if (dx * dx + dy * dy <= rr * rr) out.push(this.srcIndex[j]!);
        }
      }
    }
    return out.length;
  }
}
