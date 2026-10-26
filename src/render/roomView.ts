import { Container, Graphics } from 'pixi.js';
import { MAT, materialByCode } from '../../data/materials';
import { TILE_CELLS as T, type Grid, type Room } from '../sim';
import { BLOCK, LINE, PAL, RAISED_TOP, hash2 } from './palette';
import {
  darken,
  drawBarrel,
  drawBarricade,
  drawBox,
  drawBrazierBowl,
  drawLoomStone,
  lighten,
} from './propShapes';
import { TileMap, edgeRuns, type Edge } from './roomTiles';
import { GRID_HZ, isBlockCode } from './terrain/terrainPack';
import { REGION, wallColors, type RegionLook } from './terrain/regionLook';

/** Batches same-colored shapes into one path, so the room is a handful of fills, not thousands. */
class FillBatch {
  private readonly byColor = new Map<number, Array<(g: Graphics) => void>>();
  add(color: number, draw: (g: Graphics) => void): void {
    let list = this.byColor.get(color);
    if (!list) this.byColor.set(color, (list = []));
    list.push(draw);
  }
  flush(g: Graphics, alpha = 1): void {
    for (const [color, list] of this.byColor) {
      for (const draw of list) draw(g);
      g.fill({ color, alpha });
    }
    this.byColor.clear();
  }
}

function strokeEdges(g: Graphics, edges: Edge[], width: number, color: number, alpha = 1): void {
  if (edges.length === 0) return;
  for (const e of edges) g.moveTo(e.x0 * T, e.y0 * T).lineTo(e.x1 * T, e.y1 * T);
  g.stroke({ width, color, alpha, cap: 'round', join: 'round' });
}

/** A prop that burns away (crate, barricade, oil barrel). */
interface BurnableProp {
  g: Graphics;
  tx: number;
  ty: number;
  code: number;
  /** Fuel ticks of a fresh prop, for the char tint. */
  fuelMax: number;
}

/** Region 1 walls and pylons (other regions: regionLook.ts wallColors). */
const BASE_WALLS = {
  top: PAL.wallTop,
  light: PAL.wallTopLight,
  front: PAL.wallFront,
  seam: PAL.wallSeam,
  chip: PAL.wallChip,
  pylon: RAISED_TOP.metal_pylon!,
};

/** Tint of a prop about to burn out. */
const CHARRED = 0x3a2a26;

/**
 * Raised blocks (walls, pylons, doors) and props over the grid terrain, baked into Graphics
 * geometry in their own render group. The grid shader (terrain/) draws the floor.
 * sync() follows the grid: burnable props char while burning and vanish when none of their cells
 * is left; if raised-block cells change (M4 doors, push blocks), the blocks re-bake.
 */
export class RoomView {
  readonly root = new Container({ isRenderGroup: true });
  private readonly shadows = new Graphics();
  private readonly blocks = new Graphics();
  private readonly props = new Graphics();
  private readonly burnables = new Container();
  private list: BurnableProp[] = [];
  map: TileMap | null = null;
  private grid: Grid | null = null;
  private blockCells = -1;
  /** Tiles (index ty·w + tx) drawn by the M4 object layer instead of the bake: doors, chests, blocks, Loom Stones. */
  private owned: ReadonlySet<number> = new Set();
  /** Wall and pylon colors of the room's region (regionLook.ts). */
  private walls: Record<keyof typeof BASE_WALLS, number> = BASE_WALLS;

  constructor() {
    this.root.addChild(this.shadows, this.blocks, this.props, this.burnables);
  }

  build(
    room: Room,
    grid: Grid,
    owned: ReadonlySet<number> = new Set(),
    region: RegionLook = REGION.base,
  ): TileMap {
    const map = new TileMap(room);
    this.walls = wallColors(region) ?? BASE_WALLS;
    this.map = map;
    this.grid = grid;
    this.owned = owned;
    this.blockCells = -1;
    this.bakeBlocks();
    this.props.clear();
    for (const p of this.list) p.g.destroy();
    this.list = [];
    this.drawProps(map, grid);
    return map;
  }

  /** Follows grid changes; call when the grid version changed. `blockCells` from the terrain pack. */
  sync(grid: Grid, blockCells: number): void {
    if (grid !== this.grid) return;
    if (this.blockCells >= 0 && blockCells !== this.blockCells) this.bakeBlocks();
    this.blockCells = blockCells;
    for (const p of this.list) {
      let alive = 0;
      let fuelLeft = Infinity;
      for (let cy = 0; cy < T; cy++) {
        for (let cx = 0; cx < T; cx++) {
          const i = (p.ty * T + cy) * grid.width + p.tx * T + cx;
          if (grid.ground[i] !== p.code) continue;
          alive++;
          if (grid.fire[i]! > 0) fuelLeft = Math.min(fuelLeft, grid.fuel[i]!);
        }
      }
      p.g.visible = alive > 0;
      const burning = fuelLeft !== Infinity;
      const burnt = burning ? 1 - Math.min(1, fuelLeft / p.fuelMax) : 0;
      p.g.tint = burning ? mixColor(0xffffff, CHARRED, 0.25 + 0.6 * burnt) : 0xffffff;
    }
  }

  /** A tile is raised if the room says so and the grid still has a block at its center. */
  private raised(tx: number, ty: number): boolean {
    const map = this.map!;
    if (!map.isRaised(tx, ty) || this.owned.has(ty * map.w + tx)) return false;
    const grid = this.grid!;
    const i = (ty * T + (T >> 1)) * grid.width + tx * T + (T >> 1);
    return isBlockCode(grid.ground[i]!);
  }

  private bakeBlocks(): void {
    const map = this.map!;
    const raised = (x: number, y: number): boolean => this.raised(x, y);
    // Shadows cast south by raised tiles.
    const sh = this.shadows.clear();
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) {
        if (raised(tx, ty) && ty + 1 < map.h && !raised(tx, ty + 1))
          sh.rect(tx * T, (ty + 1) * T, T, BLOCK.shadow);
      }
    }
    sh.fill({ color: PAL.shadow, alpha: BLOCK.shadowAlpha });

    const g = this.blocks.clear();
    const fills = new FillBatch();
    const seams: Edge[] = [];
    const faceLines: Edge[] = [];
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) {
        if (!raised(tx, ty)) continue;
        const t = map.at(tx, ty)!;
        const x = tx * T;
        const y = ty * T;
        const isWall = t.id === 'wall';
        const wc = this.walls;
        const top = isWall ? wc.top : t.id === 'metal_pylon' ? wc.pylon : (RAISED_TOP[t.id] ?? PAL.blockTop);
        const front = isWall ? wc.front : darken(top, 0.62);
        const hasFront = ty + 1 < map.h && !raised(tx, ty + 1);
        const topH = hasFront ? T - BLOCK.front : T;
        fills.add(top, (gg) => void gg.rect(x, y, T, topH));
        if (hasFront) {
          fills.add(front, (gg) => void gg.rect(x, y + topH, T, BLOCK.front));
          faceLines.push({ x0: tx, y0: ty + topH / T, x1: tx + 1, y1: ty + topH / T });
          const sx = tx + 0.2 + hash2(tx, ty, 3) * 0.6;
          seams.push({ x0: sx, y0: ty + topH / T, x1: sx, y1: ty + 1 });
        }
        const light = isWall ? wc.light : lighten(top, 0.25);
        if (!raised(tx, ty - 1)) fills.add(light, (gg) => void gg.rect(x, y, T, 0.4));
        if (!raised(tx - 1, ty)) fills.add(light, (gg) => void gg.rect(x, y, 0.35, topH));
        if (isWall && hash2(tx, ty, 5) < 0.35) {
          const cx = x + 0.8 + hash2(tx, ty, 6) * 2.2;
          const cy = y + 0.9 + hash2(tx, ty, 8) * Math.max(0.2, topH - 1.8);
          fills.add(wc.chip, (gg) => void gg.roundRect(cx, cy, 0.9, 0.45, 0.2));
        }
      }
    }
    fills.flush(g);
    // Lines go after the fills so they sit on top, one path per color.
    strokeEdges(g, seams, LINE.detail, this.walls.seam);
    strokeEdges(g, mergeRuns(faceLines), LINE.detail * 1.2, this.walls.seam);
    strokeEdges(
      g,
      edgeRuns(map, raised).map((r) => r.edge),
      LINE.outline,
      PAL.ink,
    );
  }

  private drawProps(map: TileMap, grid: Grid): void {
    const g = this.props;
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) {
        const prop = map.at(tx, ty)!.prop;
        // Braziers keep their baked bowl; the object layer draws the rest of an owned tile.
        if (prop !== 'brazier' && this.owned.has(ty * map.w + tx)) continue;
        const x = tx * T;
        const y = ty * T;
        if (prop === 'crate' || prop === 'barricade' || prop === 'barrel') {
          const pg = new Graphics();
          if (prop === 'crate') drawBox(pg, x, y, PAL.crateTop, PAL.crateFront, true);
          else if (prop === 'barricade') drawBarricade(pg, x, y);
          else drawBarrel(pg, x, y);
          const code = prop === 'crate' ? MAT.crate : prop === 'barricade' ? MAT.barricade : MAT.oil_barrel;
          const burn = materialByCode[code]!.flammable;
          this.burnables.addChild(pg);
          this.list.push({ g: pg, tx, ty, code, fuelMax: Math.max(1, (burn?.burnSeconds ?? 1) * GRID_HZ) });
        } else if (prop === 'box') {
          drawBox(g, x, y, PAL.blockTop, PAL.blockFront, false);
        } else if (prop === 'brazier') {
          drawBrazierBowl(g, x + T / 2, y + T / 2 + 0.3);
        } else if (prop === 'loomstone') {
          drawLoomStone(g, x + T / 2, y + T / 2);
        }
      }
    }
    this.sync(grid, -1);
  }
}

function mixColor(a: number, b: number, t: number): number {
  const ch = (s: number): number => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Joins edges that continue each other on the same line. */
function mergeRuns(edges: Edge[]): Edge[] {
  const sorted = [...edges].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const out: Edge[] = [];
  for (const e of sorted) {
    const last = out[out.length - 1];
    if (last && last.y0 === e.y0 && last.y1 === e.y1 && Math.abs(last.x1 - e.x0) < 1e-6) last.x1 = e.x1;
    else out.push({ ...e });
  }
  return out;
}
