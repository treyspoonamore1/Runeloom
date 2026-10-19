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
  /**
   * Results of the last `query`: indices into the rebuilt array. Overwritten by the next query
   * and replaced (grown) by a rebuild, so read it right after the query.
   */
  hits = new Int32Array(INITIAL_CAPACITY);
  private readonly bucketStart: Int32Array;
  // Rebuild scratch, per live body in array order: its bucket and its index in `bodies`.
  private bucketOf = new Int32Array(INITIAL_CAPACITY);
  private liveIndex = new Int32Array(INITIAL_CAPACITY);
  // The snapshot in bucket order (bucket k's bodies are slots bucketStart[k]..bucketStart[k+1]-1).
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
    if (n <= this.bucketOf.length) return;
    let cap = this.bucketOf.length;
    while (cap < n) cap *= 2;
    this.bucketOf = new Int32Array(cap);
    this.liveIndex = new Int32Array(cap);
    this.xs = new Float64Array(cap);
    this.ys = new Float64Array(cap);
    this.rs = new Float64Array(cap);
    this.srcIndex = new Int32Array(cap);
    this.hits = new Int32Array(cap);
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
      this.liveIndex[n] = i;
      if (b.radius > maxR) maxR = b.radius;
      start[bucket + 1]!++;
      n++;
    }
    for (let k = 1; k < start.length; k++) start[k]! += start[k - 1]!;
    // Fill buckets in array order; `start[bucket]` advances, then is restored by shifting.
    for (let j = 0; j < n; j++) {
      const k = start[this.bucketOf[j]!]!++;
      const i = this.liveIndex[j]!;
      const b = bodies[i]!;
      this.xs[k] = b.x;
      this.ys[k] = b.y;
      this.rs[k] = b.radius;
      this.srcIndex[k] = i;
    }
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
    const n = this.query(x, y, r);
    // Shrinking an array is costly; skip it when the length is already right.
    if (out.length !== n) out.length = 0;
    const hits = this.hits;
    for (let k = 0; k < n; k++) out[k] = hits[k]!;
    return n;
  }

  /**
   * False only if `query` finds nothing for any circle that lies within the cells x0..x1 ×
   * y0..y1 (integers, inclusive): no body is in the buckets such a query could scan. A cheap
   * test for hot callers whose queries are mostly empty (integer arguments, nothing to box).
   */
  anyNear(x0: number, y0: number, x1: number, y1: number): boolean {
    if (this.count === 0) return false;
    // Two cells beyond maxRadius cover the circle's last cell and the rounding in query's reach.
    const m = Math.ceil(this.maxRadius) + 2;
    const c0 = this.col(x0 - m);
    const c1 = this.col(x1 + m);
    const r0 = this.row(y0 - m);
    const r1 = this.row(y1 + m);
    const start = this.bucketStart;
    for (let row = r0; row <= r1; row++) {
      const b = row * this.cols;
      if (start[b + c1 + 1]! > start[b + c0]!) return true;
    }
    return false;
  }

  /** queryCircle into `hits` instead of an array (same indices, same order). Returns how many. */
  query(x: number, y: number, r: number): number {
    if (this.count === 0) return 0;
    const reach = r + this.maxRadius;
    const c0 = this.col(x - reach);
    const c1 = this.col(x + reach);
    const r0 = this.row(y - reach);
    const r1 = this.row(y + reach);
    const start = this.bucketStart;
    const xs = this.xs;
    const ys = this.ys;
    const rs = this.rs;
    const src = this.srcIndex;
    const hits = this.hits;
    const cols = this.cols;
    let m = 0;
    for (let row = r0; row <= r1; row++) {
      // Buckets c0..c1 of a row are contiguous slots, in bucket order.
      const end = start[row * cols + c1 + 1]!;
      for (let k = start[row * cols + c0]!; k < end; k++) {
        const dx = xs[k]! - x;
        const dy = ys[k]! - y;
        const rr = rs[k]! + r;
        if (dx * dx + dy * dy <= rr * rr) hits[m++] = src[k]!;
      }
    }
    return m;
  }
}
