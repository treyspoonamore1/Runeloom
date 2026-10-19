import { describe, expect, it } from 'vitest';
import { fixtureTree } from '../../src/ui/fixtures/tree';
import {
  allocatedSet,
  allocateProblem,
  fitView,
  hitTest,
  indexTree,
  nodeInDirection,
  nodeState,
  NODE_RADIUS,
  passivePoints,
  refundCost,
  refundProblem,
  toTree,
  treeBounds,
  zoomAt,
} from '../../src/ui/tree/treeModel';

const ix = indexTree(fixtureTree(20));

describe('passive tree states and rules', () => {
  it('the fixture has 20 nodes, one start and an undirected edge list', () => {
    expect(ix.tree.nodes).toHaveLength(20);
    expect(ix.tree.nodes.filter((n) => n.type === 'start')).toHaveLength(1);
    for (const [a, b] of ix.edges) {
      expect(ix.byId.get(a)!.links).toContain(b);
      expect(ix.byId.get(b)!.links).toContain(a);
    }
  });

  it('marks allocated, available (next to allocated) and locked nodes', () => {
    const alloc = allocatedSet(ix, ['weaver_0']);
    expect(nodeState(ix, alloc, 'start')).toBe('allocated');
    expect(nodeState(ix, alloc, 'weaver_0')).toBe('allocated');
    expect(nodeState(ix, alloc, 'ember_1')).toBe('available');
    expect(nodeState(ix, alloc, 'weaver_1')).toBe('available');
    expect(nodeState(ix, alloc, 'ember_3')).toBe('locked');
  });

  it('allocates only connected nodes with a free point', () => {
    const alloc = allocatedSet(ix, []);
    expect(allocateProblem(ix, alloc, 'weaver_0', 1)).toBeNull();
    expect(allocateProblem(ix, alloc, 'ember_2', 1)).toBe('Not connected to your Pattern');
    expect(allocateProblem(ix, alloc, 'weaver_0', 0)).toBe('No passive points left');
    expect(allocateProblem(ix, alloc, 'start', 1)).toBe('Already allocated');
  });

  it('refunds only leaves of the allocated tree, and charges after level 10', () => {
    const alloc = allocatedSet(ix, ['weaver_0', 'ember_1', 'ember_2']);
    expect(refundProblem(ix, alloc, 'ember_1', 0, 0)).toBe('Other nodes depend on it');
    expect(refundProblem(ix, alloc, 'ember_2', 0, 0)).toBeNull();
    expect(refundProblem(ix, alloc, 'start', 0, 0)).toBe('The start of your Pattern stays');
    expect(refundCost(9)).toBe(0);
    expect(refundCost(10)).toBe(1);
    expect(refundProblem(ix, alloc, 'ember_2', 1, 0)).toBe('Needs 1 Thread Scrap');
  });

  it('a node reached two ways can be refunded while the other path holds', () => {
    // warden_0 joins ember_1 and rime_1: with both arms allocated, ember_1's side still reaches the start.
    const alloc = allocatedSet(ix, ['weaver_0', 'weaver_1', 'ember_1', 'rime_1', 'warden_0']);
    expect(refundProblem(ix, alloc, 'warden_0', 0, 0)).toBeNull();
    expect(refundProblem(ix, alloc, 'ember_1', 0, 0)).toBeNull();
  });

  it('counts one point per level above 1 plus Pattern Seeds', () => {
    expect(passivePoints(6, 1, 4)).toEqual({ total: 6, spent: 4, free: 2 });
  });
});

describe('passive tree viewport and hit-testing', () => {
  it('hits the node under a point, widened by slop, and nothing between nodes', () => {
    const n = ix.byId.get('ember_2')!;
    expect(hitTest(ix, n.x + 3, n.y - 3)?.id).toBe('ember_2');
    const r = NODE_RADIUS[n.type];
    expect(hitTest(ix, n.x + r + 4, n.y)).toBeNull();
    expect(hitTest(ix, n.x + r + 4, n.y, 6)?.id).toBe('ember_2');
    expect(hitTest(ix, 5000, 5000)).toBeNull();
  });

  it('stays correct through zoom: screen → tree → hit', () => {
    const v = fitView(treeBounds(ix.tree.nodes), 1000, 600, 30, 0.35, 2.6);
    const n = ix.byId.get('tempest_4')!;
    const sx = n.x * v.zoom + v.x;
    const sy = n.y * v.zoom + v.y;
    const z = zoomAt(v, sx, sy, 1.15, 0.35, 2.6);
    // Zooming about the node keeps it under the cursor.
    const p = toTree(z, sx, sy);
    expect(hitTest(ix, p.x, p.y)?.id).toBe('tempest_4');
  });

  it('fits the whole tree inside the box and clamps zoom', () => {
    const b = treeBounds(ix.tree.nodes);
    const v = fitView(b, 800, 500, 20, 0.35, 2.6);
    expect(b.minX * v.zoom + v.x).toBeGreaterThanOrEqual(19.9);
    expect(b.maxX * v.zoom + v.x).toBeLessThanOrEqual(780.1);
    expect(b.maxY * v.zoom + v.y).toBeLessThanOrEqual(480.1);
    expect(zoomAt(v, 0, 0, 100, 0.35, 2.6).zoom).toBe(2.6);
  });

  it('walks the tree by direction for keyboard play', () => {
    const start = ix.byId.get('start')!;
    const down = nodeInDirection(ix, start, 0, 1)!;
    expect(down.id).toBe('weaver_2');
    expect(nodeInDirection(ix, down, 0, 1)?.id).toBe('tempest_1');
  });

  it('a 300-node tree indexes and hit-tests quickly', () => {
    const big = indexTree(fixtureTree(300));
    expect(big.tree.nodes.length).toBeGreaterThanOrEqual(280);
    const t0 = performance.now();
    for (let i = 0; i < 20000; i++) hitTest(big, (i % 200) * 13 - 1300, ((i * 7) % 200) * 13 - 1300, 4);
    expect(performance.now() - t0).toBeLessThan(250);
  });
});
