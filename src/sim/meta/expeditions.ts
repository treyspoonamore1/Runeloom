/**
 * The Expedition Board (DESIGN §11, M7): hired Weavers run timed rifts. One expedition per free
 * Weaver (view.ts weavers), tier 1 up to the best tier completed this cycle (at least 1); it takes
 * expeditionSeconds (Swift Expeditions: ÷ 1.5, for expeditions sent after the purchase) and, on
 * collect, rolls its rewards with the loot RNG: Fuse parts (no boss parts) with a tier by the
 * rift tier's area level, crafting currencies by dropWeight, and Embers. Rewards go through
 * grantContent, so gear would meet the Salvage Loom. data/hearth.ts expeditionBoard.
 */
import { expeditionBoard } from '../../../data/hearth';
import { fuseParts, type FusePartId } from '../../../data/fuseParts';
import { bossKinds } from '../../../data/progression';
import { riftAreaLevel } from '../../../data/rift';
import { emit } from '../events';
import { makePart, nextUid } from '../items/items';
import { grantContent, type LootContent } from '../items/loot';
import { partTierFor, rollCurrency } from '../items/drops';
import type { GameState } from '../state';
import { expeditionSeconds, maxExpeditionTier, weavers } from './view';

/** Fuse parts an expedition can bring back: every part a non-boss enemy drops, in data order. */
export const EXPEDITION_PARTS: readonly FusePartId[] = (Object.keys(fuseParts) as FusePartId[]).filter(
  (id) => !bossKinds.includes(fuseParts[id].dropsFrom),
);

/** Reward counts for an expedition of `tier`. */
export function expeditionRewardCounts(tier: number): { parts: number; currency: number; embers: number } {
  const r = expeditionBoard.rewards;
  return {
    parts: r.parts.min + Math.floor(tier / r.parts.perTier),
    currency: r.currency.min + Math.floor(tier / r.currency.perTier),
    embers: r.embersPerTier * tier,
  };
}

/** Weavers not out or waiting to be collected. */
export function freeWeavers(state: GameState): number {
  const h = state.hero.hearth;
  return Math.max(0, weavers(h.buildings.expedition_board) - h.expeditions.length);
}

export function sendExpedition(state: GameState, tier: number): string | null {
  const hero = state.hero;
  const h = hero.hearth;
  if (h.buildings.expedition_board <= 0) return 'Build the Expedition Board first';
  if (freeWeavers(state) <= 0) return 'No free Weaver: collect or wait for one';
  const max = maxExpeditionTier(hero);
  if (!Number.isInteger(tier) || tier < 1 || tier > max)
    return max === 1
      ? 'Expeditions run tier 1 until you complete a rift'
      : `Expeditions run tiers 1 to ${max}`;
  const duration = expeditionSeconds(hero, tier);
  h.expeditions.push({ uid: nextUid(hero), tier, left: duration, duration });
  return null;
}

/** The rewards of an expedition of `tier`, rolled now with the loot RNG, in grant order. */
export function rollExpeditionRewards(state: GameState, tier: number): LootContent[] {
  const rng = state.lootRng;
  const n = expeditionRewardCounts(tier);
  const out: LootContent[] = [];
  const partTier = partTierFor(riftAreaLevel(tier));
  for (let i = 0; i < n.parts; i++) {
    const id = EXPEDITION_PARTS[rng.int(EXPEDITION_PARTS.length)]!;
    out.push({ kind: 'part', part: makePart(state.hero, id, partTier) });
  }
  for (let i = 0; i < n.currency; i++) out.push({ kind: 'currency', currency: rollCurrency(rng), amount: 1 });
  if (n.embers > 0) out.push({ kind: 'embers', amount: n.embers });
  return out;
}

export function collectExpedition(state: GameState, uid: number): string | null {
  const h = state.hero.hearth;
  const i = h.expeditions.findIndex((e) => e.uid === uid);
  if (i < 0) return 'No such expedition';
  const e = h.expeditions[i]!;
  if (e.left > 0) return `Not back yet: ${Math.ceil(e.left)} s to go`;
  h.expeditions.splice(i, 1);
  const rewards = rollExpeditionRewards(state, e.tier);
  let parts = 0;
  let currency = 0;
  let embers = 0;
  for (const c of rewards) {
    grantContent(state, c);
    if (c.kind === 'part') parts++;
    else if (c.kind === 'currency') currency += c.amount;
    else if (c.kind === 'embers') embers += c.amount;
  }
  emit(state, { type: 'expeditionCollected', uid, tier: e.tier, parts, currency, embers });
  return null;
}
