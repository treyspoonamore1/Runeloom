import { describe, expect, it } from 'vitest';
import { Rng, SpatialHash, type HashBody } from '../../../src/sim';

function brute(bodies: HashBody[], x: number, y: number, r: number): number[] {
  const out: number[] = [];
  bodies.forEach((b, i) => {
    if (b.dead) return;
    const rr = b.radius + r;
    if ((b.x - x) ** 2 + (b.y - y) ** 2 <= rr * rr) out.push(i);
  });
  return out;
}

describe('SpatialHash', () => {
  it('queries match brute force (seeded, randomized, incl. out-of-bounds and dead bodies)', () => {
    const rng = new Rng(1234);
    for (let round = 0; round < 20; round++) {
      const w = 40 + rng.int(200);
      const h = 40 + rng.int(150);
      const hash = new SpatialHash(w, h, 8);
      const bodies: HashBody[] = Array.from({ length: 1 + rng.int(400) }, () => ({
        x: rng.range(-10, w + 10),
        y: rng.range(-10, h + 10),
        radius: rng.range(0.5, 4),
        dead: rng.chance(0.1),
      }));
      hash.rebuild(bodies);
      const out: number[] = [];
      for (let q = 0; q < 100; q++) {
        const x = rng.range(-5, w + 5);
        const y = rng.range(-5, h + 5);
        const r = rng.range(0, 20);
        hash.queryCircle(x, y, r, out);
        expect([...out].sort((a, b) => a - b)).toEqual(brute(bodies, x, y, r));
      }
    }
  });

  it('returns results in a deterministic order and reuses the output array', () => {
    const hash = new SpatialHash(64, 64, 8);
    const bodies = [
      { x: 30, y: 30, radius: 1 },
      { x: 2, y: 2, radius: 1 },
      { x: 31, y: 30, radius: 1 },
    ];
    hash.rebuild(bodies);
    const out = [99, 98];
    expect(hash.queryCircle(30, 30, 40, out)).toBe(3);
    // Bucket (0,0) first, then bucket (3,3) in array order.
    expect(out).toEqual([1, 0, 2]);
  });

  it('empties on rebuild', () => {
    const hash = new SpatialHash(64, 64, 8);
    hash.rebuild([{ x: 3, y: 3, radius: 1 }]);
    hash.rebuild([]);
    expect(hash.queryCircle(3, 3, 10, [])).toBe(0);
  });
});
