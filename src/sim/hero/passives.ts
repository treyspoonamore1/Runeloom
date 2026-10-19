/**
 * Passive tree rules (DESIGN §9): points, allocation, refunds, and the 'allocate' / 'refund'
 * HeroEdits. The tree itself is data/passives.ts. Everything here except applyPassiveEdit is a
 * pure query on HeroState, for the UI (through src/app/hero.ts) and tests.
 *
 * - Points = level − 1 + Pattern Seeds. Allocated nodes are `hero.passives`, in order; the start
 *   node is always allocated and never listed.
 * - Allocate: a node next to the allocated set (start included), with a point to spend.
 * - Refund: an allocated node whose removal keeps every other allocated node connected to the
 *   start. Free below level 10, then 1 Thread Scrap per point (passiveRespec).
 */
import {
  PASSIVE_START,
  isPassiveId,
  passiveEdges,
  passiveIds,
  passiveNodes,
  type PassiveId,
} from '../../../data/passives';
import type { GameState } from '../state';
import { refreshHero } from './hero';
import type { HeroState } from './types';

/** Respec cost (DESIGN §9): free while the level is below `freeBelowLevel`. */
export const passiveRespec = { freeBelowLevel: 10, scrapPerPoint: 1 } as const;

/** Neighbors of every node, in edge order (deterministic). */
export const passiveNeighbors: Readonly<Record<PassiveId, readonly PassiveId[]>> = (() => {
  const out = Object.fromEntries(passiveIds.map((id) => [id, [] as PassiveId[]])) as Record<
    PassiveId,
    PassiveId[]
  >;
  for (const [a, b] of passiveEdges) {
    out[a].push(b);
    out[b].push(a);
  }
  return out;
})();

/** Total points earned: level − 1 + Pattern Seeds. */
export function passivePoints(hero: Readonly<HeroState>): number {
  return Math.max(0, hero.level - 1) + hero.patternSeeds;
}

/** Points not yet spent (negative if a save holds more nodes than points). */
export function passivePointsAvailable(hero: Readonly<HeroState>): number {
  return passivePoints(hero) - hero.passives.length;
}

/** The allocated set, start included. */
export function allocatedSet(hero: Readonly<HeroState>): Set<PassiveId> {
  const set = new Set<PassiveId>([PASSIVE_START]);
  for (const id of hero.passives) if (isPassiveId(id)) set.add(id);
  return set;
}

export function isAllocated(hero: Readonly<HeroState>, id: string): boolean {
  return id === PASSIVE_START || hero.passives.includes(id);
}

/** Why `id` can't be allocated now, or null if it can. */
export function allocateBlocker(hero: Readonly<HeroState>, id: string): string | null {
  if (!isPassiveId(id)) return `Unknown passive "${id}"`;
  if (isAllocated(hero, id)) return `${passiveNodes[id].name} is already allocated`;
  if (passivePointsAvailable(hero) < 1) return 'No passive points left';
  const set = allocatedSet(hero);
  if (!passiveNeighbors[id].some((n) => set.has(n)))
    return `${passiveNodes[id].name} isn't connected to your Pattern`;
  return null;
}

export function canAllocate(hero: Readonly<HeroState>, id: string): boolean {
  return allocateBlocker(hero, id) === null;
}

/** Thread Scrap one refund costs at the hero's level. */
export function refundCost(hero: Readonly<HeroState>): number {
  return hero.level < passiveRespec.freeBelowLevel ? 0 : passiveRespec.scrapPerPoint;
}

export interface RefundCheck {
  ok: boolean;
  /** Why not, or null when ok. */
  reason: string | null;
  /** Thread Scrap it costs (also when not ok, for display). */
  cost: number;
}

/** Whether `id` can be refunded now, why not, and its cost. */
export function refundCheck(hero: Readonly<HeroState>, id: string): RefundCheck {
  const cost = refundCost(hero);
  const no = (reason: string): RefundCheck => ({ ok: false, reason, cost });
  if (!isPassiveId(id)) return no(`Unknown passive "${id}"`);
  if (id === PASSIVE_START) return no("The Pattern's heart can't be refunded");
  if (!hero.passives.includes(id)) return no(`${passiveNodes[id].name} isn't allocated`);
  if (!staysConnected(hero, id))
    return no(`Refunding ${passiveNodes[id].name} would disconnect your Pattern`);
  if (hero.threadScrap < cost) return no(`Needs ${cost} Thread Scrap`);
  return { ok: true, reason: null, cost };
}

/** True if every allocated node except `removed` is still reachable from the start without it. */
function staysConnected(hero: Readonly<HeroState>, removed: PassiveId): boolean {
  const set = allocatedSet(hero);
  set.delete(removed);
  const seen = new Set<PassiveId>([PASSIVE_START]);
  const queue: PassiveId[] = [PASSIVE_START];
  for (let k = 0; k < queue.length; k++)
    for (const n of passiveNeighbors[queue[k]!])
      if (set.has(n) && !seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
  return seen.size === set.size;
}

/**
 * Path preview: the unallocated nodes to allocate, in order, to reach `id` by the fewest nodes
 * (ending with `id`); [] if it is allocated; null for an unknown id. Ignores points, so the UI
 * can show how many it would take. Ties break by edge order.
 */
export function passivePath(hero: Readonly<HeroState>, id: string): PassiveId[] | null {
  if (!isPassiveId(id)) return null;
  const set = allocatedSet(hero);
  if (set.has(id)) return [];
  const prev = new Map<PassiveId, PassiveId | null>();
  const queue: PassiveId[] = [];
  for (const a of passiveIds)
    if (set.has(a)) {
      prev.set(a, null);
      queue.push(a);
    }
  for (let k = 0; k < queue.length; k++) {
    const cur = queue[k]!;
    for (const n of passiveNeighbors[cur]) {
      if (prev.has(n)) continue;
      prev.set(n, cur);
      if (n === id) {
        const path: PassiveId[] = [];
        for (let at: PassiveId | null = n; at !== null && !set.has(at); at = prev.get(at) ?? null)
          path.push(at);
        return path.reverse();
      }
      queue.push(n);
    }
  }
  return null;
}

/** The 'allocate' and 'refund' HeroEdits: applies one if legal and refreshes the hero. */
export function applyPassiveEdit(
  state: GameState,
  edit: { kind: 'allocate'; node: string } | { kind: 'refund'; node: string },
): string | null {
  const hero = state.hero;
  if (edit.kind === 'allocate') {
    const why = allocateBlocker(hero, edit.node);
    if (why !== null) return why;
    hero.passives.push(edit.node);
  } else {
    const check = refundCheck(hero, edit.node);
    if (!check.ok) return check.reason;
    hero.threadScrap -= check.cost;
    hero.passives.splice(hero.passives.indexOf(edit.node), 1);
  }
  refreshHero(state);
  return null;
}
