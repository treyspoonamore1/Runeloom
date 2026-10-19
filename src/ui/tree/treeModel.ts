/**
 * Pure passive-tree view logic (no DOM, runs in Node tests): node states, allocation and refund
 * checks, points, the pan/zoom viewport and pointer hit-testing through a bucket grid, so 300+
 * nodes stay cheap.
 */
import type { PassiveNodeView, PassiveTreeView, PassiveType } from './adapter';

export type NodeState = 'allocated' | 'available' | 'locked';

/** Node radius in tree units, by type. Hit-testing and drawing share it. */
export const NODE_RADIUS: Record<PassiveType, number> = { start: 26, small: 15, notable: 23, keystone: 31 };

export interface TreeIndex {
  tree: PassiveTreeView;
  byId: Map<string, PassiveNodeView>;
  /** Undirected edges, each once (a < b). */
  edges: Array<[string, string]>;
  grid: HitGrid;
}

export function indexTree(tree: PassiveTreeView): TreeIndex {
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const edges: Array<[string, string]> = [];
  for (const n of tree.nodes)
    for (const l of n.links) {
      if (!byId.has(l)) continue;
      const [a, b] = n.id < l ? [n.id, l] : [l, n.id];
      const k = `${a}|${b}`;
      if (!seen.has(k)) {
        seen.add(k);
        edges.push([a, b]);
      }
    }
  return { tree, byId, edges, grid: buildHitGrid(tree.nodes) };
}

/** The allocated set, always including the start node. */
export function allocatedSet(ix: TreeIndex, passives: readonly string[]): Set<string> {
  const s = new Set(passives.filter((p) => ix.byId.has(p)));
  s.add(ix.tree.start);
  return s;
}

export function nodeState(ix: TreeIndex, alloc: ReadonlySet<string>, id: string): NodeState {
  if (alloc.has(id)) return 'allocated';
  const n = ix.byId.get(id);
  return n && n.links.some((l) => alloc.has(l)) ? 'available' : 'locked';
}

export interface Points {
  total: number;
  spent: number;
  free: number;
}

/** One point per level above 1, plus Pattern Seeds (DESIGN §9). The start node is free. */
export function passivePoints(level: number, patternSeeds: number, spent: number): Points {
  const total = Math.max(0, level - 1) + patternSeeds;
  return { total, spent, free: total - spent };
}

/** Why `id` can't be allocated, or null. */
export function allocateProblem(
  ix: TreeIndex,
  alloc: ReadonlySet<string>,
  id: string,
  freePoints: number,
): string | null {
  const n = ix.byId.get(id);
  if (!n) return 'Unknown node';
  if (alloc.has(id)) return 'Already allocated';
  if (!n.links.some((l) => alloc.has(l))) return 'Not connected to your Pattern';
  if (freePoints <= 0) return 'No passive points left';
  return null;
}

/** True when every allocated node still reaches the start without `removed`. */
export function staysConnected(ix: TreeIndex, alloc: ReadonlySet<string>, removed: string): boolean {
  const start = ix.tree.start;
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const id = queue.pop()!;
    for (const l of ix.byId.get(id)?.links ?? [])
      if (l !== removed && alloc.has(l) && !seen.has(l)) {
        seen.add(l);
        queue.push(l);
      }
  }
  for (const a of alloc) if (a !== removed && !seen.has(a)) return false;
  return true;
}

/** Thread Scrap a refund costs: free until level 10, then 1 per point (DESIGN §9). */
export function refundCost(level: number, freeUntilLevel = 10, scrapPerPoint = 1): number {
  return level < freeUntilLevel ? 0 : scrapPerPoint;
}

/** Why `id` can't be refunded, or null. */
export function refundProblem(
  ix: TreeIndex,
  alloc: ReadonlySet<string>,
  id: string,
  cost: number,
  scrap: number,
): string | null {
  if (id === ix.tree.start) return 'The start of your Pattern stays';
  if (!alloc.has(id)) return 'Not allocated';
  if (!staysConnected(ix, alloc, id)) return 'Other nodes depend on it';
  if (scrap < cost) return `Needs ${cost} Thread Scrap`;
  return null;
}

// ---- Viewport -------------------------------------------------------------------------------

/** Screen = tree × zoom + (x, y). */
export interface View {
  x: number;
  y: number;
  zoom: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function treeBounds(nodes: readonly PassiveNodeView[]): Bounds {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const n of nodes) {
    const r = NODE_RADIUS[n.type];
    b.minX = Math.min(b.minX, n.x - r);
    b.minY = Math.min(b.minY, n.y - r);
    b.maxX = Math.max(b.maxX, n.x + r);
    b.maxY = Math.max(b.maxY, n.y + r);
  }
  if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return b;
}

export const clampZoom = (z: number, min: number, max: number): number => Math.min(max, Math.max(min, z));

/** A view that fits `b` into a w×h box with `pad` pixels around it. */
export function fitView(b: Bounds, w: number, h: number, pad: number, min: number, max: number): View {
  const bw = Math.max(1, b.maxX - b.minX);
  const bh = Math.max(1, b.maxY - b.minY);
  const zoom = clampZoom(Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh), min, max);
  return { zoom, x: w / 2 - ((b.minX + b.maxX) / 2) * zoom, y: h / 2 - ((b.minY + b.maxY) / 2) * zoom };
}

/** Zooms by `factor` keeping the screen point (sx, sy) fixed. */
export function zoomAt(v: View, sx: number, sy: number, factor: number, min: number, max: number): View {
  const zoom = clampZoom(v.zoom * factor, min, max);
  const k = zoom / v.zoom;
  return { zoom, x: sx - (sx - v.x) * k, y: sy - (sy - v.y) * k };
}

export const toTree = (v: View, sx: number, sy: number): { x: number; y: number } => ({
  x: (sx - v.x) / v.zoom,
  y: (sy - v.y) / v.zoom,
});

// ---- Hit-testing ----------------------------------------------------------------------------

const CELL = 80;

export interface HitGrid {
  cells: Map<string, PassiveNodeView[]>;
}

function buildHitGrid(nodes: readonly PassiveNodeView[]): HitGrid {
  const cells = new Map<string, PassiveNodeView[]>();
  for (const n of nodes) {
    const k = `${Math.floor(n.x / CELL)},${Math.floor(n.y / CELL)}`;
    const list = cells.get(k);
    if (list) list.push(n);
    else cells.set(k, [n]);
  }
  return { cells };
}

/**
 * The node under tree point (x, y), or null. `slop` (tree units) widens every node a little so
 * small nodes are easy to hit when zoomed out. The nearest center wins on overlap.
 */
export function hitTest(ix: TreeIndex, x: number, y: number, slop = 0): PassiveNodeView | null {
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  let best: PassiveNodeView | null = null;
  let bestD = Infinity;
  for (let gx = cx - 1; gx <= cx + 1; gx++)
    for (let gy = cy - 1; gy <= cy + 1; gy++)
      for (const n of ix.grid.cells.get(`${gx},${gy}`) ?? []) {
        const d = (n.x - x) ** 2 + (n.y - y) ** 2;
        const r = NODE_RADIUS[n.type] + slop;
        if (d <= r * r && d < bestD) {
          best = n;
          bestD = d;
        }
      }
  return best;
}

/**
 * Keyboard navigation: the nearest node from `from` roughly in direction (dx, dy), within a
 * 60° cone either side; null when there is none.
 */
export function nodeInDirection(
  ix: TreeIndex,
  from: PassiveNodeView,
  dx: number,
  dy: number,
): PassiveNodeView | null {
  let best: PassiveNodeView | null = null;
  let bestScore = Infinity;
  for (const n of ix.tree.nodes) {
    if (n === from) continue;
    const vx = n.x - from.x;
    const vy = n.y - from.y;
    const d = Math.hypot(vx, vy);
    const cos = (vx * dx + vy * dy) / (d || 1);
    if (cos < 0.5) continue;
    const score = d * (2 - cos);
    if (score < bestScore) {
      best = n;
      bestScore = score;
    }
  }
  return best;
}
