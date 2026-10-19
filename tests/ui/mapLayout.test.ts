import { describe, expect, it } from 'vitest';
import { regionRooms as R } from '../../data/progression';
import { fixtureLayout } from '../../src/ui/fixtures/regionMap';
import { placeMap, roomVisibility, travelTargets, type MapLayout } from '../../src/ui/map/mapModel';

describe('region map layout', () => {
  const visited = new Set<string>([R.e1, R.e2, R.e3]);

  it('shows visited rooms, the current one, and unexplored neighbors; hides the rest', () => {
    const vis = roomVisibility(fixtureLayout, visited, R.e3);
    expect(vis.get(R.e3)).toBe('current');
    expect(vis.get(R.e1)).toBe('visited');
    expect(vis.get(R.e4)).toBe('unknown');
    expect(vis.get(R.e5)).toBe('hidden');
    expect(vis.get(R.k10)).toBe('hidden');
  });

  it('fits the layout into the box, keeping the aspect ratio and padding', () => {
    const all = new Set(fixtureLayout.rooms.map((r) => r.id));
    const m = placeMap(fixtureLayout, all, R.e1, 1000, 640, 28);
    expect(m.rooms).toHaveLength(fixtureLayout.rooms.length);
    for (const r of m.rooms) {
      expect(r.x).toBeGreaterThanOrEqual(27.9);
      expect(r.y).toBeGreaterThanOrEqual(27.9);
      expect(r.x + r.w).toBeLessThanOrEqual(1000 - 27.9);
      expect(r.y + r.h).toBeLessThanOrEqual(640 - 27.9);
    }
    const e5 = fixtureLayout.rooms.find((r) => r.id === R.e5)!;
    const p5 = m.rooms.find((r) => r.room.id === R.e5)!;
    expect(p5.w / p5.h).toBeCloseTo(e5.w / e5.h, 6);
    expect(m.regions.map((g) => g.id)).toEqual(['emberwood', 'kiln']);
  });

  it('draws links only between shown rooms, joining facing edges', () => {
    const m = placeMap(fixtureLayout, visited, R.e3, 1000, 640, 28);
    const keys = m.links.map((l) => `${l.link.a}>${l.link.b}`);
    expect(keys).toContain(`${R.e1}>${R.e2}`);
    expect(keys).toContain(`${R.e3}>${R.e4}`);
    expect(keys).not.toContain(`${R.e4}>${R.e5}`);
    const e1e2 = m.links.find((l) => l.link.a === R.e1)!;
    const e1 = m.rooms.find((r) => r.room.id === R.e1)!;
    expect(e1e2.x1).toBeCloseTo(e1.x + e1.w, 6);
    expect(e1e2.known).toBe(true);
    expect(m.links.find((l) => l.link.b === R.e4)!.known).toBe(false);
  });

  it('handles any layout scale and an empty layout', () => {
    const tiny: MapLayout = {
      regions: [],
      links: [],
      rooms: [{ id: 'a', name: 'A', region: 'r', x: 0, y: 0, w: 0.01, h: 0.02, loomStones: [] }],
    };
    const m = placeMap(tiny, new Set(['a']), 'a', 400, 400, 10);
    expect(m.rooms[0]!.h).toBeCloseTo(380, 6);
    expect(placeMap({ regions: [], links: [], rooms: [] }, new Set(), 'a', 400, 400, 10).rooms).toEqual([]);
  });

  it('offers travel to other activated Loom Stones only while standing at one', () => {
    const act = [`${R.e1}#loom_stone@10,8`, `${R.e8}#loom_stone@14,9`];
    expect(travelTargets(fixtureLayout, act, null)).toEqual([]);
    expect(travelTargets(fixtureLayout, act, { roomId: R.e8, key: 'loom_stone@14,9' })).toEqual([
      { roomId: R.e1, key: 'loom_stone@10,8', name: 'Loomstone Glade' },
    ]);
  });
});
