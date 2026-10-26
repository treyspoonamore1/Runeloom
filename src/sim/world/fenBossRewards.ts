/**
 * What the Drowned Foundry's bosses pay when they die (CONTENT §13.1–13.3, DESIGN §10.5; data in
 * data/bossesFen.ts fenBossRewards), on top of every boss's Fuse part and loot (items/drops.ts):
 * - rune copies at the Fen's rune level, straight into the pouch ('rewardGranted', as a room's
 *   guaranteed runes); the first Gale in the save is an element "item get" ('elementUnlocked'
 *   with source 'boss', which the UI shows about 2 s after the death, as the Warden's Storm);
 * - Pattern Seeds (+1 passive point each, 'patternSeedGained');
 * - a Rift Sigil (the Coil's tier 9, the first deep-rift sigil), dropped by the body.
 * Region bosses die once per save (WorldState.bossesDefeated), so this pays once; their rift
 * versions are other kinds and pay nothing here. The deep rifts open from the same death
 * (meta/view.ts riftOpenCap reads bossesDefeated). Called by world/rift/rewards.ts onBossDefeated.
 */
import { fenBossRewards } from '../../../data/bossesFen';
import { runes } from '../../../data/runes';
import { emit } from '../events';
import { refreshHero } from '../hero/hero';
import { makeRune } from '../items/items';
import { grantContent, type LootContent } from '../items/loot';
import { makeSigil } from '../items/sigils';
import type { GameState } from '../state';

export function payFenBoss(state: GameState, kind: string, x: number, y: number, drops: LootContent[]): void {
  if (kind !== 'bellwether' && kind !== 'glasswater_coil') return;
  const r = fenBossRewards[kind];
  const hero = state.hero;
  const roomId = state.room.id;
  for (const rune of r.runes) {
    const fresh = !hero.unlockedRunes.includes(rune);
    const content: LootContent = { kind: 'rune', rune: makeRune(hero, rune, r.runeLevel) };
    grantContent(state, content);
    emit(state, { type: 'rewardGranted', roomId, content });
    if (fresh && runes[rune].kind === 'element')
      emit(state, { type: 'elementUnlocked', rune, roomId, x, y, source: 'boss' });
  }
  if (r.patternSeeds > 0) {
    hero.patternSeeds += r.patternSeeds;
    refreshHero(state);
    emit(state, { type: 'patternSeedGained', amount: r.patternSeeds, total: hero.patternSeeds, x, y });
  }
  if (r.sigilTier !== null) drops.push({ kind: 'sigil', sigil: makeSigil(hero, r.sigilTier, []) });
}
