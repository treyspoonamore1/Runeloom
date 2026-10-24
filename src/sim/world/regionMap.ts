/**
 * Region map data for the map screen (M4): the rooms connected to the current one through
 * `@exit` headers, read from `state.rooms`, with what the save knows about each, laid out on a
 * stable 2D grid from the exit directions.
 *
 * Layout: breadth-first from the start room (data/progression.ts startRoom when it is part of the
 * component, else the alphabetically first room), in @exit order. A room goes one step from the
 * room it was reached from in the exit's direction (w: x − 1, e: x + 1, n: y − 1, s: y + 1); if
 * that spot is taken it moves further the same way until a spot is free. The same rooms always
 * give the same layout, whichever room the player is in. Coordinates are integers (0, 0 is the
 * start room) and may be negative; `bounds` gives the extent. In a rift (M6) the map is the rift's
 * rooms only, from its entry.
 */
import { hearthRoom } from '../../../data/hearth';
import { startRoom } from '../../../data/progression';
import type { GameState } from '../state';
import { parseRoom, type RoomData } from './room';
import { isRiftRoomId, riftRoomPrefix } from './rift/types';
import { dungeonOf, loomStoneId, type Edge, type RoomSource } from './worldState';

export interface MapLoomStone {
  /** Object key, e.g. "loom_stone@3,4" (the 'travel' HeroEdit takes it). */
  key: string;
  tx: number;
  ty: number;
  /** Activated: a fast-travel destination. */
  active: boolean;
}

export interface MapNode {
  id: string;
  name: string;
  level: number;
  /** The id's region prefix ("emberwood", "kiln"). */
  region: string;
  /** Its @exit headers in file order (targets may be missing from the source). */
  exits: { dir: Edge; room: string }[];
  /** Size in tiles. */
  tilesW: number;
  tilesH: number;
  visited: boolean;
  cleared: boolean;
  /** The player is in this room. */
  current: boolean;
  /** Its Loom Stones, in tile order. */
  loomStones: MapLoomStone[];
  /** Layout position (grid units, see the file comment). */
  x: number;
  y: number;
}

export interface RegionMap {
  nodes: MapNode[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

const STEP: Readonly<Record<Edge, readonly [number, number]>> = {
  w: [-1, 0],
  e: [1, 0],
  n: [0, -1],
  s: [0, 1],
};

// Parsed room files by text (pure function of the text, so a cache can't affect the sim).
const parsed = new Map<string, RoomData | null>();

function parseCached(text: string): RoomData | null {
  let d = parsed.get(text);
  if (d === undefined) {
    try {
      d = parseRoom(text);
    } catch {
      d = null;
    }
    parsed.set(text, d);
  }
  return d;
}

/** Room ids reachable from `from` through @exit headers (both ways), sorted. */
function component(rooms: RoomSource, from: string): string[] {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  for (const [id, text] of Object.entries(rooms)) {
    const d = parseCached(text);
    if (!d) continue;
    for (const e of d.header.exits) {
      // A rift (M6) is its own map: its way home doesn't join it to the region.
      if (rooms[e.room] === undefined || isRiftRoomId(id) !== isRiftRoomId(e.room)) continue;
      link(id, e.room);
      link(e.room, id);
    }
  }
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const n of [...(adj.get(id) ?? [])].sort()) {
      if (seen.has(n)) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return [...seen].sort();
}

/** Layout positions for the rooms in `ids`, breadth-first from `root` (see the file comment). */
export function layoutRooms(
  rooms: RoomSource,
  ids: readonly string[],
  root: string,
): Map<string, [number, number]> {
  const pos = new Map<string, [number, number]>();
  const taken = new Set<string>();
  const put = (id: string, x: number, y: number) => {
    pos.set(id, [x, y]);
    taken.add(`${x},${y}`);
  };
  const inSet = new Set(ids);
  const order = [root, ...ids.filter((i) => i !== root)];
  for (const seed of order) {
    if (pos.has(seed)) continue;
    // A part not reached from the root (no exits into it) starts to the right of everything.
    let sx = 0;
    for (const [x] of pos.values()) sx = Math.max(sx, x + 2);
    put(seed, pos.size === 0 ? 0 : sx, 0);
    const queue = [seed];
    while (queue.length > 0) {
      const id = queue.shift()!;
      const d = parseCached(rooms[id]!);
      const [x, y] = pos.get(id)!;
      for (const e of d?.header.exits ?? []) {
        if (!inSet.has(e.room) || pos.has(e.room)) continue;
        const [dx, dy] = STEP[e.dir as Edge] ?? [1, 0];
        let nx = x + dx;
        let ny = y + dy;
        while (taken.has(`${nx},${ny}`)) {
          nx += dx;
          ny += dy;
        }
        put(e.room, nx, ny);
        queue.push(e.room);
      }
    }
  }
  return pos;
}

/** The map of the rooms connected to the current room (see the file comment). */
export function buildRegionMap(state: GameState): RegionMap {
  const rooms = state.rooms;
  const here = state.room.id;
  const ids = rooms[here] !== undefined ? component(rooms, here) : [];
  const riftEntry = state.world.rift ? `${riftRoomPrefix(state.world.rift.spec.index)}entry` : null;
  const root = ids.includes(startRoom)
    ? startRoom
    : riftEntry && ids.includes(riftEntry)
      ? riftEntry
      : (ids[0] ?? here);
  const pos = layoutRooms(rooms, ids, root);
  const nodes: MapNode[] = [];
  const bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  for (const id of ids) {
    const d = parseCached(rooms[id]!);
    if (!d) continue;
    const [x, y] = pos.get(id) ?? [0, 0];
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
    const f = state.world.flags[id];
    const loomStones: MapLoomStone[] = [];
    d.rows.forEach((row, ty) => {
      for (let tx = 0; tx < row.length; tx++) {
        if (row[tx] !== 'x') continue;
        const key = `loom_stone@${tx},${ty}`;
        loomStones.push({ key, tx, ty, active: state.world.loomStones.includes(loomStoneId(id, key)) });
      }
    });
    nodes.push({
      id,
      name: d.header.name || id,
      level: d.header.level,
      region: dungeonOf(id),
      exits: d.header.exits.map((e) => ({ dir: e.dir as Edge, room: e.room })),
      tilesW: d.tilesW,
      tilesH: d.tilesH,
      visited: f?.visited ?? false,
      cleared: f?.cleared ?? false,
      current: id === here,
      loomStones,
      x,
      y,
    });
  }
  return { nodes, bounds };
}

/** A fast-travel destination: an activated Loom Stone and its room's name. */
export interface TravelDestination {
  roomId: string;
  key: string;
  name: string;
  /** The Hearth's hub (M7): no exits join it to the region, so the map lists it on its own. */
  hub: boolean;
}

/**
 * Every activated Loom Stone with its room's display name, the Hearth first, then in activation
 * order. The map's travel list reads names from here because the hub (reached only by fast
 * travel) is never in the region map's rooms, and in the hub the region's rooms aren't either.
 */
export function travelDestinations(state: GameState): TravelDestination[] {
  const out: TravelDestination[] = [];
  for (const id of state.world.loomStones) {
    const i = id.indexOf('#');
    const roomId = id.slice(0, i);
    const text = state.rooms[roomId];
    if (text === undefined) continue;
    const d = parseCached(text);
    out.push({ roomId, key: id.slice(i + 1), name: d?.header.name || roomId, hub: roomId === hearthRoom });
  }
  return [...out.filter((d) => d.hub), ...out.filter((d) => !d.hub)];
}
