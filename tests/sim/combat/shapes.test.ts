import { describe, expect, it } from 'vitest';
import {
  circleHitsShape,
  circleIntersectsSector,
  pointInAttackShape,
  type AttackShape,
} from '../../../src/sim';

const COS60 = 0.5;
const E = 1e-6;

describe('circleIntersectsSector', () => {
  // Apex (0,0), facing +x, ±60°, reach 5.
  const hits = (x: number, y: number, r: number) => circleIntersectsSector(x, y, r, 0, 0, 1, 0, COS60, 5);

  it('includes points inside, on the arc and on the edge', () => {
    expect(hits(3, 0, 0)).toBe(true);
    expect(hits(5, 0, 0)).toBe(true);
    expect(hits(2.5, 2.5 * Math.sqrt(3) - E, 0)).toBe(true); // just inside the 60° edge
  });

  it('excludes points past the reach or the edge angle, and behind', () => {
    expect(hits(5 + E, 0, 0)).toBe(false);
    expect(hits(2.5, 2.5 * Math.sqrt(3) + 1e-3, 0)).toBe(false);
    expect(hits(-1, 0, 0)).toBe(false);
  });

  it('includes circles touching the arc or an edge from outside, excludes ones just short', () => {
    expect(hits(6, 0, 1 + E)).toBe(true);
    expect(hits(6, 0, 1 - E)).toBe(false);
    // Circle centered on the edge's outward normal at distance 1 from the 60° edge's midpoint.
    const ex = 0.5;
    const ey = Math.sqrt(3) / 2; // edge direction
    const nx = -ey;
    const ny = ex; // outward normal (counterclockwise side)
    const cx = 2.5 * ex + nx;
    const cy = 2.5 * ey + ny;
    expect(hits(cx, cy, 1 + E)).toBe(true);
    expect(hits(cx, cy, 1 - E)).toBe(false);
  });

  it('includes a circle that contains the apex even from behind', () => {
    expect(hits(-1, 0, 1.5)).toBe(true);
    expect(hits(-2, 0, 1.5)).toBe(false);
  });
});

describe('attack shapes', () => {
  const circle: AttackShape = { kind: 'circle', r: 2 };
  const cone: AttackShape = { kind: 'cone', r: 5, halfAngleCos: Math.SQRT1_2, dirX: 0, dirY: 1 };
  const line: AttackShape = { kind: 'line', length: 10, width: 2, dirX: 1, dirY: 0 };

  it('circle: centered on the origin', () => {
    expect(pointInAttackShape(circle, 10, 10, 11.9, 10)).toBe(true);
    expect(pointInAttackShape(circle, 10, 10, 12.1, 10)).toBe(false);
    expect(circleHitsShape(circle, 10, 10, 13, 10, 1.1)).toBe(true);
    expect(circleHitsShape(circle, 10, 10, 13, 10, 0.9)).toBe(false);
  });

  it('cone: opens along its direction from the origin', () => {
    expect(pointInAttackShape(cone, 0, 0, 0, 4)).toBe(true);
    expect(pointInAttackShape(cone, 0, 0, 2.9, 3)).toBe(true); // inside 45°
    expect(pointInAttackShape(cone, 0, 0, 3.1, 3)).toBe(false); // outside 45°
    expect(pointInAttackShape(cone, 0, 0, 0, -1)).toBe(false);
    expect(pointInAttackShape(cone, 0, 0, 0, 5.1)).toBe(false);
  });

  it('line: a rectangle from the origin along its direction', () => {
    expect(pointInAttackShape(line, 0, 0, 5, 0.99)).toBe(true);
    expect(pointInAttackShape(line, 0, 0, 5, 1.01)).toBe(false);
    expect(pointInAttackShape(line, 0, 0, -0.01, 0)).toBe(false);
    expect(pointInAttackShape(line, 0, 0, 10.01, 0)).toBe(false);
    expect(circleHitsShape(line, 0, 0, 5, 2.4, 1.5)).toBe(true);
    expect(circleHitsShape(line, 0, 0, -1.4, 0, 1.5)).toBe(true);
    expect(circleHitsShape(line, 0, 0, 12, 0, 1.5)).toBe(false);
  });
});
