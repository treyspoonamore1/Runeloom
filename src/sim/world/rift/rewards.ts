/**
 * Boss rewards tied to rifts (M6):
 * - The Cinder Warden's first death drops the first Rift Sigil (data/rift.ts riftDrops.wardenSigilTier).
 * - A rift boss's death completes the rift: hero.riftTier rises to its tier (the ladder), and
 *   it drops a sigil one tier higher and some crafting currency (riftRewards), around its body.
 * Called by world/roomClear.ts when a boss dies, after the death is recorded.
 */
import { RIFT_TIERS, riftDrops, riftRewards } from '../../../../data/rift';
import { riftBossKinds } from '../../../../data/progression';
import { emit } from '../../events';
import { rollCurrency } from '../../items/drops';
import { dropLoot, type LootContent } from '../../items/loot';
import { makeSigil, rollSigil } from '../../items/sigils';
import type { GameState } from '../../state';

export function onBossDefeated(state: GameState, kind: string, x: number, y: number): void {
  const out: LootContent[] = [];
  if (kind === 'cinder_warden')
    out.push({ kind: 'sigil', sigil: makeSigil(state.hero, riftDrops.wardenSigilTier, []) });
  const rift = state.world.rift;
  if (riftBossKinds.includes(kind) && rift) {
    const tier = rift.spec.tier;
    const best = tier > state.hero.riftTier;
    if (best) state.hero.riftTier = tier;
    emit(state, { type: 'riftCompleted', tier, newBest: best });
    out.push({ kind: 'sigil', sigil: rollSigil(state.hero, state.lootRng, Math.min(RIFT_TIERS, tier + 1)) });
    const n = riftRewards.currencyBase + Math.floor(tier / riftRewards.currencyPerTiers);
    for (let i = 0; i < n; i++)
      out.push({ kind: 'currency', currency: rollCurrency(state.lootRng), amount: 1 });
  }
  // Placed after the boss's own drops (dropKillLoot ran at its death), farther out.
  out.forEach((c, i) => dropLoot(state, x, y, c, 8 + i));
}
