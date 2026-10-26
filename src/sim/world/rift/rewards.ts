/**
 * Rewards tied to rifts (M6):
 * - Clearing a rift room mends tuning.rift.roomClearHeal of life and mana (no Loom Stones there).
 * - The Cinder Warden's first death drops the first Rift Sigil (data/rift.ts riftDrops.wardenSigilTier).
 * - A rift boss's death completes the rift: hero.riftTier rises to its tier (the ladder), and
 *   it drops a sigil, one tier higher with riftBossTierUpChance (M7: more likely with each
 *   completion of the best tier, hero.riftBestClears; fast below the best tier ever,
 *   hero.hearth.bestEverTier, which it raises) else its own tier, at most the Rekindle cap, some
 *   crafting currency
 *   (riftRewards) and, once the Hearth is lit, Embers (meta/embers.ts), around its body.
 * - The Cinder Warden's first death also lights the Hearth (M7, meta/hearth.ts lightHearth).
 * - M8: the Old Bellwether's and the Glasswater Coil's runes, Pattern Seed and the Coil's tier 9
 *   sigil (world/fenBossRewards.ts).
 * Called by world/roomClear.ts when a boss dies, after the death is recorded.
 */
import { riftBossTierUpChance, riftDrops, riftRewards } from '../../../../data/rift';
import { riftBossKinds } from '../../../../data/progression';
import { emit } from '../../events';
import { rollCurrency } from '../../items/drops';
import { dropLoot, type LootContent } from '../../items/loot';
import { makeSigil, rollSigil } from '../../items/sigils';
import type { GameState } from '../../state';
import { lightHearth } from '../../meta/hearth';
import { riftEmbers } from '../../meta/embers';
import { maxRiftTier } from '../../meta/view';
import { payFenBoss } from '../fenBossRewards';

/** A rift room was cleared: restore tuning.rift.roomClearHeal of max life and mana. */
export function onRiftRoomCleared(state: GameState): void {
  const p = state.player;
  if (p.dead) return;
  const f = state.tuning.rift.roomClearHeal;
  p.life = Math.min(p.maxLife, p.life + p.maxLife * f);
  p.mana = Math.min(p.maxMana, p.mana + p.maxMana * f);
}

export function onBossDefeated(state: GameState, kind: string, x: number, y: number): void {
  const out: LootContent[] = [];
  if (kind === 'cinder_warden') {
    out.push({ kind: 'sigil', sigil: makeSigil(state.hero, riftDrops.wardenSigilTier, []) });
    lightHearth(state); // M7: the Warden's first death lights the Hearth.
  }
  payFenBoss(state, kind, x, y, out); // M8: the Old Bellwether's and the Glasswater Coil's rewards.
  const rift = state.world.rift;
  if (riftBossKinds.includes(kind) && rift) {
    const tier = rift.spec.tier;
    const hero = state.hero;
    const best = tier > hero.riftTier;
    if (best) {
      hero.riftTier = tier;
      hero.riftBestClears = 0;
    }
    emit(state, { type: 'riftCompleted', tier, newBest: best });
    // M7: the next tier's sigil with a chance that grows with each completion of the best tier,
    // else this tier's; never above the Rekindle cap.
    const atBest = tier === hero.riftTier;
    // Below the best tier ever (an earlier cycle's), the fast re-climb chance.
    const chance = riftBossTierUpChance(tier, atBest ? hero.riftBestClears : 0, hero.hearth.bestEverTier);
    const up = state.lootRng.chance(chance) ? 1 : 0;
    if (atBest) hero.riftBestClears++;
    hero.hearth.bestEverTier = Math.max(hero.hearth.bestEverTier, tier);
    out.push({
      kind: 'sigil',
      sigil: rollSigil(state.hero, state.lootRng, Math.min(maxRiftTier(state.hero), tier + up)),
    });
    const n = riftRewards.currencyBase + Math.floor(tier / riftRewards.currencyPerTiers);
    for (let i = 0; i < n; i++)
      out.push({ kind: 'currency', currency: rollCurrency(state.lootRng), amount: 1 });
    const em = riftEmbers(state, tier); // M7: the rift completion Embers.
    if (em > 0) out.push({ kind: 'embers', amount: em });
  }
  // Placed after the boss's own drops (dropKillLoot ran at its death), farther out.
  out.forEach((c, i) => dropLoot(state, x, y, c, 8 + i));
}
