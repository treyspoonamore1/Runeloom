/**
 * The progression sim's model player at the Hearth (M7 balance): pure decisions, read from the
 * hero and the game, that bots/hearthVisit.ts applies with Hearth edits. Unit tested in
 * tests/sim/bots/hearthPolicy.test.ts.
 *
 * - Buildings: the cheapest upgrade after weighting its cost (`upgradeWeights`); the bot saves
 *   for it rather than buying a worse one, then repeats while Embers last.
 * - Salvage Loom: salvage up to one rarity below the worst equipped item (gear the reference
 *   build would never wear or craft on), capped by what the Loom's level allows.
 * - Spindlewright: buys one currency at a time, the first in `currencyOrder` the crafting plan
 *   (bots/campaignCraft.ts) would spend now, keeping `scrapReserve` Thread Scrap for unfusing.
 * - Rune Garden: plants the unsocketed runes below the level cap, runes the weaves use first,
 *   then the highest levels (they replace socketed ones sooner: hero/runes.ts picks the highest).
 * - Rekindle: at the tier cap, or once unlocked after `stallFailures` failed rifts in a row or
 *   `stallRifts` rifts without a new best tier (another tier is worth less than a new cycle).
 * - Mutations: the first not yet maxed in `mutationOrder`; the bot saves Ash for it.
 */
import { affixCounts } from '../../../data/affixes';
import { maxRuneQuality, type CurrencyId } from '../../../data/currency';
import {
  BUILDING_IDS,
  buildings,
  rekindle,
  spindlewrightPrices,
  type BuildingId,
  type MutationId,
} from '../../../data/hearth';
import { maxRuneLevel } from '../../../data/progression';
import { EQUIP_SLOTS, type EquipSlot, type HeroState, type Item, type ItemRarity } from '../hero/types';
import type { ItemKind } from '../../../data/items';
import { findItem, kindOfBase } from '../items/items';
import { SALVAGE_ORDER } from '../meta/salvage';
import type { SalvageSetting } from '../meta/types';
import { maxRiftTier, mutationCost, salvageCap, upgradeCost } from '../meta/view';

/** Upgrade cost × this decides the order: lower first (the Kindling Pit feeds crafting, the Board Embers). */
export const upgradeWeights: Readonly<Record<BuildingId, number>> = {
  kindling_pit: 1,
  expedition_board: 1,
  rune_garden: 1.3,
  salvage_loom: 1.6,
};

/** The building to raise next (cheapest weighted cost, not at its max), or null when all are maxed. */
export function nextUpgrade(
  hero: Readonly<HeroState>,
  weights: Readonly<Record<BuildingId, number>> = upgradeWeights,
): BuildingId | null {
  let best: BuildingId | null = null;
  let bestCost = Infinity;
  for (const id of BUILDING_IDS) {
    const level = hero.hearth.buildings[id];
    if (level >= buildings[id].maxLevel) continue;
    const c = upgradeCost(id, level) * weights[id];
    if (c < bestCost) {
      best = id;
      bestCost = c;
    }
  }
  return best;
}

const RARITY_ORDER: readonly ItemRarity[] = ['normal', 'magic', 'rare', 'unique'];

/** The Salvage Loom setting: one rarity below the worst equipped item ('off' with an empty or Normal slot), capped by its level. */
export function salvagePlan(hero: Readonly<HeroState>): SalvageSetting {
  let worst = RARITY_ORDER.length - 1;
  for (const slot of EQUIP_SLOTS) {
    const uid = hero.equipped[slot];
    const it = uid === null ? undefined : findItem(hero as HeroState, uid);
    worst = Math.min(worst, it ? RARITY_ORDER.indexOf(it.rarity) : -1);
  }
  const want: SalvageSetting = worst <= 0 ? 'off' : worst === 1 ? 'normal' : 'magic';
  const cap = salvageCap(hero.hearth.buildings.salvage_loom);
  return SALVAGE_ORDER[Math.min(SALVAGE_ORDER.indexOf(want), SALVAGE_ORDER.indexOf(cap))]!;
}

/** The order the Spindlewright's currencies are bought in, when the crafting plan wants them. */
export const currencyOrder: readonly CurrencyId[] = [
  'golden_needle',
  'loom_shuttle',
  'chaos_skein',
  'rune_polish',
  'spool_of_change',
  'weavers_knot',
];

/** Thread Scrap kept back for unfusing parts on a spindle swap (bots/campaignPlan.ts moveParts). */
export const scrapReserve = 10;

const KIND_OF_SLOT: Readonly<Record<EquipSlot, ItemKind>> = {
  spindle: 'spindle',
  cloak: 'cloak',
  hood: 'hood',
  boots: 'boots',
  charm1: 'charm',
  charm2: 'charm',
};

function equippedItems(hero: Readonly<HeroState>): { slot: EquipSlot; item?: Item }[] {
  return EQUIP_SLOTS.map((slot) => {
    const uid = hero.equipped[slot];
    return { slot, item: uid === null ? undefined : findItem(hero as HeroState, uid) };
  });
}

/** Whether the crafting plan (bots/campaignCraft.ts) would spend one more `c` now. `mainRuneQuality`: the LMB form rune's. */
export function craftWants(
  hero: Readonly<HeroState>,
  c: CurrencyId,
  mainRuneQuality: number | null,
): boolean {
  const held = hero.currency[c] ?? 0;
  if (held > 0) return false;
  const gear = equippedItems(hero);
  const maxAffixes = affixCounts.rare.prefixes + affixCounts.rare.suffixes;
  const worn = new Set(gear.map((g) => g.item?.uid));
  const spareNormal = (slot: EquipSlot) =>
    hero.items.some(
      (it) => it.rarity === 'normal' && !worn.has(it.uid) && kindOfBase(it.base) === KIND_OF_SLOT[slot],
    );
  switch (c) {
    case 'golden_needle':
      return gear.some((g) => g.item?.rarity === 'rare' && g.item.affixes.length < maxAffixes);
    case 'chaos_skein':
      return gear.some((g) => g.item?.rarity === 'rare' && g.item.affixes.length <= 3);
    case 'loom_shuttle':
    case 'weavers_knot':
      // bots/campaignCraft.ts craftNewItems: a slot without a Rare or unique, with a Normal to craft.
      return gear.some(({ slot, item }) => {
        const r = item?.rarity;
        if (r === 'rare' || r === 'unique' || (c === 'weavers_knot' && r === 'magic')) return false;
        return r === 'normal' || spareNormal(slot);
      });
    case 'spool_of_change':
      return gear.some((g) => g.item?.rarity === 'magic' && g.item.affixes.length < 2);
    case 'rune_polish':
      return mainRuneQuality !== null && mainRuneQuality < maxRuneQuality;
    default:
      return false;
  }
}

/** The currency to buy next from the Spindlewright, or null. */
export function nextPurchase(hero: Readonly<HeroState>, mainRuneQuality: number | null): CurrencyId | null {
  for (const c of currencyOrder)
    if (hero.threadScrap - spindlewrightPrices[c] >= scrapReserve && craftWants(hero, c, mainRuneQuality))
      return c;
  return null;
}

/**
 * Runes to plant, best first, at most `plots`: pouch runes (not in `socketed`) below the level
 * cap, those whose id a weave uses first, then the highest level, then the oldest.
 */
export function gardenPicks(
  hero: Readonly<HeroState>,
  socketed: ReadonlySet<number>,
  plots: number,
): number[] {
  const usedIds = new Set(hero.runes.filter((r) => socketed.has(r.uid)).map((r) => r.rune));
  return hero.runes
    .filter((r) => !socketed.has(r.uid) && r.level < maxRuneLevel)
    .sort(
      (a, b) =>
        Number(usedIds.has(b.rune)) - Number(usedIds.has(a.rune)) || b.level - a.level || a.uid - b.uid,
    )
    .slice(0, Math.max(0, plots))
    .map((r) => r.uid);
}

export interface RekindlePolicy {
  /** Rekindle once unlocked after this many failed rifts in a row (null: never for failures). */
  stallFailures: number | null;
  /** Rekindle once unlocked after this many rifts without a new best tier (null: never for that). */
  stallRifts: number | null;
}

export const defaultRekindlePolicy: RekindlePolicy = { stallFailures: 3, stallRifts: 9 };

/** How the climb is going: failed rifts in a row, and rifts since the best tier last rose. */
export interface ClimbState {
  failuresInARow: number;
  riftsSinceBest: number;
}

/** Whether to Rekindle now: unlocked, and at the tier cap or stalled. */
export function shouldRekindle(
  hero: Readonly<HeroState>,
  climb: ClimbState,
  policy: RekindlePolicy = defaultRekindlePolicy,
): boolean {
  if (hero.riftTier < rekindle.unlockTier) return false;
  if (hero.riftTier >= maxRiftTier(hero)) return true;
  if (policy.stallFailures !== null && climb.failuresInARow >= policy.stallFailures) return true;
  return policy.stallRifts !== null && climb.riftsSinceBest >= policy.stallRifts;
}

/**
 * Mutations in the order the model player buys them: what it can use (it never builds weaves
 * for Deeper Weave, Shatter or Stormglass): a head start, production, faster expeditions.
 */
export const mutationOrder: readonly MutationId[] = [
  'sigil_cache',
  'bright_hearth',
  'swift_expeditions',
  'bright_hearth',
  'bright_hearth',
  'kindred_flame',
  'bright_hearth',
  'bright_hearth',
  'twin_threads',
  'bright_hearth',
  'bright_hearth',
  'bright_hearth',
  'bright_hearth',
  'bright_hearth',
];

/** The next mutation to save for (the first in `mutationOrder` not yet bought as often as listed), or null. */
export function nextMutation(hero: Readonly<HeroState>): MutationId | null {
  const seen: Partial<Record<MutationId, number>> = {};
  for (const id of mutationOrder) {
    const n = (seen[id] = (seen[id] ?? 0) + 1);
    if ((hero.hearth.mutations[id] ?? 0) < n && mutationCost(hero, id) !== null) return id;
  }
  return null;
}
