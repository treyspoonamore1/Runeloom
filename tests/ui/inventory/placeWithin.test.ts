import { describe, expect, it } from 'vitest';
import { placeWithin } from '../../../src/ui/menus/frame';

const bag = { x: 313, y: 70, w: 640, h: 620 };
const tile = (x: number, y: number) => ({ x, y, w: 62, h: 62 });

describe('tooltip placed over a panel', () => {
  it('goes below the anchor, starting at its left edge', () => {
    expect(placeWithin(tile(400, 120), 300, 200, 1280, 720, bag)).toEqual({ x: 400, y: 192 });
  });

  it('stays inside the panel: a tile near the right edge pulls the tooltip left', () => {
    expect(placeWithin(tile(900, 120), 600, 200, 1280, 720, bag)).toEqual({ x: 353, y: 192 });
    expect(placeWithin(tile(300, 120), 300, 200, 1280, 720, bag).x).toBe(313);
  });

  it('goes above the anchor when there is no room below', () => {
    expect(placeWithin(tile(400, 600), 300, 200, 1280, 720, bag)).toEqual({ x: 400, y: 390 });
  });

  it('sits at the bottom of the viewport when neither side fits', () => {
    const p = placeWithin(tile(400, 300), 300, 650, 1280, 720, bag);
    expect(p.y).toBe(60);
    expect(placeWithin(tile(400, 300), 300, 900, 1280, 720, bag).y).toBe(10);
  });

  it('never leaves the viewport on a narrow screen', () => {
    const p = placeWithin(tile(300, 200), 330, 300, 390, 844, { x: 6, y: 6, w: 378, h: 800 });
    expect(p.x).toBeGreaterThanOrEqual(10);
    expect(p.x + 330).toBeLessThanOrEqual(380);
  });
});
