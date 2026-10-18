import type { Room } from '../world/room';

/**
 * Per-cell distance (in cells, 8-way steps) to the nearest unwalkable cell, by a multi-source BFS
 * from every solid cell. Cells outside the room count as solid, so the border is a wall too.
 * Derived from the room's walkability only and cached per room.
 */
const cache = new WeakMap<Room, Uint16Array>();

export function wallDistanceField(room: Room): Uint16Array {
  const hit = cache.get(room);
  if (hit) return hit;
  const w = room.width;
  const h = room.height;
  const n = w * h;
  const unset = 0xffff;
  const dist = new Uint16Array(n).fill(unset);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  // Sources in distance order (solid cells 0, then open border cells 1), so the BFS queue stays
  // sorted and every cell is set once, at its final distance.
  for (let i = 0; i < n; i++) {
    if (room.solid[i] !== 1) continue;
    dist[i] = 0;
    queue[tail++] = i;
  }
  for (let i = 0; i < n; i++) {
    const x = i % w;
    const y = (i - x) / w;
    if (room.solid[i] === 1 || (x !== 0 && y !== 0 && x !== w - 1 && y !== h - 1)) continue;
    dist[i] = 1;
    queue[tail++] = i;
  }
  while (head < tail) {
    const i = queue[head++]!;
    const x = i % w;
    const y = (i - x) / w;
    const d = dist[i]! + 1;
    for (let oy = -1; oy <= 1; oy++) {
      const ny = y + oy;
      if (ny < 0 || ny >= h) continue;
      for (let ox = -1; ox <= 1; ox++) {
        const nx = x + ox;
        if (nx < 0 || nx >= w) continue;
        const j = ny * w + nx;
        if (dist[j]! <= d) continue;
        dist[j] = d;
        queue[tail++] = j;
      }
    }
  }
  cache.set(room, dist);
  return dist;
}

/** Distance to the nearest wall from the cell under (x, y); 0 outside the room. */
export function wallDistanceAt(room: Room, field: Uint16Array, x: number, y: number): number {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= room.width || cy >= room.height) return 0;
  return field[cy * room.width + cx]!;
}
