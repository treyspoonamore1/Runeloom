/**
 * Passive tree screen adapter: the real Pattern (data/passives.ts: 91 nodes in a [-1000, 1000]
 * space, data/passiveEdges.ts) and the effects agent's rules (src/sim/hero/passives.ts, the same
 * functions src/app/hero.ts wraps per session: allocateBlocker, refundCheck, refundCost,
 * passivePoints). Edits go through src/ui/heroAdapter.ts → sendHeroEdit({ kind: 'allocate' |
 * 'refund', node }). With `?fixture=1` (screenshots) the fixture tree and rules stand in.
 */
import { passiveEdges, passiveIds, passiveNodes, PASSIVE_START } from '../../../data/passives';
import {
  allocateBlocker,
  passivePath,
  passivePoints as simPassivePoints,
  passivePointsAvailable,
  refundCheck,
  refundCost as simRefundCost,
} from '../../sim/hero/passives';
import { fixturesOn } from '../fixtures/mode';
import { fixtureTree } from '../fixtures/tree';
import type { HeroState } from '../../sim/hero/types';
import {
  allocatedSet,
  allocateProblem,
  indexTree,
  passivePoints,
  refundCost,
  refundProblem,
  type Points,
  type TreeIndex,
} from './treeModel';

export type PassiveArea = 'ember' | 'rime' | 'tempest' | 'weaver' | 'warden';
export type PassiveType = 'start' | 'small' | 'notable' | 'keystone';

export interface PassiveNodeView {
  id: string;
  name: string;
  type: PassiveType;
  area: PassiveArea;
  x: number;
  y: number;
  text: string[];
  links: string[];
}

export interface PassiveTreeView {
  nodes: PassiveNodeView[];
  start: string;
}

let cached: { fixture: boolean; ix: TreeIndex } | null = null;

function treeSize(): number {
  if (typeof location === 'undefined') return 20;
  const n = Number(new URLSearchParams(location.search).get('tree'));
  return Number.isFinite(n) && n >= 20 ? n : 20;
}

/** The real Pattern as the screen's tree view (links from the edge list, on both ends). */
export function realTree(): PassiveTreeView {
  const links = new Map<string, string[]>(passiveIds.map((id) => [id, []]));
  for (const [a, b] of passiveEdges) {
    links.get(a)!.push(b);
    links.get(b)!.push(a);
  }
  return {
    start: PASSIVE_START,
    nodes: passiveIds.map((id) => {
      const n = passiveNodes[id];
      return { id, name: n.name, type: n.type, area: n.area, x: n.x, y: n.y, text: [...n.text], links: links.get(id)! };
    }),
  };
}

/** The indexed tree: the real Pattern, or the fixture tree with `?fixture=1`. */
export function passiveIndex(): TreeIndex {
  const fixture = fixturesOn.peek();
  if (!cached || cached.fixture !== fixture)
    cached = { fixture, ix: indexTree(fixture ? fixtureTree(treeSize()) : realTree()) };
  return cached.ix;
}

/** Tests swap the tree (null: back to the default for the current mode). */
export function setPassiveTree(tree: PassiveTreeView | null): void {
  cached = tree ? { fixture: fixturesOn.peek(), ix: indexTree(tree) } : null;
}

export function pointsOf(hero: Readonly<HeroState>): Points {
  if (!fixturesOn.peek()) {
    const total = simPassivePoints(hero);
    return { total, spent: hero.passives.length, free: passivePointsAvailable(hero) };
  }
  const ix = passiveIndex();
  const spent = hero.passives.filter((p) => p !== ix.tree.start && ix.byId.has(p)).length;
  return passivePoints(hero.level, hero.patternSeeds, spent);
}

export function allocReason(hero: Readonly<HeroState>, id: string): string | null {
  if (!fixturesOn.peek()) return allocateBlocker(hero, id);
  const ix = passiveIndex();
  return allocateProblem(ix, allocatedSet(ix, hero.passives), id, pointsOf(hero).free);
}

export function refundPrice(hero: Readonly<HeroState>): number {
  return fixturesOn.peek() ? refundCost(hero.level) : simRefundCost(hero);
}

export function refundReason(hero: Readonly<HeroState>, id: string): string | null {
  if (!fixturesOn.peek()) return refundCheck(hero, id).reason;
  const ix = passiveIndex();
  return refundProblem(ix, allocatedSet(ix, hero.passives), id, refundPrice(hero), hero.threadScrap);
}

/** Nodes still to allocate to reach `id` (ending with it; [] if allocated, null if unknown or fixtures). */
export function pathTo(hero: Readonly<HeroState>, id: string): string[] | null {
  return fixturesOn.peek() ? null : passivePath(hero, id);
}
