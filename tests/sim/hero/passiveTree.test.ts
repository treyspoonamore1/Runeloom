import { describe, expect, it } from 'vitest';
import {
  passiveEdges,
  passiveIds,
  passiveNodes,
  passiveView,
  PASSIVE_START,
  type PassiveArea,
} from '../../../data/passives';
import { passiveNeighbors } from '../../../src/sim/hero/passives';

/** CONTENT §7: every keystone and notable, with its area. */
const KEYSTONES: Record<string, PassiveArea> = {
  wildheart: 'ember',
  pyre_walker: 'ember',
  hydromancer: 'rime',
  stormglass: 'tempest',
  living_loom: 'weaver',
  single_thread: 'weaver',
};
const NOTABLES: Record<string, PassiveArea> = {
  kindler: 'ember',
  slow_burn: 'ember',
  oilcraft: 'ember',
  deep_freeze: 'rime',
  brittle: 'rime',
  long_winter: 'rime',
  conduit: 'tempest',
  overcharge: 'tempest',
  rainshadow: 'tempest',
  spellwright: 'weaver',
  echoing_thread: 'weaver',
  quick_hands: 'warden',
  second_wind: 'warden',
};

const nodes = passiveIds.map((id) => passiveNodes[id]);

describe('the Pattern (DESIGN §9, CONTENT §7)', () => {
  it('has about 90 nodes: one start, every keystone and notable, the rest small', () => {
    expect(nodes.length).toBeGreaterThanOrEqual(85);
    expect(nodes.length).toBeLessThanOrEqual(95);
    expect(nodes.filter((n) => n.type === 'start').map((n) => n.id)).toEqual([PASSIVE_START]);
    const ks = nodes.filter((n) => n.type === 'keystone');
    const nb = nodes.filter((n) => n.type === 'notable');
    expect(Object.fromEntries(ks.map((n) => [n.id, n.area]))).toEqual(KEYSTONES);
    expect(Object.fromEntries(nb.map((n) => [n.id, n.area]))).toEqual(NOTABLES);
    for (const n of nodes.filter((n) => n.type === 'small')) expect(n.stats.length, n.id).toBeGreaterThan(0);
  });

  it('has nodes in all five areas, Weaver at the center and Warden outermost', () => {
    const r = (n: { x: number; y: number }) => Math.hypot(n.x, n.y);
    const by = (a: PassiveArea) => nodes.filter((n) => n.area === a);
    for (const a of ['weaver', 'ember', 'rime', 'tempest', 'warden'] as const)
      expect(by(a).length).toBeGreaterThan(8);
    expect(passiveNodes.start.x).toBe(0);
    expect(passiveNodes.start.y).toBe(0);
    const maxWeaver = Math.max(...by('weaver').map(r));
    const ringWarden = by('warden').filter((n) => n.id.startsWith('warden_r'));
    expect(Math.min(...ringWarden.map(r))).toBeGreaterThan(Math.max(...by('ember').map(r)));
    expect(maxWeaver).toBeLessThan(Math.min(...ringWarden.map(r)));
  });

  it('every node has a name, tooltip text and a position inside the view, and no two overlap', () => {
    for (const n of nodes) {
      expect(n.name.length, n.id).toBeGreaterThan(0);
      expect(n.text.length, n.id).toBeGreaterThan(0);
      expect(n.x).toBeGreaterThanOrEqual(passiveView.minX);
      expect(n.y).toBeGreaterThanOrEqual(passiveView.minY);
      expect(n.x).toBeLessThanOrEqual(passiveView.minX + passiveView.width);
      expect(n.y).toBeLessThanOrEqual(passiveView.minY + passiveView.height);
    }
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const d = Math.hypot(nodes[i]!.x - nodes[j]!.x, nodes[i]!.y - nodes[j]!.y);
        expect(d, `${nodes[i]!.id} / ${nodes[j]!.id}`).toBeGreaterThan(50);
      }
  });

  it('lists every edge once between existing nodes, and the whole tree is connected', () => {
    const seen = new Set<string>();
    for (const [a, b] of passiveEdges) {
      expect(a).not.toBe(b);
      expect(passiveNodes[a]).toBeDefined();
      expect(passiveNodes[b]).toBeDefined();
      const key = [a, b].sort().join('|');
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
    const reached = new Set<string>([PASSIVE_START]);
    const q: string[] = [PASSIVE_START];
    for (let k = 0; k < q.length; k++)
      for (const n of passiveNeighbors[q[k] as keyof typeof passiveNeighbors])
        if (!reached.has(n)) {
          reached.add(n);
          q.push(n);
        }
    expect(reached.size).toBe(nodes.length);
  });

  it('keystones sit at the end of their paths (one edge each)', () => {
    for (const id of Object.keys(KEYSTONES))
      expect(passiveNeighbors[id as keyof typeof passiveNeighbors].length, id).toBe(1);
  });
});
