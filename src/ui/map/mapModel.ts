/**
 * Pure region-map view logic (no DOM): fitting the world agent's room layout into the screen,
 * fog of war (unvisited rooms show only next to visited ones) and the links to draw.
 */

export interface MapRoom {
  id: string;
  name: string;
  region: string;
  /** Layout units (the world agent's regionMap; any scale). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Loom Stone object keys in the room. */
  loomStones: string[];
  side?: boolean;
}

export interface MapLink {
  a: string;
  b: string;
  /** Locked (small key), big-key or sealed door on this link, if any. */
  door?: 'locked' | 'big' | 'sealed';
}

export interface MapLayout {
  rooms: MapRoom[];
  links: MapLink[];
  regions: Array<{ id: string; name: string }>;
}

export type RoomVis = 'current' | 'visited' | 'unknown' | 'hidden';

export interface PlacedRoom {
  room: MapRoom;
  vis: RoomVis;
  /** Screen pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlacedLink {
  link: MapLink;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Both ends visited. */
  known: boolean;
}

export interface PlacedMap {
  rooms: PlacedRoom[];
  links: PlacedLink[];
  regions: Array<{ id: string; name: string; x: number; y: number; w: number; h: number }>;
  scale: number;
}

/** What the player has seen: unvisited rooms next to a visited one are 'unknown', the rest hidden. */
export function roomVisibility(
  layout: MapLayout,
  visited: ReadonlySet<string>,
  current: string,
): Map<string, RoomVis> {
  const out = new Map<string, RoomVis>();
  for (const r of layout.rooms)
    out.set(r.id, r.id === current ? 'current' : visited.has(r.id) ? 'visited' : 'hidden');
  for (const l of layout.links) {
    const a = out.get(l.a);
    const b = out.get(l.b);
    const seen = (v: RoomVis | undefined) => v === 'visited' || v === 'current';
    if (seen(a) && b === 'hidden') out.set(l.b, 'unknown');
    if (seen(b) && a === 'hidden') out.set(l.a, 'unknown');
  }
  return out;
}

/**
 * Fits the layout into a w×h box (keeping its aspect ratio, centered, `pad` px around it) and
 * places the visible rooms and the links between them.
 */
export function placeMap(
  layout: MapLayout,
  visited: ReadonlySet<string>,
  current: string,
  w: number,
  h: number,
  pad: number,
): PlacedMap {
  const vis = roomVisibility(layout, visited, current);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of layout.rooms) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  if (layout.rooms.length === 0) return { rooms: [], links: [], regions: [], scale: 1 };
  const scale = Math.max(0.01, Math.min((w - 2 * pad) / (maxX - minX), (h - 2 * pad) / (maxY - minY)));
  const ox = (w - (maxX - minX) * scale) / 2 - minX * scale;
  const oy = (h - (maxY - minY) * scale) / 2 - minY * scale;
  const placed = new Map<string, PlacedRoom>();
  const rooms: PlacedRoom[] = [];
  for (const r of layout.rooms) {
    const v = vis.get(r.id)!;
    const p = { room: r, vis: v, x: ox + r.x * scale, y: oy + r.y * scale, w: r.w * scale, h: r.h * scale };
    placed.set(r.id, p);
    if (v !== 'hidden') rooms.push(p);
  }
  const links: PlacedLink[] = [];
  for (const l of layout.links) {
    const a = placed.get(l.a);
    const b = placed.get(l.b);
    if (!a || !b || a.vis === 'hidden' || b.vis === 'hidden') continue;
    const [x1, y1, x2, y2] = joinPoints(a, b);
    links.push({ link: l, x1, y1, x2, y2, known: a.vis !== 'unknown' && b.vis !== 'unknown' });
  }
  const regions = layout.regions.flatMap((g) => {
    const rs = rooms.filter((r) => r.room.region === g.id);
    if (rs.length === 0) return [];
    const x = Math.min(...rs.map((r) => r.x));
    const y = Math.min(...rs.map((r) => r.y));
    return [
      {
        ...g,
        x,
        y,
        w: Math.max(...rs.map((r) => r.x + r.w)) - x,
        h: Math.max(...rs.map((r) => r.y + r.h)) - y,
      },
    ];
  });
  return { rooms, links, regions, scale };
}

/** Link endpoints: the middles of the facing edges when the rooms touch or sit side by side, else centers. */
function joinPoints(a: PlacedRoom, b: PlacedRoom): [number, number, number, number] {
  const acx = a.x + a.w / 2;
  const acy = a.y + a.h / 2;
  const bcx = b.x + b.w / 2;
  const bcy = b.y + b.h / 2;
  const oy0 = Math.max(a.y, b.y);
  const oy1 = Math.min(a.y + a.h, b.y + b.h);
  if (oy1 > oy0) {
    const y = (oy0 + oy1) / 2;
    return acx < bcx ? [a.x + a.w, y, b.x, y] : [a.x, y, b.x + b.w, y];
  }
  const ox0 = Math.max(a.x, b.x);
  const ox1 = Math.min(a.x + a.w, b.x + b.w);
  if (ox1 > ox0) {
    const x = (ox0 + ox1) / 2;
    return acy < bcy ? [x, a.y + a.h, x, b.y] : [x, a.y, x, b.y + b.h];
  }
  return [acx, acy, bcx, bcy];
}

/**
 * Loom Stones you can travel to from where you stand: activated, and not the one you are at.
 * `names` (room id → name) covers rooms the layout doesn't show, such as the Hearth (M7).
 */
export function travelTargets(
  layout: MapLayout,
  activated: readonly string[],
  standing: { roomId: string; key: string } | null,
  names: ReadonlyMap<string, string> = new Map(),
): Array<{ roomId: string; key: string; name: string }> {
  if (!standing) return [];
  const here = `${standing.roomId}#${standing.key}`;
  const known = new Map([...names, ...layout.rooms.map((r) => [r.id, r.name] as const)]);
  return activated
    .filter((k) => k !== here)
    .map((k) => {
      const i = k.indexOf('#');
      const roomId = k.slice(0, i);
      return { roomId, key: k.slice(i + 1), name: known.get(roomId) ?? roomId };
    });
}
