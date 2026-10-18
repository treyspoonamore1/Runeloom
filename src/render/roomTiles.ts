import type { Room } from '../sim';
import { tileForChar } from '../../data/tiles';

/** How a tile is drawn. Render-side only; the sim cares about walkability, not looks. */
export type Ground =
  | 'stone'
  | 'dirt'
  | 'grass'
  | 'shallow'
  | 'deep'
  | 'flat'; // single flat color from FLAT_GROUND (fallback looks)

export type Prop = 'crate' | 'brazier' | 'loomstone' | 'box' | null;

export interface TileLook {
  id: string;
  ground: Ground;
  /** A raised block (wall, pylon, door…) covering the whole tile. */
  raised: boolean;
  prop: Prop;
  /** Sits on the ground of its neighbors (CONTENT §6.1). */
  marker: boolean;
}

const GROUND_BY_ID: Record<string, Ground> = {
  stone: 'stone',
  dirt: 'dirt',
  grass: 'grass',
  shallow_water: 'shallow',
  deep_water: 'deep',
};

const PROP_BY_ID: Record<string, Prop> = {
  crate: 'crate',
  brazier: 'brazier',
  loom_stone: 'loomstone',
};

/** Looks per tile, row-major tilesW × tilesH, plus neighbor queries. Out of bounds reads as void. */
export class TileMap {
  readonly w: number;
  readonly h: number;
  readonly looks: TileLook[];

  constructor(room: Room) {
    this.w = room.tilesW;
    this.h = room.tilesH;
    const base: TileLook[] = [];
    for (let i = 0; i < this.w * this.h; i++) base.push(classify(String.fromCharCode(room.tiles[i]!)));
    // Markers sit on the ground of their neighbors (CONTENT §6.1).
    this.looks = base.map((look, i) => {
      if (!look.marker) return look;
      return { ...look, ground: neighborGround(base, i % this.w, Math.floor(i / this.w), this.w, this.h) };
    });
  }

  at(tx: number, ty: number): TileLook | undefined {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return undefined;
    return this.looks[ty * this.w + tx];
  }

  isRaised(tx: number, ty: number): boolean {
    return this.at(tx, ty)?.raised ?? false;
  }

  groundAt(tx: number, ty: number): Ground | undefined {
    const t = this.at(tx, ty);
    return t && !t.raised ? t.ground : undefined;
  }
}

function classify(ch: string): TileLook {
  const def = tileForChar(ch);
  if (!def) return { id: 'unknown', ground: 'stone', raised: false, prop: null, marker: false };
  const marker = 'marker' in def && def.marker === true;
  const prop = PROP_BY_ID[def.id] ?? (marker && !def.walk ? 'box' : null);
  const ground = GROUND_BY_ID[def.id];
  if (marker || prop) return { id: def.id, ground: 'stone', raised: false, prop, marker };
  if (ground) return { id: def.id, ground, raised: false, prop: null, marker };
  if (def.id === 'pit' || def.walk) {
    // Walkable tiles without their own look: flat fallback color, or stone for exits.
    const flat = !def.id.startsWith('exit_');
    return { id: def.id, ground: flat ? 'flat' : 'stone', raised: false, prop: null, marker };
  }
  return { id: def.id, ground: 'stone', raised: true, prop: null, marker };
}

/** Most common plain ground among the 4 neighbors; stone if none. */
function neighborGround(base: TileLook[], tx: number, ty: number, w: number, h: number): Ground {
  const counts = new Map<Ground, number>();
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const x = tx + dx;
    const y = ty + dy;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const n = base[y * w + x]!;
    if (n.raised || n.marker || n.ground === 'deep' || n.ground === 'flat') continue;
    counts.set(n.ground, (counts.get(n.ground) ?? 0) + 1);
  }
  let best: Ground = 'stone';
  let bestN = 0;
  for (const [g, n] of counts) {
    if (n > bestN) {
      best = g;
      bestN = n;
    }
  }
  return best;
}

/** A straight edge between tiles, in tile units. */
export interface Edge {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Collects tile edges where `inside(a)` holds on one side and not on the other,
 * merged into maximal straight runs so strokes join cleanly. `side` reports
 * which side the inside tile is on: 'n' means inside is north of the edge, etc.
 */
export function edgeRuns(
  map: TileMap,
  inside: (tx: number, ty: number) => boolean,
  outsideOk: (tx: number, ty: number) => boolean = () => true,
): { edge: Edge; side: 'n' | 's' | 'w' | 'e' }[] {
  const out: { edge: Edge; side: 'n' | 's' | 'w' | 'e' }[] = [];
  // Horizontal edges at y between rows y-1 and y.
  for (let y = 0; y <= map.h; y++) {
    for (const side of ['n', 's'] as const) {
      let start = -1;
      for (let x = 0; x <= map.w; x++) {
        const inTile = side === 'n' ? [x, y - 1] : [x, y];
        const outTile = side === 'n' ? [x, y] : [x, y - 1];
        const on =
          x < map.w &&
          inside(inTile[0]!, inTile[1]!) &&
          !inside(outTile[0]!, outTile[1]!) &&
          outsideOk(outTile[0]!, outTile[1]!);
        if (on && start < 0) start = x;
        if (!on && start >= 0) {
          out.push({ edge: { x0: start, y0: y, x1: x, y1: y }, side });
          start = -1;
        }
      }
    }
  }
  // Vertical edges at x between columns x-1 and x.
  for (let x = 0; x <= map.w; x++) {
    for (const side of ['w', 'e'] as const) {
      let start = -1;
      for (let y = 0; y <= map.h; y++) {
        const inTile = side === 'w' ? [x - 1, y] : [x, y];
        const outTile = side === 'w' ? [x, y] : [x - 1, y];
        const on =
          y < map.h &&
          inside(inTile[0]!, inTile[1]!) &&
          !inside(outTile[0]!, outTile[1]!) &&
          outsideOk(outTile[0]!, outTile[1]!);
        if (on && start < 0) start = y;
        if (!on && start >= 0) {
          out.push({ edge: { x0: x, y0: start, x1: x, y1: y }, side });
          start = -1;
        }
      }
    }
  }
  return out;
}
