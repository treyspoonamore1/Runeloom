/**
 * Footprint rasterization (paint.ts): the cells whose centers lie inside a shape, in row-major
 * order. Lines are capsules (rounded ends, width / 2 past each end point). A shape too small to cover any cell center still touches the cell under its origin, so
 * a pinpoint hit always reaches the ground it lands on.
 */
import type { Grid } from './grid';
import type { Footprint } from './paint';

/** Cell indices of the last rasterization (valid until the next call). */
export interface CellList {
  cells: Int32Array;
  len: number;
}

const out: CellList = { cells: new Int32Array(1024), len: 0 };

function push(i: number): void {
  if (out.len === out.cells.length) {
    const bigger = new Int32Array(out.cells.length * 2);
    bigger.set(out.cells);
    out.cells = bigger;
  }
  out.cells[out.len++] = i;
}

/** Rasterizes `shape` onto the grid. The returned list is shared scratch: copy what you keep. */
export function rasterize(g: Grid, shape: Footprint): CellList {
  out.len = 0;
  let x0: number;
  let y0: number;
  let x1: number;
  let y1: number;
  let inside: (px: number, py: number) => boolean;
  switch (shape.kind) {
    case 'circle': {
      const { x, y, r } = shape;
      const r2 = r * r;
      [x0, y0, x1, y1] = [x - r, y - r, x + r, y + r];
      inside = (px, py) => (px - x) * (px - x) + (py - y) * (py - y) <= r2;
      break;
    }
    case 'line': {
      const { x0: ax, y0: ay, x1: bx, y1: by } = shape;
      const h = shape.width / 2;
      const dx = bx - ax;
      const dy = by - ay;
      const l2 = dx * dx + dy * dy;
      [x0, y0, x1, y1] = [
        Math.min(ax, bx) - h,
        Math.min(ay, by) - h,
        Math.max(ax, bx) + h,
        Math.max(ay, by) + h,
      ];
      inside = (px, py) => {
        let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = px - (ax + dx * t);
        const ey = py - (ay + dy * t);
        return ex * ex + ey * ey <= h * h;
      };
      break;
    }
    case 'strip': {
      const { x, y, length } = shape;
      const h = shape.width / 2;
      const [ux, uy] = unit(shape.dirX, shape.dirY);
      const ex = x + ux * length;
      const ey = y + uy * length;
      [x0, y0, x1, y1] = [Math.min(x, ex) - h, Math.min(y, ey) - h, Math.max(x, ex) + h, Math.max(y, ey) + h];
      inside = (px, py) => {
        const along = (px - x) * ux + (py - y) * uy;
        const across = (px - x) * uy - (py - y) * ux;
        return along >= 0 && along <= length && across >= -h && across <= h;
      };
      break;
    }
    case 'arc': {
      const { x, y, r, halfAngleCos } = shape;
      const [ux, uy] = unit(shape.dirX, shape.dirY);
      const r2 = r * r;
      [x0, y0, x1, y1] = [x - r, y - r, x + r, y + r];
      inside = (px, py) => {
        const dx = px - x;
        const dy = py - y;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) return false;
        if (d2 === 0) return true;
        // cos(angle to the facing) ≥ halfAngleCos, without dividing: dot ≥ cos × |d|.
        const dot = dx * ux + dy * uy;
        return dot >= halfAngleCos * Math.sqrt(d2);
      };
      break;
    }
  }
  const cx0 = Math.max(0, Math.floor(x0 - 0.5));
  const cy0 = Math.max(0, Math.floor(y0 - 0.5));
  const cx1 = Math.min(g.width - 1, Math.ceil(x1 - 0.5));
  const cy1 = Math.min(g.height - 1, Math.ceil(y1 - 0.5));
  for (let cy = cy0; cy <= cy1; cy++)
    for (let cx = cx0; cx <= cx1; cx++) if (inside(cx + 0.5, cy + 0.5)) push(cy * g.width + cx);
  if (out.len === 0) {
    const [ox, oy] = origin(shape);
    const cx = Math.floor(ox);
    const cy = Math.floor(oy);
    if (cx >= 0 && cy >= 0 && cx < g.width && cy < g.height) push(cy * g.width + cx);
  }
  return out;
}

function unit(x: number, y: number): [number, number] {
  const l = Math.sqrt(x * x + y * y);
  return l > 0 ? [x / l, y / l] : [1, 0];
}

function origin(s: Footprint): [number, number] {
  return s.kind === 'line' ? [s.x0, s.y0] : [s.x, s.y];
}
