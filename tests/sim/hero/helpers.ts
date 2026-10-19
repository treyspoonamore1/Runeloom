import { refreshHero } from '../../../src/sim/hero/hero';
import type { FusePart, HeroState } from '../../../src/sim/hero/types';
import type { GameState } from '../../../src/sim';
import { passiveNodes, PASSIVE_START, type PassiveId } from '../../../data/passives';
import { passiveNeighbors } from '../../../src/sim/hero/passives';

/**
 * Allocates `ids` on the state's hero plus the shortest connecting path for each (no point
 * checks: tests set what they need), then refreshes HeroMods.
 */
export function allocate(state: GameState, ...ids: PassiveId[]): void {
  for (const id of ids) for (const n of pathFromAllocated(state.hero, id)) state.hero.passives.push(n);
  refreshHero(state);
}

/** Only `ids` (no path), then refreshes. */
export function allocateExactly(state: GameState, ...ids: PassiveId[]): void {
  state.hero.passives = [...ids];
  refreshHero(state);
}

function pathFromAllocated(hero: HeroState, id: PassiveId): PassiveId[] {
  const set = new Set<string>([PASSIVE_START, ...hero.passives]);
  if (set.has(id)) return [];
  const prev = new Map<PassiveId, PassiveId | null>();
  const q: PassiveId[] = [];
  for (const a of set) {
    prev.set(a as PassiveId, null);
    q.push(a as PassiveId);
  }
  for (let k = 0; k < q.length; k++)
    for (const n of passiveNeighbors[q[k]!]) {
      if (prev.has(n)) continue;
      prev.set(n, q[k]!);
      q.push(n);
    }
  const path: PassiveId[] = [];
  for (let at: PassiveId | null = id; at !== null && !set.has(at); at = prev.get(at) ?? null) path.push(at);
  if (!passiveNodes[id]) throw new Error(id);
  return path.reverse();
}

/** Equips a Twig spindle with `parts` fused (one socket each, as many as given) and refreshes. */
export function fuse(state: GameState, ...parts: [string, 1 | 2 | 3][]): void {
  const hero = state.hero;
  const fused: FusePart[] = parts.map(([part, tier]) => ({ uid: hero.nextUid++, part, tier }));
  const uid = hero.nextUid++;
  hero.items.push({ uid, base: 'twig', rarity: 'normal', itemLevel: 1, affixes: [], fused });
  hero.equipped.spindle = uid;
  refreshHero(state);
}
