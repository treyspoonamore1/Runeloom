/**
 * Hit-area geometry shared by spells (Strike's arc) and enemy attacks (telegraph == hit area).
 * No trig: arcs and cones are given by the cosine of their half angle, directions are unit
 * vectors. All tests are inclusive: touching counts as a hit.
 */

/**
 * An attack's area, relative to its origin (Enemy.attack.originX/Y):
 * - circle: centered on the origin.
 * - cone: a sector with its apex at the origin, radius r, opening ±acos(halfAngleCos) around dir.
 * - line: a rectangle starting at the origin, `length` along dir and `width` across (full width).
 */
export type AttackShape =
  | { kind: 'circle'; r: number }
  | { kind: 'cone'; r: number; halfAngleCos: number; dirX: number; dirY: number }
  | { kind: 'line'; length: number; width: number; dirX: number; dirY: number };

/** True if the circle (cx, cy, cr) touches the shape placed at (ox, oy). */
export function circleHitsShape(
  shape: AttackShape,
  ox: number,
  oy: number,
  cx: number,
  cy: number,
  cr: number,
): boolean {
  switch (shape.kind) {
    case 'circle': {
      const dx = cx - ox;
      const dy = cy - oy;
      const rr = shape.r + cr;
      return dx * dx + dy * dy <= rr * rr;
    }
    case 'cone':
      return circleIntersectsSector(cx, cy, cr, ox, oy, shape.dirX, shape.dirY, shape.halfAngleCos, shape.r);
    case 'line':
      return circleIntersectsLine(cx, cy, cr, ox, oy, shape.dirX, shape.dirY, shape.length, shape.width);
  }
}

/** True if the point is inside the shape placed at (ox, oy). Render and AI use this for telegraphs. */
export function pointInAttackShape(
  shape: AttackShape,
  ox: number,
  oy: number,
  px: number,
  py: number,
): boolean {
  return circleHitsShape(shape, ox, oy, px, py, 0);
}

/**
 * Circle vs circular sector (apex px, py; unit direction dir; half angle given by its cosine;
 * radius reach). Exact: a circle centered inside the wedge hits if it reaches the arc; one
 * outside the wedge hits only if it touches one of the two edge segments.
 */
export function circleIntersectsSector(
  cx: number,
  cy: number,
  cr: number,
  px: number,
  py: number,
  dirX: number,
  dirY: number,
  halfAngleCos: number,
  reach: number,
): boolean {
  const dx = cx - px;
  const dy = cy - py;
  const d2 = dx * dx + dy * dy;
  const outer = reach + cr;
  if (d2 > outer * outer) return false;
  if (d2 <= cr * cr) return true;
  const along = dx * dirX + dy * dirY;
  if (along >= Math.sqrt(d2) * halfAngleCos) return true;
  // Outside the wedge: nearest sector point is on an edge segment (dir rotated by ± the half angle).
  const c = halfAngleCos;
  const s = Math.sqrt(Math.max(0, 1 - c * c));
  return (
    segmentWithin(dx, dy, dirX * c - dirY * s, dirX * s + dirY * c, reach, cr) ||
    segmentWithin(dx, dy, dirX * c + dirY * s, -dirX * s + dirY * c, reach, cr)
  );
}

/** True if point (dx, dy) is within r of the segment from the origin to len × unit (ex, ey). */
function segmentWithin(dx: number, dy: number, ex: number, ey: number, len: number, r: number): boolean {
  let t = dx * ex + dy * ey;
  t = t < 0 ? 0 : t > len ? len : t;
  const qx = dx - ex * t;
  const qy = dy - ey * t;
  return qx * qx + qy * qy <= r * r;
}

/** Circle vs the rectangle from (ox, oy) along unit dir, `length` long and `width` wide. */
export function circleIntersectsLine(
  cx: number,
  cy: number,
  cr: number,
  ox: number,
  oy: number,
  dirX: number,
  dirY: number,
  length: number,
  width: number,
): boolean {
  const dx = cx - ox;
  const dy = cy - oy;
  const u = dx * dirX + dy * dirY;
  const v = dx * -dirY + dy * dirX;
  const half = width / 2;
  const qu = u < 0 ? u : u > length ? u - length : 0;
  const qv = v < -half ? v + half : v > half ? v - half : 0;
  return qu * qu + qv * qv <= cr * cr;
}
