/**
 * Bulk salvage selection (M7.5): which bag items a preset takes. Pure. A preset never takes an
 * equipped item, a unique, an item with fused parts or an item marked to keep (locked), whatever
 * its rarity or the loot filter says.
 */
import { inventoryUi } from '../../../data/ui';
import { EQUIP_SLOTS, type HeroState, type Item } from '../../sim/hero/types';

export const SALVAGE_PRESETS = ['normal', 'normalMagic', 'hidden'] as const;
export type SalvagePreset = (typeof SALVAGE_PRESETS)[number];

export const PRESET_LABELS: Record<SalvagePreset, string> = {
  normal: 'All Normal',
  normalMagic: 'All Normal and Magic',
  hidden: 'Everything the loot filter hides',
};

/** Why a bag item is never bulk-salvaged, or null when it may be. */
export function protectedReason(hero: Readonly<HeroState>, it: Item): string | null {
  if (EQUIP_SLOTS.some((s) => hero.equipped[s] === it.uid)) return 'equipped';
  if (it.locked) return 'kept';
  if (it.rarity === 'unique' || it.unique) return 'unique';
  if (it.fused.some((f) => f !== null)) return 'has fused parts';
  return null;
}

/** The items a preset would salvage. `hides` tells whether the loot filter hides an item. */
export function salvageCandidates(
  hero: Readonly<HeroState>,
  preset: SalvagePreset,
  hides: (it: Item) => boolean,
): Item[] {
  return hero.items.filter((it) => {
    if (protectedReason(hero, it) !== null) return false;
    if (preset === 'hidden') return hides(it);
    return (inventoryUi.bulkSalvage[preset] ?? []).includes(it.rarity);
  });
}

export interface PresetSummary {
  preset: SalvagePreset;
  uids: number[];
  /** Thread Scrap they pay in all. */
  scrap: number;
}

/** Every preset with its items and what they pay, for the dialog. */
export function summarizePresets(
  hero: Readonly<HeroState>,
  hides: (it: Item) => boolean,
  valueOf: (it: Item) => number,
): PresetSummary[] {
  return SALVAGE_PRESETS.map((preset) => {
    const list = salvageCandidates(hero, preset, hides);
    return { preset, uids: list.map((i) => i.uid), scrap: list.reduce((n, i) => n + valueOf(i), 0) };
  });
}

/** Whether a shift-click salvage of this item asks first: Rare and Unique do, Normal and Magic go at once. */
export function quickSalvageNeedsConfirm(it: Item): boolean {
  return inventoryUi.confirmSalvageRarities.includes(it.rarity);
}
