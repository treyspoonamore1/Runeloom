export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function length(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/**
 * Moves `current` toward `target` by at most `maxDelta`.
 */
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

/**
 * cos θ for a small angle (|θ| ≤ 0.3 rad: error < 1e-9), by its Taylor series. Basic float ops
 * only, so it is bit-identical on every engine, unlike Math.cos.
 */
export function smallAngleCos(t: number): number {
  const t2 = t * t;
  return 1 - (t2 / 2) * (1 - (t2 / 12) * (1 - t2 / 30));
}

/** sin θ for a small angle (|θ| ≤ 0.3 rad: error < 1e-9), by its Taylor series. */
export function smallAngleSin(t: number): number {
  const t2 = t * t;
  return t * (1 - (t2 / 6) * (1 - (t2 / 20) * (1 - t2 / 42)));
}

/**
 * Turns the unit vector (fx, fy) toward the unit vector (tx, ty) by at most the angle whose cosine
 * and sine are (c, s), writing the unit result to `out`. Snaps to the target when it is within
 * that angle; turns counterclockwise when the target is exactly behind.
 */
export function turnToward(
  fx: number,
  fy: number,
  tx: number,
  ty: number,
  c: number,
  s: number,
  out: { x: number; y: number },
): void {
  if (fx * tx + fy * ty >= c) {
    out.x = tx;
    out.y = ty;
    return;
  }
  const sign = fx * ty - fy * tx >= 0 ? 1 : -1;
  const ss = s * sign;
  const nx = fx * c - fy * ss;
  const ny = fx * ss + fy * c;
  const l = Math.sqrt(nx * nx + ny * ny);
  out.x = nx / l;
  out.y = ny / l;
}
