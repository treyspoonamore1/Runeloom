import { Container, Graphics } from 'pixi.js';
import { TILE_CELLS as T, type Room } from '../sim';
import { BLOCK, FLAT_GROUND, LINE, PAL, RAISED_TOP, hash2, pick } from './palette';
import { TileMap, edgeRuns, type Edge, type Ground } from './roomTiles';

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

/**
 * The static room, baked once per room in setRoom. Everything here is built
 * into Graphics geometry once and lives in its own render group, so a frame
 * only moves it; water ripples and flames animate in AmbientView.
 */
export class RoomView {
  readonly root = new Container({ isRenderGroup: true });
  private readonly ground = new Graphics();
  private readonly edges = new Graphics();
  private readonly blocks = new Graphics();
  private readonly props = new Graphics();
  map: TileMap | null = null;

  constructor() {
    this.root.addChild(this.ground, this.edges, this.blocks, this.props);
  }

  build(room: Room): TileMap {
    const map = new TileMap(room);
    this.map = map;
    for (const g of [this.ground, this.edges, this.blocks, this.props]) g.clear();
    this.drawGround(map);
    this.drawEdges(map);
    this.drawBlocks(map);
    this.drawProps(map);
    return map;
  }

  private drawGround(map: TileMap): void {
    const g = this.ground;
    const base = new FillBatch();
    const detail = new FillBatch();
    const grout: Edge[] = [];
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) {
        const t = map.at(tx, ty)!;
        if (t.raised) continue;
        const x = tx * T;
        const y = ty * T;
        const h = hash2(tx, ty);
        const h2 = hash2(tx, ty, 7);
        const rect = (gg: Graphics): void => void gg.rect(x, y, T, T);
        switch (t.ground) {
          case 'stone':
            base.add(pick(PAL.stone, h), rect);
            if (map.groundAt(tx + 1, ty) === 'stone')
              grout.push({ x0: tx + 1, y0: ty, x1: tx + 1, y1: ty + 1 });
            if (map.groundAt(tx, ty + 1) === 'stone')
              grout.push({ x0: tx, y0: ty + 1, x1: tx + 1, y1: ty + 1 });
            if (h2 > 0.88) {
              const px = x + 1 + h * 2;
              const py = y + 1 + hash2(tx, ty, 9) * 2;
              detail.add(PAL.stoneChip, (gg) => void gg.ellipse(px, py, 0.3, 0.2));
            }
            break;
          case 'dirt':
            base.add(pick(PAL.dirt, h), rect);
            for (let i = 0; i < 2; i++) {
              const hx = hash2(tx, ty, 11 + i);
              const hy = hash2(tx, ty, 21 + i);
              if (hx < 0.3) continue;
              detail.add(
                PAL.dirtPebble,
                (gg) => void gg.ellipse(x + 0.6 + hx * 2.8, y + 0.6 + hy * 2.8, 0.3, 0.2),
              );
            }
            break;
          case 'grass':
            base.add(pick(PAL.grass, h), rect);
            break;
          case 'shallow':
            base.add(PAL.shallow, rect);
            if (map.groundAt(tx, ty - 1) !== 'shallow' && map.groundAt(tx, ty - 1) !== 'deep') {
              detail.add(PAL.shallowShade, (gg) => void gg.rect(x, y, T, 0.8));
            }
            break;
          case 'deep':
            base.add(PAL.deep, rect);
            if (map.groundAt(tx, ty - 1) !== 'deep')
              detail.add(PAL.deepShade, (gg) => void gg.rect(x, y, T, 1.1));
            break;
          case 'flat':
            base.add(FLAT_GROUND[t.id] ?? PAL.stone[0], rect);
            break;
        }
      }
    }
    base.flush(g);
    strokeEdges(g, grout, LINE.detail * 0.8, PAL.stoneGrout);
    detail.flush(g);
    this.drawGrassBlades(map);
  }

  private drawGrassBlades(map: TileMap): void {
    const g = this.ground;
    for (const [color, salt] of [
      [PAL.grassBlade, 31],
      [PAL.grassBladeLight, 41],
    ] as const) {
      let any = false;
      for (let ty = 0; ty < map.h; ty++) {
        for (let tx = 0; tx < map.w; tx++) {
          if (map.groundAt(tx, ty) !== 'grass') continue;
          const n = salt === 31 ? 2 : 1;
          for (let i = 0; i < n; i++) {
            const hx = hash2(tx, ty, salt + i);
            const hy = hash2(tx, ty, salt + 5 + i);
            if (salt === 41 && hx < 0.5) continue;
            // A tuft of three blades fanning up from a base point.
            const bx = tx * T + 0.7 + hx * 2.6;
            const by = ty * T + 1.3 + hy * 2.2;
            g.moveTo(bx - 0.45, by - 0.5).lineTo(bx - 0.1, by);
            g.moveTo(bx, by - 0.8).lineTo(bx, by);
            g.moveTo(bx + 0.45, by - 0.5).lineTo(bx + 0.1, by);
            any = true;
          }
        }
      }
      if (any) g.stroke({ width: LINE.detail, color, cap: 'round', join: 'round' });
    }
  }

  private drawEdges(map: TileMap): void {
    const g = this.edges;
    // Shadows cast south by raised tiles and props.
    const shadow = new FillBatch();
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) {
        const t = map.at(tx, ty)!;
        if (t.raised && map.groundAt(tx, ty + 1) !== undefined) {
          shadow.add(PAL.shadow, (gg) => void gg.rect(tx * T, (ty + 1) * T, T, BLOCK.shadow));
        }
      }
    }
    shadow.flush(g, BLOCK.shadowAlpha);

    const isG =
      (kind: Ground) =>
      (tx: number, ty: number): boolean =>
        map.groundAt(tx, ty) === kind;
    const walkableLand = (tx: number, ty: number): boolean => {
      const gr = map.groundAt(tx, ty);
      return gr !== undefined && gr !== 'shallow' && gr !== 'deep';
    };
    const edgesOf = (runs: ReturnType<typeof edgeRuns>): Edge[] => runs.map((r) => r.edge);
    strokeEdges(g, edgesOf(edgeRuns(map, isG('grass'), walkableLand)), LINE.groundEdge, PAL.grassEdge);
    strokeEdges(
      g,
      edgesOf(edgeRuns(map, isG('dirt'), (x, y) => walkableLand(x, y) && !isG('grass')(x, y))),
      LINE.groundEdge,
      PAL.dirtEdge,
    );
    const water = (tx: number, ty: number): boolean => {
      const gr = map.groundAt(tx, ty);
      return gr === 'shallow' || gr === 'deep';
    };
    strokeEdges(
      g,
      edgesOf(edgeRuns(map, water, (x, y) => !map.isRaised(x, y))),
      LINE.groundEdge * 1.3,
      PAL.ink,
      0.9,
    );
    strokeEdges(g, edgesOf(edgeRuns(map, isG('deep'))), LINE.outline, PAL.ink);
  }

  private drawBlocks(map: TileMap): void {
    const g = this.blocks;
    const fills = new FillBatch();
    const seams: Edge[] = [];
    const faceLines: Edge[] = [];
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) {
        const t = map.at(tx, ty)!;
        if (!t.raised) continue;
        const x = tx * T;
        const y = ty * T;
        const isWall = t.id === 'wall';
        const top = isWall ? PAL.wallTop : (RAISED_TOP[t.id] ?? PAL.blockTop);
        const front = isWall ? PAL.wallFront : darken(top, 0.62);
        const hasFront = ty + 1 < map.h && !map.isRaised(tx, ty + 1);
        const topH = hasFront ? T - BLOCK.front : T;
        fills.add(top, (gg) => void gg.rect(x, y, T, topH));
        if (hasFront) {
          fills.add(front, (gg) => void gg.rect(x, y + topH, T, BLOCK.front));
          faceLines.push({ x0: tx, y0: ty + topH / T, x1: tx + 1, y1: ty + topH / T });
          const sx = tx + 0.2 + hash2(tx, ty, 3) * 0.6;
          seams.push({ x0: sx, y0: ty + topH / T, x1: sx, y1: ty + 1 });
        }
        const light = isWall ? PAL.wallTopLight : lighten(top, 0.25);
        if (!map.isRaised(tx, ty - 1)) fills.add(light, (gg) => void gg.rect(x, y, T, 0.4));
        if (!map.isRaised(tx - 1, ty)) fills.add(light, (gg) => void gg.rect(x, y, 0.35, topH));
        const hc = hash2(tx, ty, 5);
        if (isWall && hc < 0.35) {
          const cx = x + 0.8 + hash2(tx, ty, 6) * 2.2;
          const cy = y + 0.9 + hash2(tx, ty, 8) * Math.max(0.2, topH - 1.8);
          fills.add(PAL.wallChip, (gg) => void gg.roundRect(cx, cy, 0.9, 0.45, 0.2));
        }
      }
    }
    fills.flush(g);
    // Lines go after the fills so they sit on top, one path per color.
    strokeEdges(g, seams, LINE.detail, PAL.wallSeam);
    strokeEdges(g, mergeRuns(faceLines), LINE.detail * 1.2, PAL.wallSeam);
    strokeEdges(
      g,
      edgeRuns(map, (x, y) => map.isRaised(x, y)).map((r) => r.edge),
      LINE.outline,
      PAL.ink,
    );
  }

  private drawProps(map: TileMap): void {
    const g = this.props;
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) {
        const t = map.at(tx, ty)!;
        const x = tx * T;
        const y = ty * T;
        if (t.prop === 'crate' || t.prop === 'box') {
          const crate = t.prop === 'crate';
          drawBox(
            g,
            x,
            y,
            crate ? PAL.crateTop : PAL.blockTop,
            crate ? PAL.crateFront : PAL.blockFront,
            crate,
          );
        } else if (t.prop === 'brazier') {
          drawBrazierBowl(g, x + T / 2, y + T / 2 + 0.3);
        } else if (t.prop === 'loomstone') {
          drawLoomStone(g, x + T / 2, y + T / 2);
        }
      }
    }
  }
}

/** A raised box inset in its tile: lighter top, darker front, planks for crates. */
function drawBox(g: Graphics, x: number, y: number, top: number, front: number, planks: boolean): void {
  const inset = 0.3;
  const bx = x + inset;
  const by = y + inset;
  const w = T - inset * 2;
  const h = T - inset * 2;
  const fh = 0.95;
  g.rect(bx + 0.3, by + 0.5, w, h).fill({ color: PAL.shadow, alpha: BLOCK.shadowAlpha * 1.4 });
  g.rect(bx, by, w, h - fh).fill(top);
  g.rect(bx, by + h - fh, w, fh).fill(front);
  if (planks) {
    g.moveTo(bx, by + (h - fh) / 2).lineTo(bx + w, by + (h - fh) / 2);
    g.moveTo(bx + 0.3, by + 0.3).lineTo(bx + w - 0.3, by + h - fh - 0.3);
    g.stroke({ width: LINE.detail, color: PAL.crateTopDark, cap: 'round' });
    g.moveTo(bx + w * 0.33, by + h - fh).lineTo(bx + w * 0.33, by + h);
    g.moveTo(bx + w * 0.66, by + h - fh).lineTo(bx + w * 0.66, by + h);
    g.stroke({ width: LINE.detail, color: darken(front, 0.75), cap: 'round' });
  }
  g.moveTo(bx, by + h - fh)
    .lineTo(bx + w, by + h - fh)
    .stroke({ width: LINE.detail, color: PAL.ink });
  g.rect(bx, by, w, h).stroke({ width: LINE.outline * 0.85, color: PAL.ink, join: 'round' });
}

function drawBrazierBowl(g: Graphics, cx: number, cy: number): void {
  g.ellipse(cx + 0.25, cy + 0.45, 1.75, 1.45).fill({ color: PAL.shadow, alpha: 0.22 });
  // Three stubby legs peeking out under the bowl.
  for (const dx of [-1.1, 0, 1.1]) g.roundRect(cx + dx - 0.25, cy + 0.6, 0.5, 0.9, 0.2);
  g.fill(PAL.brazierRim).stroke({ width: LINE.detail, color: PAL.ink });
  g.ellipse(cx, cy, 1.6, 1.3)
    .fill(PAL.brazierStone)
    .stroke({ width: LINE.outline * 0.85, color: PAL.ink });
  g.ellipse(cx, cy - 0.15, 1.1, 0.8)
    .fill(PAL.brazierCoal)
    .stroke({ width: LINE.detail, color: PAL.brazierRim });
}

function drawLoomStone(g: Graphics, cx: number, cy: number): void {
  g.circle(cx, cy, 1.85).fill({ color: PAL.loomStoneRune, alpha: 0.18 });
  g.circle(cx, cy, 1.35)
    .fill(PAL.loomStone)
    .stroke({ width: LINE.outline * 0.8, color: PAL.ink });
  g.circle(cx, cy, 0.95).stroke({ width: LINE.detail, color: darken(PAL.loomStone, 0.75) });
  // A four-point rune.
  g.poly([
    cx,
    cy - 0.7,
    cx + 0.22,
    cy - 0.22,
    cx + 0.7,
    cy,
    cx + 0.22,
    cy + 0.22,
    cx,
    cy + 0.7,
    cx - 0.22,
    cy + 0.22,
    cx - 0.7,
    cy,
    cx - 0.22,
    cy - 0.22,
  ]);
  g.fill(PAL.loomStoneRune).stroke({ width: LINE.detail * 0.8, color: PAL.ink });
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

export function darken(color: number, f: number): number {
  const r = ((color >> 16) & 255) * f;
  const gg = ((color >> 8) & 255) * f;
  const b = (color & 255) * f;
  return (Math.round(r) << 16) | (Math.round(gg) << 8) | Math.round(b);
}

export function lighten(color: number, f: number): number {
  const ch = (c: number): number => Math.round(c + (255 - c) * f);
  return (ch((color >> 16) & 255) << 16) | (ch((color >> 8) & 255) << 8) | ch(color & 255);
}
