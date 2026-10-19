/**
 * Passive tree screen adapter: everything the tree screen needs from the passive-tree agent.
 *
 * EXPECTED from data/passives.ts (passive-tree agent):
 *   - the tree: nodes with { id, name, type: 'start' | 'small' | 'notable' | 'keystone',
 *     area: 'ember' | 'rime' | 'tempest' | 'weaver' | 'warden', x, y (layout units, any scale;
 *     the screen fits them), text: string[] (effect lines), links: string[] (neighbor ids,
 *     listed on both ends or one; either works) }, and the start node id.
 *   - allocate / refund rules: connected to the allocated tree; refunds keep it connected; free
 *     until level 10, then 1 Thread Scrap per point (DESIGN §9). If the agent exports
 *     `canAllocate(hero, id)` / `canRefund(hero, id)` returning a reason or null, use them below.
 * Edits go through src/ui/heroAdapter.ts → sendHeroEdit({ kind: 'allocate' | 'refund', node }).
 */
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

let cached: TreeIndex | null = null;

function treeSize(): number {
  if (typeof location === 'undefined') return 20;
  const n = Number(new URLSearchParams(location.search).get('tree'));
  return Number.isFinite(n) && n >= 20 ? n : 20;
}

/**
 * The indexed tree. MERGE: when fixtures are off, map data/passives.ts into PassiveTreeView here
 * (it is the only line that needs the real data).
 */
export function passiveIndex(): TreeIndex {
  if (!cached) cached = indexTree(fixtureTree(fixturesOn.peek() ? treeSize() : 20));
  return cached;
}

/** Tests swap the tree. */
export function setPassiveTree(tree: PassiveTreeView | null): void {
  cached = tree ? indexTree(tree) : null;
}

export function pointsOf(hero: Readonly<HeroState>): Points {
  const ix = passiveIndex();
  const spent = hero.passives.filter((p) => p !== ix.tree.start && ix.byId.has(p)).length;
  return passivePoints(hero.level, hero.patternSeeds, spent);
}

export function allocReason(hero: Readonly<HeroState>, id: string): string | null {
  const ix = passiveIndex();
  return allocateProblem(ix, allocatedSet(ix, hero.passives), id, pointsOf(hero).free);
}

export function refundPrice(hero: Readonly<HeroState>): number {
  return refundCost(hero.level);
}

export function refundReason(hero: Readonly<HeroState>, id: string): string | null {
  const ix = passiveIndex();
  return refundProblem(ix, allocatedSet(ix, hero.passives), id, refundPrice(hero), hero.threadScrap);
}
