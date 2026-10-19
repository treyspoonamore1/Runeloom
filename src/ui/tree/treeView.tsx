/**
 * The passive tree as SVG (DESIGN §9): drag to pan, wheel to zoom, keyboard too. Pan and zoom
 * write the transform straight to the DOM (no re-render), and pointer hit-testing uses the
 * bucket grid in treeModel.ts, so it stays smooth at 300 nodes.
 */
import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { uiTuning } from '../../../data/ui';
import type { PassiveNodeView } from './adapter';
import {
  fitView,
  hitTest,
  nodeInDirection,
  NODE_RADIUS,
  toTree,
  treeBounds,
  zoomAt,
  type NodeState,
  type TreeIndex,
  type View,
} from './treeModel';

export const hovered = signal<string | null>(null);
export const focused = signal<string | null>(null);

export interface TreeViewProps {
  ix: TreeIndex;
  states: ReadonlyMap<string, NodeState>;
  onActivate(id: string, refund: boolean): void;
}

const Z = { min: uiTuning.treeZoomMin, max: uiTuning.treeZoomMax };
const OCT = Array.from({ length: 8 }, (_, i) => {
  const a = ((i + 0.5) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)] as const;
});

function NodeShape({ n, st, focus }: { n: PassiveNodeView; st: NodeState; focus: boolean }) {
  const r = NODE_RADIUS[n.type];
  const cls = `tr-node a-${n.area} t-${n.type} ${st}${focus ? ' focus' : ''}`;
  return (
    <g class={cls} transform={`translate(${n.x} ${n.y})`}>
      {st === 'available' ? <circle class="tr-halo" r={r + 7} /> : null}
      {n.type === 'keystone' ? (
        <polygon class="tr-body" points={OCT.map(([x, y]) => `${x * r},${y * r}`).join(' ')} />
      ) : (
        <circle class="tr-body" r={r} />
      )}
      {n.type === 'notable' ? <circle class="tr-inner" r={r - 7} /> : null}
      {n.type === 'start' ? <path class="tr-inner" d="M0 -12L4 -4L12 0L4 4L0 12L-4 4L-12 0L-4 -4Z" /> : null}
      {n.type === 'notable' || n.type === 'keystone' ? (
        <text class="tr-label" y={r + 20}>
          {n.name}
        </text>
      ) : null}
      {focus ? <circle class="tr-focus" r={r + 11} /> : null}
    </g>
  );
}

export function TreeView({ ix, states, onActivate }: TreeViewProps) {
  const box = useRef<HTMLDivElement>(null);
  const layer = useRef<SVGGElement>(null);
  const view = useRef<View>({ x: 0, y: 0, zoom: 1 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);

  const apply = () => {
    const v = view.current;
    layer.current?.setAttribute('transform', `translate(${v.x} ${v.y}) scale(${v.zoom})`);
  };
  const fit = () => {
    const el = box.current;
    if (!el) return;
    view.current = fitView(treeBounds(ix.tree.nodes), el.clientWidth, el.clientHeight, 30, Z.min, Z.max);
    apply();
  };
  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const nodeAt = (sx: number, sy: number) => {
    const p = toTree(view.current, sx, sy);
    return hitTest(ix, p.x, p.y, 6 / view.current.zoom);
  };
  /** Pans so the node is inside the view (keyboard focus). */
  const reveal = (n: PassiveNodeView) => {
    const el = box.current;
    if (!el) return;
    const v = view.current;
    const sx = n.x * v.zoom + v.x;
    const sy = n.y * v.zoom + v.y;
    const m = 60;
    if (sx < m || sy < m || sx > el.clientWidth - m || sy > el.clientHeight - m) {
      view.current = { ...v, x: el.clientWidth / 2 - n.x * v.zoom, y: el.clientHeight / 2 - n.y * v.zoom };
      apply();
    }
  };

  useEffect(() => {
    fit();
    const el = box.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      view.current = zoomAt(
        view.current,
        p.x,
        p.y,
        e.deltaY < 0 ? uiTuning.treeZoomStep : 1 / uiTuning.treeZoomStep,
        Z.min,
        Z.max,
      );
      apply();
    };
    el.addEventListener('wheel', wheel, { passive: false });
    el.focus({ preventScroll: true });
    return () => el.removeEventListener('wheel', wheel);
  }, [ix]);

  const onKey = (e: KeyboardEvent) => {
    const el = box.current!;
    const v = view.current;
    const step = uiTuning.treePanStep;
    const pan = (dx: number, dy: number) => {
      view.current = { ...v, x: v.x + dx, y: v.y + dy };
      apply();
    };
    const dirs: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const wasd: Record<string, [number, number]> = {
      KeyA: [-1, 0],
      KeyD: [1, 0],
      KeyW: [0, -1],
      KeyS: [0, 1],
    };
    const d = dirs[e.key];
    const w = wasd[e.code];
    if (w || (d && e.shiftKey)) {
      const [dx, dy] = w ?? d!;
      pan(-dx * step, -dy * step);
    } else if (d) {
      const from = ix.byId.get(focused.peek() ?? '') ?? ix.byId.get(ix.tree.start)!;
      const next = focused.peek() ? nodeInDirection(ix, from, d[0], d[1]) : from;
      if (next) {
        focused.value = next.id;
        hovered.value = next.id;
        reveal(next);
      }
    } else if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') {
      const f = e.key === '-' || e.key === '_' ? 1 / uiTuning.treeZoomStep : uiTuning.treeZoomStep;
      view.current = zoomAt(v, el.clientWidth / 2, el.clientHeight / 2, f, Z.min, Z.max);
      apply();
    } else if (e.key === '0' || e.code === 'KeyF') fit();
    else if ((e.key === 'Enter' || e.key === ' ') && focused.peek()) onActivate(focused.peek()!, false);
    else if ((e.key === 'Delete' || e.key === 'Backspace') && focused.peek())
      onActivate(focused.peek()!, true);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const edges: Record<'allocated' | 'available' | 'locked', string[]> = {
    allocated: [],
    available: [],
    locked: [],
  };
  for (const [a, b] of ix.edges) {
    const sa = states.get(a);
    const sb = states.get(b);
    const k =
      sa === 'allocated' && sb === 'allocated'
        ? 'allocated'
        : sa === 'allocated' || sb === 'allocated'
          ? 'available'
          : 'locked';
    const na = ix.byId.get(a)!;
    const nb = ix.byId.get(b)!;
    edges[k].push(`M${na.x} ${na.y}L${nb.x} ${nb.y}`);
  }
  const foc = focused.value;
  return (
    <div
      class="tr-view"
      ref={box}
      tabIndex={0}
      role="application"
      aria-label="Passive tree. Arrow keys move between nodes, Enter allocates, Delete refunds, WASD pans, plus and minus zoom, F fits"
      onKeyDown={onKey}
      onPointerDown={(e) => {
        if (e.button !== 0 && e.button !== 2) return;
        drag.current = { ...local(e), vx: view.current.x, vy: view.current.y, moved: false };
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        const p = local(e);
        const d = drag.current;
        if (d && (d.moved || Math.abs(p.x - d.x) + Math.abs(p.y - d.y) > 4)) {
          d.moved = true;
          view.current = { ...view.current, x: d.vx + p.x - d.x, y: d.vy + p.y - d.y };
          apply();
          return;
        }
        const n = nodeAt(p.x, p.y);
        if ((n?.id ?? null) !== hovered.peek()) hovered.value = n?.id ?? null;
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (!d || d.moved) return;
        const p = local(e);
        const n = nodeAt(p.x, p.y);
        if (n) {
          focused.value = n.id;
          onActivate(n.id, e.button === 2);
        }
      }}
      onPointerLeave={() => {
        if (!drag.current) hovered.value = null;
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg class="tr-svg" width="100%" height="100%">
        <g ref={layer}>
          <path class="tr-edge locked" d={edges.locked.join('')} />
          <path class="tr-edge available" d={edges.available.join('')} />
          <path class="tr-edge allocated" d={edges.allocated.join('')} />
          {ix.tree.nodes.map((n) => (
            <NodeShape key={n.id} n={n} st={states.get(n.id) ?? 'locked'} focus={foc === n.id} />
          ))}
        </g>
      </svg>
      <div class="tr-zoom" aria-hidden="true">
        <span>Drag to pan · wheel to zoom · F to fit</span>
      </div>
    </div>
  );
}
