import type { Room } from '../sim';
import { tileForChar } from '../../data/tiles';

/**
 * How a room tile is drawn by the baked layer (render-side only). Since M3 the floor comes from
 * the grid shader (src/render/terrain); the bake draws raised blocks (walls, pylons, doors) and
 * props (crates, barricades, oil barrels, braziers, loom stones, generic boxes).
 */
export type Prop = 'crate' | 'barricade' | 'barrel' | 'brazier' | 'loomstone' | 'box' | null;

export interface TileLook {
  id: string;
  /** A raised block (wall, pylon, door…) covering the whole tile. */
  raised: boolean;
  prop: Prop;
}

const PROP_BY_ID: Record<string, Prop> = {
  crate: 'crate',
  barricade: 'barricade',
  oil_barrel: 'barrel',
  brazier: 'brazier',
  loom_stone: 'loomstone',
};

/** Non-walkable tiles the grid shader draws as floor (bramble bushes, pits). */
const SHADER_DRAWN = new Set(['bramble', 'pit']);

/** Looks per tile, row-major tilesW × tilesH, plus neighbor queries. Out of bounds reads as void. */
export class TileMap {
  readonly w: number;
  readonly h: number;
  readonly looks: TileLook[];

  constructor(room: Room) {
    this.w = room.tilesW;
    this.h = room.tilesH;
    this.looks = [];
    for (let i = 0; i < this.w * this.h; i++) this.looks.push(classify(String.fromCharCode(room.tiles[i]!)));
  }

  at(tx: number, ty: number): TileLook | undefined {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return undefined;
    return this.looks[ty * this.w + tx];
  }

  isRaised(tx: number, ty: number): boolean {
    return this.at(tx, ty)?.raised ?? false;
  }
}

function classify(ch: string): TileLook {
  const def = tileForChar(ch);
  if (!def) return { id: 'unknown', raised: false, prop: null };
  const marker = 'marker' in def && def.marker === true;
  const prop = PROP_BY_ID[def.id] ?? (marker && !def.walk ? 'box' : null);
  if (marker || prop || def.walk || SHADER_DRAWN.has(def.id)) return { id: def.id, raised: false, prop };
  return { id: def.id, raised: true, prop: null };
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
