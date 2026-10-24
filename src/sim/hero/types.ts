/**
 * The character (M4): what persists across rooms and goes into a save. Lives in
 * `GameState.hero` and is hashed. Everything is plain data with numeric uids, so saves and
 * replays are straightforward.
 *
 * CONTRACT (M4). Owners:
 * - hero/items/loot agent: this file's types, src/sim/hero/* (except passives and effects),
 *   src/sim/items/*, the HeroEdit union and applyHeroEdit, the HeroMods aggregation from items,
 *   Heart Seeds, Loom Shards and levels.
 * - passive-tree and effects agent: `passives`, the passive tree data, and the HeroMods fields
 *   that passives, keystones, notables and Fuse parts feed, plus every system hook that reads them.
 * - UI agent: reads these through src/app/hero.ts; never writes them directly.
 */
import type { CurrencyId } from '../../../data/currency';
import type { RiftModId } from '../../../data/rift';
import type { RuneId } from '../../../data/runes';
import type { HearthState } from '../meta/types';

/** Equipment slots (DESIGN §8.1). Runes live in the pouch and weave slots, not here. */
export const EQUIP_SLOTS = ['spindle', 'cloak', 'hood', 'boots', 'charm1', 'charm2'] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];

export type ItemRarity = 'normal' | 'magic' | 'rare' | 'unique';

/**
 * A rune item (DESIGN §5.1): one node of a weave. Each item sits in one place at a time, either in
 * the pouch or socketed in one weave slot. Socketed runes gain XP and level from 1 to 20.
 */
export interface RuneItem {
  uid: number;
  rune: RuneId;
  level: number;
  /** XP toward the next rune level. */
  xp: number;
  /** 0–20 (%), from Rune Polish (M5). */
  quality: number;
}

/** One rolled affix on an item. `id` keys data/affixes.ts; `tier` is 1 (best) upward. */
export interface AffixRoll {
  id: string;
  tier: number;
  value: number;
}

/** A Fuse part (DESIGN §8.4, CONTENT §4). Tier I to III by the area level it dropped at. */
export interface FusePart {
  uid: number;
  /** Key into data/fuseParts.ts. */
  part: string;
  tier: 1 | 2 | 3;
}

/** A piece of equipment, spindles included. */
export interface Item {
  uid: number;
  /** Key into data/spindles.ts for spindles, else data/items.ts (cloak, hood, boots, charm bases). */
  base: string;
  rarity: ItemRarity;
  itemLevel: number;
  affixes: AffixRoll[];
  /** Spindles only: one entry per Fuse socket, the fused part or null. Empty for other slots. */
  fused: (FusePart | null)[];
  /** Rare items: the rolled name ("Cinder Shroud"), kept through rerolls. */
  name?: string;
  /** Unique items: the key into data/uniques.ts. Its fixed stats replace affixes. */
  unique?: string;
}

/** A Rift Sigil (DESIGN §10.4, M6): opens a rift of its tier with its modifiers at a Loom Stone. */
export interface RiftSigil {
  uid: number;
  /** 1–16. */
  tier: number;
  /** Prefixes first, then suffixes (data/rift.ts riftMods). */
  mods: RiftModId[];
}

export interface HeroState {
  /** Character level, from 1. */
  level: number;
  /** XP earned toward the next level (resets on level up). */
  xp: number;
  /** Rune ids the player has unlocked (a guaranteed drop or the new-game loadout), sorted. Random rune drops come only from these (CONTENT §9.1). */
  unlockedRunes: RuneId[];
  /** Every rune item owned, pouch and socketed, in acquisition order. */
  runes: RuneItem[];
  /** Every equipment item owned, inventory and equipped, in acquisition order. */
  items: Item[];
  /** Item uid in each slot, or null. A spindle is always equipped in adventure mode. */
  equipped: Record<EquipSlot, number | null>;
  /** Fuse parts not fused into a spindle. */
  parts: FusePart[];
  /** Allocated passive node ids (data/passives.ts), in allocation order. */
  passives: string[];
  heartSeeds: number;
  loomShards: number;
  threadScrap: number;
  /** Crafting currency stacks (DESIGN §8.5, data/currency.ts), by id; missing means 0. */
  currency: Partial<Record<CurrencyId, number>>;
  /** Extra passive points from bosses and side puzzles (DESIGN §9). */
  patternSeeds: number;
  /** Rift Sigils owned (M6). */
  sigils: RiftSigil[];
  /** Highest rift tier completed, 0 for none: sigils up to one tier above it can be opened (M6 tier ladder). */
  riftTier: number;
  /** The Hearth (M7, meta/types.ts): Embers, buildings, garden, expeditions, Rekindles, Ash, Mutations. */
  hearth: HearthState;
  /** Next uid for runes, items, parts, sigils and expeditions (one id space). */
  nextUid: number;
}
