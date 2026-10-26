/**
 * Static tile-level checks for authored rooms (CONTENT §6), used by the region room tests. They
 * model what each verb opens so a room's gating can be tested before the puzzle objects and the
 * scripted solution driver exist:
 *  - fire: bramble, crates, barricades and oil barrels burn away; ice blocks melt.
 *  - frost: deep water freezes into ice bridge (markers floating on deep water included).
 *  - doors: `D` doors are open (their @link condition is met).
 *  - keys: `K` opens once a small-key chest `k` was reachable, `G` once the big-key chest `g` was.
 *  - M8: sideDoors: `d` doors are open; tide: lit furnace vents (`f`) douse, and with frost too a
 *    pit fills and freezes into an ice bridge; bigKey: the dungeon's big key was found elsewhere.
 * Walkability otherwise follows data/tiles.ts; markers stand on their neighbors' ground (§6.1).
 */
import { tileForChar } from '../../../data/tiles';
import type { RoomData } from '../../../src/sim';

export interface Abilities {
  fire?: boolean;
  frost?: boolean;
  doors?: boolean;
  /** Small keys the player brings into the room. */
  keys?: number;
  /** M8: `d` doors are open (their own @link conditions hold). */
  sideDoors?: boolean;
  /** M8: Tide douses lit vents; with `frost`, a Tide-filled pit freezes into an ice bridge. */
  tide?: boolean;
  /** M8: the big key of this dungeon was found in another room (F9's, for F8's door). */
  bigKey?: boolean;
}

export interface Tile {
  x: number;
  y: number;
}

const GROUND_CHARS = new Set('#.,"*=+~w_mMoOi:f');
// Exit tiles are walkable whatever their neighbors (data/tiles.ts walk, the room's solid mask).
const NEIGHBOR_GROUND = new Set('Tx123456789HL');
const BURNS = new Set('*c|b');
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function charAt(room: RoomData, x: number, y: number): string {
  return room.rows[y]?.[x] ?? '#';
}

/** The ground a tile stands on: itself, or for markers the most common neighbor ground (ties: stone). */
export function groundAt(room: RoomData, x: number, y: number): string {
  const c = charAt(room, x, y);
  if (!NEIGHBOR_GROUND.has(c)) return c;
  const counts = new Map<string, number>();
  for (const [dx, dy] of DIRS) {
    const n = charAt(room, x + dx, y + dy);
    if (GROUND_CHARS.has(n)) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  let best = '.';
  let bestN = 0;
  let tie = false;
  for (const [g, n] of counts) {
    if (n > bestN) [best, bestN, tie] = [g, n, false];
    else if (n === bestN) tie = true;
  }
  return tie ? '.' : best;
}

/** Every tile with this character. */
export function find(room: RoomData, ch: string): Tile[] {
  const out: Tile[] = [];
  room.rows.forEach((row, y) => [...row].forEach((c, x) => c === ch && out.push({ x, y })));
  return out;
}

function passable(
  room: RoomData,
  x: number,
  y: number,
  ab: Abilities,
  keys: number,
  bigKey: boolean,
): boolean {
  const c = charAt(room, x, y);
  if (c === 'D') return !!ab.doors;
  if (c === 'd') return !!ab.sideDoors;
  if (c === 'f') return !!ab.tide;
  if (c === '_') return !!ab.tide && !!ab.frost;
  if (c === 'K') return keys > 0;
  if (c === 'G') return bigKey;
  if (c === 'I') return !!ab.fire;
  if (BURNS.has(c)) return !!ab.fire;
  const g = groundAt(room, x, y);
  if (g === 'w') return !!ab.frost;
  if (g === '*') return !!ab.fire;
  if (g !== c) return tileForChar(g)?.walk ?? false;
  return tileForChar(c)?.walk ?? false;
}

/** Tiles the player can stand on, starting from `start`, with these abilities. */
export function reachable(room: RoomData, start: Tile, ab: Abilities): Set<string> {
  let keys = ab.keys ?? 0;
  let bigKey = !!ab.bigKey;
  let usedChests = new Set<string>();
  for (;;) {
    const seen = new Set<string>([key(start)]);
    const queue: Tile[] = [start];
    while (queue.length > 0) {
      const t = queue.pop()!;
      for (const [dx, dy] of DIRS) {
        const n = { x: t.x + dx, y: t.y + dy };
        if (n.y < 0 || n.y >= room.tilesH || n.x < 0 || n.x >= room.tilesW || seen.has(key(n))) continue;
        if (!passable(room, n.x, n.y, ab, keys, bigKey)) continue;
        seen.add(key(n));
        queue.push(n);
      }
    }
    const opened = new Set(usedChests);
    for (const t of find(room, 'k')) if (touches(seen, t)) opened.add(`k${key(t)}`);
    for (const t of find(room, 'g')) if (touches(seen, t)) opened.add(`g${key(t)}`);
    if (opened.size === usedChests.size) return seen;
    for (const k of opened) {
      if (usedChests.has(k)) continue;
      if (k.startsWith('k')) keys++;
      else bigKey = true;
    }
    usedChests = opened;
  }
}

export function key(t: Tile): string {
  return `${t.x},${t.y}`;
}

/** True if a tile of the set is 4-adjacent to t (for solid objects: chests, braziers). */
export function touches(set: Set<string>, t: Tile): boolean {
  return DIRS.some(([dx, dy]) => set.has(`${t.x + dx},${t.y + dy}`));
}

const SHOT_BLOCKERS = new Set('#MBc|b&PSQYDdKkGgI$R');

/** Line of sight between tile centers: no shot-blocking tile strictly between them (sampled). */
export function lineOfSight(room: RoomData, a: Tile, b: Tile): boolean {
  const steps = Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 10) + 1;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = Math.floor(a.x + 0.5 + (b.x - a.x) * t);
    const y = Math.floor(a.y + 0.5 + (b.y - a.y) * t);
    if ((x === a.x && y === a.y) || (x === b.x && y === b.y)) continue;
    if (SHOT_BLOCKERS.has(charAt(room, x, y))) return false;
  }
  return true;
}
