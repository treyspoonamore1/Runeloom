/**
 * One visit of the progression sim's model player to the Hearth (M7 balance), between rifts, in
 * the hub room: every step goes through Hearth edits (meta/edits.ts) and the reference build
 * (bots/campaignPlan.ts), so it is what a player could do from the hub's screens. The decisions
 * are bots/hearthPolicy.ts's. In order:
 *
 * 1. Collect returned expeditions.
 * 2. Uproot the Rune Garden, so the reference build can socket levelled runes.
 * 3. Upgrade buildings while Embers last (nextUpgrade).
 * 4. The reference build with crafting, then buy currencies it wants from the Spindlewright one at
 *    a time, rebuilding after each.
 * 5. Set the Salvage Loom (salvagePlan), plant spare runes (gardenPicks), send expeditions on
 *    every free Weaver at the highest tier allowed.
 */
import { spindlewrightPrices, type BuildingId } from '../../../data/hearth';
import type { CurrencyId } from '../../../data/currency';
import { applyHeroEdit } from '../hero/edits';
import { runeOrder, socketedUids } from '../hero/runes';
import { freeWeavers } from '../meta/expeditions';
import type { HearthEdit } from '../meta/edits';
import { gardenPlots, maxExpeditionTier } from '../meta/view';
import type { GameState } from '../state';
import { parseWeave } from '../weave/notation';
import { applyReferenceBuild } from './campaignPlan';
import { gardenPicks, nextPurchase, nextUpgrade, salvagePlan } from './hearthPolicy';

/** What the visits did, summed over a run (the progression report). */
export interface HearthTally {
  upgrades: number;
  embersSpent: number;
  /** Thread Scrap spent at the Spindlewright, and the currencies bought. */
  scrapSpent: number;
  bought: Partial<Record<CurrencyId, number>>;
  expeditionsSent: number;
  expeditionsCollected: number;
  expeditionParts: number;
  expeditionCurrency: number;
  expeditionEmbers: number;
  expeditionSigils: number;
  /** Expedition sigils above the best tier completed when collected (the Hearth's share of the climb). */
  expeditionTierUps: number;
  /** Expeditions collected at the best tier (each counts as a completion of it). */
  expeditionsAtBest: number;
  /** Runes planted (a rune replanted on every visit counts once per visit). */
  planted: number;
}

export function emptyTally(): HearthTally {
  return {
    upgrades: 0,
    embersSpent: 0,
    scrapSpent: 0,
    bought: {},
    expeditionsSent: 0,
    expeditionsCollected: 0,
    expeditionParts: 0,
    expeditionCurrency: 0,
    expeditionEmbers: 0,
    expeditionSigils: 0,
    expeditionTierUps: 0,
    expeditionsAtBest: 0,
    planted: 0,
  };
}

function edit(state: GameState, e: HearthEdit): string | null {
  return applyHeroEdit(state, e);
}

/** Quality of the LMB weave's form rune (what Rune Polish goes on, bots/campaignCraft.ts), or null. */
export function mainRuneQuality(state: GameState): number | null {
  const slot = state.weaves.slots[0];
  if (!slot?.notation || !slot.runes) return null;
  const p = parseWeave(slot.notation);
  if (!p.ok) return null;
  const i = runeOrder(p.tree).findIndex((r) => r.path.join('.') === 'root.form');
  return state.hero.runes.find((r) => r.uid === slot.runes![i])?.quality ?? null;
}

/** Plays one Hearth visit (see the file comment). The player must be in the hub. */
export function visitHearth(state: GameState, tally: HearthTally): void {
  const hero = state.hero;
  const h = hero.hearth;
  // 1. Expeditions back.
  for (const e of [...h.expeditions])
    if (e.left <= 0) {
      const before = h.embers;
      const sigils = hero.sigils.length;
      const clears = hero.riftBestClears;
      if (edit(state, { kind: 'expeditionCollect', uid: e.uid }) !== null) continue;
      tally.expeditionTierUps += hero.sigils.slice(sigils).filter((g) => g.tier > hero.riftTier).length;
      tally.expeditionsAtBest += hero.riftBestClears - clears;
      tally.expeditionsCollected++;
      tally.expeditionEmbers += h.embers - before;
      for (const ev of state.events)
        if (ev.type === 'expeditionCollected' && ev.uid === e.uid) {
          tally.expeditionParts += ev.parts;
          tally.expeditionCurrency += ev.currency;
          tally.expeditionSigils += ev.sigils;
        }
    }
  // 2. The garden's runes back to the pouch for the build.
  for (const uid of [...h.garden]) edit(state, { kind: 'gardenUproot', uid });
  // 3. Buildings.
  for (;;) {
    const b: BuildingId | null = nextUpgrade(hero);
    if (b === null) break;
    const before = h.embers;
    if (edit(state, { kind: 'hearthUpgrade', building: b }) !== null) break;
    tally.upgrades++;
    tally.embersSpent += before - h.embers;
  }
  // 4. Build and craft; buy what the crafting plan wants, one at a time.
  applyReferenceBuild(state, { craft: true });
  for (let guard = 0; guard < 200; guard++) {
    const c = nextPurchase(hero, mainRuneQuality(state));
    if (c === null) break;
    if (edit(state, { kind: 'spindlewrightBuy', currency: c }) !== null) break;
    tally.scrapSpent += spindlewrightPrices[c];
    tally.bought[c] = (tally.bought[c] ?? 0) + 1;
    applyReferenceBuild(state, { craft: true });
  }
  // 5. Salvage Loom, garden, expeditions.
  const setting = salvagePlan(hero);
  if (setting !== h.salvage) edit(state, { kind: 'salvageSetting', setting });
  for (const uid of gardenPicks(hero, socketedUids(state), gardenPlots(h.buildings.rune_garden)))
    if (edit(state, { kind: 'gardenPlant', uid }) === null) tally.planted++;
  const tier = maxExpeditionTier(hero);
  for (let n = freeWeavers(state); n > 0; n--)
    if (edit(state, { kind: 'expeditionSend', tier }) === null) tally.expeditionsSent++;
}
