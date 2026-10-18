import { circleOverlapsSolid, type Room } from '../../sim';

/** Gap kept between spawned bodies, cells. */
const SPAWN_GAP = 0.6;
/** Golden angle, radians: spreads spiral points evenly. */
const GOLDEN_ANGLE = 2.399963229728653;

/**
 * Picks up to `n` spots for circles of `radius` around (cx, cy): a spiral outward from the
 * point, skipping spots that overlap walls, the room's edge, `taken` bodies or each other.
 * So a point inside a wall still yields spots on the nearest open floor.
 */
export function findSpawnSpots(
  room: Room,
  cx: number,
  cy: number,
  n: number,
  radius: number,
  taken: ReadonlyArray<{ x: number; y: number; radius: number }> = [],
): Array<{ x: number; y: number }> {
  const spots: Array<{ x: number; y: number }> = [];
  const step = radius * 2 + SPAWN_GAP;
  const maxTries = 2000;
  const free = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= room.width || y >= room.height) return false;
    if (circleOverlapsSolid(room, x, y, radius)) return false;
    for (const t of taken) {
      const d = radius + t.radius + SPAWN_GAP * 0.5;
      if ((x - t.x) ** 2 + (y - t.y) ** 2 < d * d) return false;
    }
    for (const s of spots) if ((x - s.x) ** 2 + (y - s.y) ** 2 < step * step * 0.9) return false;
    return true;
  };
  for (let i = 0; i < maxTries && spots.length < n; i++) {
    // i = 0 is the point itself; later points spiral out so area grows with the count.
    const r = i === 0 ? 0 : step * 0.8 * Math.sqrt(i);
    const a = i * GOLDEN_ANGLE;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (free(x, y)) spots.push({ x, y });
  }
  return spots;
}
