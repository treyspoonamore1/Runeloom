/**
 * Read-only numbers about the Hearth for screens, tooltips and bots (M7). Pure functions of the
 * hero (and, for location checks, the game).
 *
 * CONTRACT (M7), owned by the meta agent: the formulas (data/hearth.ts) live here once, so the
 * systems and the screens never disagree. The UI reads these through src/app/hearth.ts.
 */
import {
  buildings,
  expeditionBoard,
  hearthRoom,
  kindlingPit,
  mutationEffects,
  mutations,
  rekindle,
  runeGarden,
  salvageLoom,
  type BuildingId,
  type MutationId,
} from '../../../data/hearth';
import { RIFT_TIERS } from '../../../data/rift';
import type { GameState } from '../state';
import type { HeroState } from '../hero/types';
import type { SalvageSetting } from './types';
import { mutationCount } from './mutations';

/** Embers to raise `building` from `level` to level + 1. */
export function upgradeCost(building: BuildingId, level: number): number {
  const d = buildings[building];
  return Math.round(d.costBase * Math.pow(d.costGrowth, level));
}

/** Hearth production × this (Bright Hearth). */
export function productionMult(hero: Readonly<HeroState>): number {
  return 1 + mutationEffects.brightHearthPer * mutationCount(hero, 'bright_hearth');
}

/** Kindling Pit Thread Scrap per minute at a level (before Bright Hearth); 0 unbuilt. */
export function scrapPerMinute(level: number): number {
  return level <= 0 ? 0 : kindlingPit.perMinute * Math.pow(kindlingPit.growth, level - 1);
}

/** Rune Garden plots at a level. */
export function gardenPlots(level: number): number {
  return level <= 0 ? 0 : Math.min(runeGarden.maxPlots, 1 + Math.floor(level / runeGarden.plotEvery));
}

/** Rune Garden XP per minute for each planted rune at a level (before Bright Hearth). */
export function gardenXpPerMinute(level: number): number {
  return level <= 0 ? 0 : runeGarden.xpPerMinute * Math.pow(runeGarden.growth, level - 1);
}

/** Expedition Board Weavers at a level. */
export function weavers(level: number): number {
  return level <= 0
    ? 0
    : Math.min(expeditionBoard.maxWeavers, 1 + Math.floor((level - 1) / expeditionBoard.weaverEvery));
}

/** Highest tier an expedition can run: the best tier completed this cycle, at least 1. */
export function maxExpeditionTier(hero: Readonly<HeroState>): number {
  return Math.max(1, hero.riftTier);
}

/** Seconds an expedition of `tier` takes for this hero (Swift Expeditions included). */
export function expeditionSeconds(hero: Readonly<HeroState>, tier: number): number {
  const base = expeditionBoard.baseSeconds + expeditionBoard.perTierSeconds * tier;
  return mutationCount(hero, 'swift_expeditions') > 0 ? base / mutationEffects.swiftSpeed : base;
}

/** Highest rarity the Salvage Loom can salvage at a level ('off' below normalAt). */
export function salvageCap(level: number): SalvageSetting {
  if (level >= salvageLoom.rareAt) return 'rare';
  if (level >= salvageLoom.magicAt) return 'magic';
  if (level >= salvageLoom.normalAt) return 'normal';
  return 'off';
}

/** Salvage Loom Thread Scrap multiplier at a level. */
export function salvageMult(level: number): number {
  return 1 + salvageLoom.bonusPerLevel * level;
}

/** The highest rift tier the hero may open after `rekindles` Rekindles. */
export function maxRiftTierFor(rekindles: number): number {
  return Math.min(RIFT_TIERS, rekindle.baseMaxTier + rekindle.maxTierPerRekindle * rekindles);
}

export function maxRiftTier(hero: Readonly<HeroState>): number {
  return maxRiftTierFor(hero.hearth.rekindles);
}

/** The fewest Rekindles that let a rift of `tier` open (bots and tests that start past the cap). */
export function rekindlesForTier(tier: number): number {
  return Math.max(
    0,
    Math.ceil((Math.min(tier, RIFT_TIERS) - rekindle.baseMaxTier) / rekindle.maxTierPerRekindle),
  );
}

/** Ash a Rekindle would give now (0 when it isn't unlocked). */
export function ashForRekindle(hero: Readonly<HeroState>): number {
  if (hero.riftTier < rekindle.unlockTier) return 0;
  const tierPart = rekindle.tierAsh * (hero.riftTier - rekindle.unlockTier + 1);
  return tierPart + Math.floor(Math.sqrt(hero.hearth.embersSpent / rekindle.emberDivisor));
}

/** Ash the next purchase of a mutation costs, or null when maxed. */
export function mutationCost(hero: Readonly<HeroState>, id: MutationId): number | null {
  const d = mutations[id];
  return mutationCount(hero, id) >= d.max ? null : d.ash;
}

/** The player is in the Hearth's room (where Hearth edits work). */
export function inHearth(state: GameState): boolean {
  return state.room.id === hearthRoom;
}

/** One line on what a building does at a level for this hero ("2.4 Thread Scrap a minute"). */
export function buildingEffect(hero: Readonly<HeroState>, id: BuildingId, level: number): string {
  if (level <= 0) return 'Not built';
  const mult = productionMult(hero);
  switch (id) {
    case 'kindling_pit':
      return `${(scrapPerMinute(level) * mult).toFixed(1)} Thread Scrap a minute`;
    case 'rune_garden':
      return `${gardenPlots(level)} plot${gardenPlots(level) === 1 ? '' : 's'}, ${Math.round(gardenXpPerMinute(level) * mult)} rune XP a minute each`;
    case 'expedition_board':
      return `${weavers(level)} Weaver${weavers(level) === 1 ? '' : 's'}`;
    case 'salvage_loom': {
      const cap = salvageCap(level);
      const bonus = Math.round((salvageMult(level) - 1) * 100);
      return cap === 'off' ? 'Salvages nothing yet' : `Salvages up to ${cap} gear, +${bonus}% Thread Scrap`;
    }
  }
}
