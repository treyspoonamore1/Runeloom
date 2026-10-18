import { describe, expect, it } from 'vitest';
import { hasLineOfSight, hasWalkLine, segmentClear } from '../../../src/sim';
import { gameFromRows } from '../actors/helpers';

// Tiles are 4×4 cells. Row 2 has a wall pillar at tile x=3 (cells 12–15) and deep water at
// tile x=7 (cells 28–31); row 4 is open.
// prettier-ignore
const ROWS = [
  '############',
  '#..........#',
  '#..#...w...#',
  '#..........#',
  '#..........#',
  '############',
];

describe('line of sight (cell DDA)', () => {
  const room = gameFromRows(ROWS).room;
  const midRow2 = 2 * 4 + 2;

  it('is blocked by walls and pillars', () => {
    expect(hasLineOfSight(room, 6, midRow2, 22, midRow2)).toBe(false);
    // Diagonal through the pillar.
    expect(hasLineOfSight(room, 8, 6, 18, 14)).toBe(false);
    // Outside the room counts as blocked.
    expect(hasLineOfSight(room, 6, 6, -3, 6)).toBe(false);
  });

  it('is not blocked by water, which does block walking', () => {
    expect(hasLineOfSight(room, 22, midRow2, 38, midRow2)).toBe(true);
    expect(hasWalkLine(room, 22, midRow2, 38, midRow2)).toBe(false);
  });

  it('sees along open rows and past the pillar', () => {
    expect(hasLineOfSight(room, 6, 18, 42, 18)).toBe(true);
    expect(hasLineOfSight(room, 6, 6, 42, 6)).toBe(true);
    expect(hasLineOfSight(room, 10, 6, 10, 18)).toBe(true);
    expect(hasLineOfSight(room, 5.5, 5.5, 5.5, 5.5)).toBe(true);
  });

  it('is symmetric and visits the cells a segment crosses', () => {
    for (const [a, b, c, d] of [
      [6, 6, 22, 18],
      [8, 6, 18, 14],
      [4.2, 9.9, 40.7, 10.1],
      [15.5, 4.5, 12.5, 17.5],
    ] as const) {
      expect(hasLineOfSight(room, a, b, c, d)).toBe(hasLineOfSight(room, c, d, a, b));
    }
    // A segment ending inside a blocked cell is blocked; one stopping just short is not.
    expect(hasLineOfSight(room, 6, midRow2, 12.5, midRow2)).toBe(false);
    expect(hasLineOfSight(room, 6, midRow2, 11.9, midRow2)).toBe(true);
  });

  it("doesn't leak diagonally between two blocks that only touch at a corner", () => {
    const w = 4;
    const mask = new Uint8Array(w * w);
    mask[1 * w + 2] = 1; // cell (2, 1)
    mask[2 * w + 1] = 1; // cell (1, 2)
    const fake = { width: w, height: w } as Parameters<typeof segmentClear>[0];
    expect(segmentClear(fake, mask, 1.5, 1.5, 2.5, 2.5)).toBe(false);
    expect(segmentClear(fake, mask, 2.5, 2.5, 1.5, 1.5)).toBe(false);
  });
});
