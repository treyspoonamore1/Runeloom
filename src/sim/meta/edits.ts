/**
 * Hearth commands (M7): plain data, part of HeroEdit (hero/edits.ts), so the Session records them
 * and replays apply them at the same tick. The UI sends them through sendHeroEdit
 * (src/app/hearth.ts wraps them).
 *
 * CONTRACT (M7), owned by the meta agent. Every edit except 'offline' needs adventure mode, a lit
 * Hearth and the player in the Hearth's room (data/hearth.ts hearthRoom); 'offline' needs only a
 * lit Hearth. Each returns why it can't apply, or null.
 */
import type { CurrencyId } from '../../../data/currency';
import type { BuildingId, MutationId } from '../../../data/hearth';
import type { GameState } from '../state';
import type { SalvageSetting } from './types';

export type HearthEdit =
  /** Spends Embers to raise a building one level. */
  | { kind: 'hearthUpgrade'; building: BuildingId }
  /** Plants a pouch rune (not socketed) in a free Rune Garden plot. */
  | { kind: 'gardenPlant'; uid: number }
  /** Takes a planted rune back to the pouch. */
  | { kind: 'gardenUproot'; uid: number }
  /** Hires a free Weaver for a timed rift of `tier` (1 up to the best tier completed this cycle, at least 1). */
  | { kind: 'expeditionSend'; tier: number }
  /** Takes a returned expedition's rewards (rolled now with the loot RNG). */
  | { kind: 'expeditionCollect'; uid: number }
  /** The Salvage Loom's setting; a rarity above what its level allows is refused. */
  | { kind: 'salvageSetting'; setting: SalvageSetting }
  /** Buys one crafting currency from the Spindlewright for Thread Scrap (data/hearth.ts spindlewrightPrices). */
  | { kind: 'spindlewrightBuy'; currency: CurrencyId }
  /** Prestige (DESIGN §11): after a tier 8 clear, with no rift open. */
  | { kind: 'rekindle' }
  /** Spends Ash on a Mutation (CONTENT §11). */
  | { kind: 'mutationBuy'; mutation: MutationId }
  /**
   * Offline progress: the app measured `seconds` of wall-clock time since the save it loaded
   * (capped at data/hearth.ts offline.capSeconds; the sim refuses more) and sends this right after
   * loading. The only way wall-clock time reaches the sim.
   */
  | { kind: 'offline'; seconds: number };

export type HearthEditKind = HearthEdit['kind'];

export const HEARTH_EDIT_KINDS: readonly HearthEditKind[] = [
  'hearthUpgrade',
  'gardenPlant',
  'gardenUproot',
  'expeditionSend',
  'expeditionCollect',
  'salvageSetting',
  'spindlewrightBuy',
  'rekindle',
  'mutationBuy',
  'offline',
];

export function isHearthEdit(edit: { kind: string }): edit is HearthEdit {
  return (HEARTH_EDIT_KINDS as readonly string[]).includes(edit.kind);
}

/** Applies a Hearth edit if legal; returns why not, or null. Refreshes the hero when it changes the build. Meta agent. */
export function applyHearthEdit(state: GameState, edit: HearthEdit): string | null {
  void state;
  return `Not built yet: ${edit.kind}`;
}
