/**
 * Rekindle (DESIGN §11, M7), the prestige. Unlocks once a tier 8 rift was completed this cycle,
 * at the Hearth, with no rift open. Grants Ash (view.ts ashForRekindle), counts the Rekindle
 * (each raises the highest openable tier by 2, view.ts maxRiftTier) and resets exactly
 * (DECISIONS 2026-10-24): Embers, Embers spent, building levels and the Kindling Pit's carry,
 * the Rune Garden (its runes stay in the pouch with their levels), the Salvage Loom setting,
 * hero.riftTier and hero.sigils. Everything else is kept, expeditions already out included.
 *
 * Sigil Cache: the new cycle starts with five plain tier 3 sigils, and riftTier = 2 so the ladder
 * opens them (data/hearth.ts mutationEffects.sigilCache).
 */
import { BUILDING_IDS, mutationEffects, rekindle } from '../../../data/hearth';
import { emit } from '../events';
import { makeSigil } from '../items/sigils';
import type { GameState } from '../state';
import { hasMutation } from './mutations';
import { ashForRekindle, maxRiftTier } from './view';

/** Why Rekindle can't be done now (beyond the Hearth gate in edits.ts), or null. */
export function rekindleError(state: GameState): string | null {
  if (state.hero.riftTier < rekindle.unlockTier) return `Complete a tier ${rekindle.unlockTier} rift first`;
  if (state.world.rift) return 'Close the open rift first';
  return null;
}

/** HeroEdit 'rekindle' once the Hearth gate passed. Sends 'rekindled'. */
export function applyRekindle(state: GameState): string | null {
  const err = rekindleError(state);
  if (err) return err;
  const hero = state.hero;
  const h = hero.hearth;
  const ash = ashForRekindle(hero);
  h.ash += ash;
  h.rekindles++;
  // ---- The reset list (and nothing else) ----
  h.embers = 0;
  h.embersSpent = 0;
  for (const b of BUILDING_IDS) h.buildings[b] = 0;
  h.scrapCarry = 0;
  h.garden = [];
  h.salvage = 'off';
  hero.riftTier = 0;
  hero.sigils = [];
  // ---- Sigil Cache ----
  if (hasMutation(hero, 'sigil_cache')) {
    const { tier, count } = mutationEffects.sigilCache;
    for (let i = 0; i < count; i++) hero.sigils.push(makeSigil(hero, tier, []));
    hero.riftTier = tier - 1;
  }
  emit(state, { type: 'rekindled', ash, rekindles: h.rekindles, maxTier: maxRiftTier(hero) });
  return null;
}
