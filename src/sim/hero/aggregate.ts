/**
 * The item side of HeroMods: equipped items' implicits and affixes, Heart Seeds and Loom Shards,
 * and the list of fused parts (the effects agent turns parts into numbers and rules).
 */
import { affixes, isAffixId } from '../../../data/affixes';
import { gearBases, isGearBaseId } from '../../../data/items';
import { explorationRewards } from '../../../data/progression';
import { isSpindleId, spindles } from '../../../data/spindles';
import { EQUIP_SLOTS, type HeroState, type Item } from './types';
import type { HeroMods } from './mods';
import { addStat, implicitStats } from './stats';
import { findItem } from '../items/items';

/** Implicit stats of an item's base, in display units. */
export function baseImplicits(base: string): ReturnType<typeof implicitStats> {
  if (isSpindleId(base)) return implicitStats(spindles[base].implicit);
  if (isGearBaseId(base)) return gearBases[base].implicit.slice();
  return [];
}

/** Adds one item's implicits and affixes to `mods`. */
export function addItemStats(mods: HeroMods, item: Item): void {
  for (const s of baseImplicits(item.base)) addStat(mods, s.stat, s.value);
  for (const a of item.affixes) if (isAffixId(a.id)) addStat(mods, affixes[a.id].stat, a.value);
}

/** Adds everything the hero's items, Heart Seeds and Loom Shards give. */
export function addHeroItemMods(mods: HeroMods, hero: HeroState): void {
  for (const slot of EQUIP_SLOTS) {
    const uid = hero.equipped[slot];
    if (uid === null) continue;
    const item = findItem(hero, uid);
    if (!item) continue;
    addItemStats(mods, item);
  }
  mods.maxLifeAdd += hero.heartSeeds * explorationRewards.heartSeedLife;
  mods.capacityAdd += hero.loomShards * explorationRewards.loomShardCapacity;
}
