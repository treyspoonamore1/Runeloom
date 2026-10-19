/**
 * Fixture region layout (CONTENT §9) standing in for the world agent's src/sim/world/regionMap.ts,
 * plus fixture progress for screenshots: Emberwood explored up to the Kiln Approach, standing at
 * its Loom Stone.
 */
import { regionRooms as R } from '../../../data/progression';
import type { MapLayout, MapRoom } from '../map/mapModel';

const room = (
  id: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  stones: string[] = [],
  side = false,
): MapRoom => ({
  id,
  name,
  region: id.split('/')[0]!,
  x,
  y,
  w,
  h,
  loomStones: stones,
  side,
});

export const fixtureLayout: MapLayout = {
  regions: [
    { id: 'emberwood', name: 'Emberwood' },
    { id: 'kiln', name: 'The Sunken Kiln' },
  ],
  rooms: [
    room(R.e1, 'Loomstone Glade', 0, 2, 2, 2, ['loom_stone@10,8']),
    room(R.e2, 'Thicket', 2, 2, 2, 1),
    room(R.e3, 'Riverbend', 4, 1, 2, 2),
    room(R.e4, 'Old Mill', 6, 1, 2, 1),
    room(R.e5, 'Archer Ridge', 6, 2, 3, 2),
    room(R.e6, 'Shield Road', 9, 2, 2, 1),
    room(R.e7, 'Hollow Oak', 9, 0, 2, 2, [], true),
    room(R.e8, 'Kiln Approach', 11, 2, 2, 2, ['loom_stone@14,9']),
    room(R.k1, 'Kiln Gate', 11, 5, 2, 1),
    room(R.k2, 'Brazier Hall', 11, 6, 2, 2),
    room(R.k3, 'Bramble Vault', 9, 6, 2, 1),
    room(R.k4, 'Oil Works', 9, 7, 2, 2),
    room(R.k5, "Matriarch's Pit", 7, 7, 2, 2),
    room(R.k6, 'Frost Shrine', 7, 9, 2, 1, ['loom_stone@8,4']),
    room(R.k7, 'Ice Crossing', 9, 9, 3, 1),
    room(R.k8, 'Slide Room', 12, 8, 2, 2),
    room(R.k9, 'Thaw Lock', 12, 10, 2, 1),
    room(R.k10, "Warden's Hearth", 9, 10, 3, 2),
  ],
  links: [
    { a: R.e1, b: R.e2 },
    { a: R.e2, b: R.e3 },
    { a: R.e3, b: R.e4 },
    { a: R.e4, b: R.e5 },
    { a: R.e5, b: R.e6 },
    { a: R.e6, b: R.e7 },
    { a: R.e6, b: R.e8 },
    { a: R.e8, b: R.k1 },
    { a: R.k1, b: R.k2 },
    { a: R.k2, b: R.k3 },
    { a: R.k3, b: R.k4, door: 'locked' },
    { a: R.k4, b: R.k5 },
    { a: R.k5, b: R.k6 },
    { a: R.k6, b: R.k7 },
    { a: R.k7, b: R.k8 },
    { a: R.k8, b: R.k9 },
    { a: R.k9, b: R.k10, door: 'big' },
  ],
};

export const fixtureProgress = {
  current: R.e8 as string,
  visited: [R.e1, R.e2, R.e3, R.e4, R.e5, R.e6, R.e8] as string[],
  activated: [`${R.e1}#loom_stone@10,8`, `${R.e8}#loom_stone@14,9`],
  standing: { roomId: R.e8 as string, key: 'loom_stone@14,9' } as { roomId: string; key: string } | null,
  keys: { kiln: 1 } as Record<string, number>,
};
