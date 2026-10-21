/**
 * Unique items (CONTENT §8, M5): fixed stats and rules that bend how weaving or the world works.
 * A unique is an Item with rarity 'unique', `unique` naming its entry here, and no affixes; its
 * base gives the slot. Its stats and rules feed HeroMods like everything else (hero/uniques.ts).
 *
 * Rule numbers live here so they stay tunable. `text` is the tooltip, one line per effect.
 */
import type { StatId } from './affixes';
import type { GearBaseId } from './items';
import type { SpindleId } from './spindles';

export interface UniqueRules {
  /** Replaces the spindle base's Capacity (The First Thread: 6). */
  baseCapacity?: number;
  /** Branch runes cost 0 complexity (The First Thread). */
  branchRunesFree?: boolean;
  /** Deepest branch spell allowed, replacing the default 3 (First Thread 2, The Unraveling 4). */
  maxDepth?: number;
  /** Spell instances one cast may create, replacing the default 64 (The Unraveling: 96). */
  spawnCapPerCast?: number;
  /** Mana costs × (1 + this) (The Unraveling: 0.4). */
  manaMore?: number;
  /** Immune to Ignite (Kiln-Heart Cloak). */
  igniteImmune?: boolean;
  /** Standing on burning ground heals this fraction of max life per second (Kiln-Heart Cloak: 0.02). */
  burningGroundHeal?: number;
  /** Dodging leaves an ice trail (Rimewalkers). */
  dodgeIceTrail?: { width: number; seconds: number };
  /** Grants a keystone's effects (Stormglass Charm). Doesn't stack with the allocated keystone. */
  keystone?: string;
  /** Fire damage taken × (1 + this) (Pyre Hood: 0.1). */
  fireTakenMore?: number;
  /** Added levels for Fire runes (Pyre Hood: 1). */
  fireRuneLevels?: number;
}

export interface UniqueDef {
  id: string;
  name: string;
  base: SpindleId | GearBaseId;
  /** Lowest item level (area level) it drops at. */
  itemLevel: number;
  /** Relative chance against other uniques that can drop. */
  dropWeight: number;
  stats: { stat: StatId; value: number }[];
  rules: UniqueRules;
  /** Rule lines for tooltips (stat lines come from `stats`). */
  text: string[];
  /** Short flavor line. */
  flavor: string;
}

export const uniques = {
  the_first_thread: {
    id: 'the_first_thread',
    name: 'The First Thread',
    base: 'twig',
    itemLevel: 3,
    dropWeight: 100,
    stats: [],
    rules: { baseCapacity: 6, branchRunesFree: true, maxDepth: 2 },
    text: ['Capacity 6', 'Branch runes cost 0 complexity', 'Branches can nest at most 2 deep'],
    flavor: 'Every weave began as one strand.',
  },
  kiln_heart_cloak: {
    id: 'kiln_heart_cloak',
    name: 'Kiln-Heart Cloak',
    base: 'travelers_cloak',
    itemLevel: 6,
    dropWeight: 100,
    stats: [{ stat: 'life_flat', value: 30 }],
    rules: { igniteImmune: true, burningGroundHeal: 0.02 },
    text: ['Immune to Ignite', 'Standing on burning ground heals 2% of life per second'],
    flavor: 'Stitched from the lining of a cooling kiln.',
  },
  rimewalkers: {
    id: 'rimewalkers',
    name: 'Rimewalkers',
    base: 'leather_boots',
    itemLevel: 6,
    dropWeight: 100,
    stats: [],
    rules: { dodgeIceTrail: { width: 3, seconds: 4 } },
    text: ['Dodging leaves a 3-cell-wide ice trail for 4 s', 'Over deep water it makes ice bridge'],
    flavor: 'The river remembers where you stepped.',
  },
  stormglass_charm: {
    id: 'stormglass_charm',
    name: 'Stormglass Charm',
    base: 'bone_charm',
    itemLevel: 8,
    dropWeight: 80,
    stats: [],
    rules: { keystone: 'stormglass' },
    text: [
      'Grants Stormglass: ice and ice bridges conduct Storm like water',
      'Shocked and Frozen enemies take 40% more Storm damage',
    ],
    flavor: 'Lightning caught in a bead of ice.',
  },
  pyre_hood: {
    id: 'pyre_hood',
    name: 'Pyre Hood',
    base: 'wool_hood',
    itemLevel: 4,
    dropWeight: 100,
    stats: [{ stat: 'fire_spread', value: 30 }],
    rules: { fireRuneLevels: 1, fireTakenMore: 0.1 },
    text: ['+1 to Fire rune levels', 'You take 10% more Fire damage'],
    flavor: 'Its wearer smells of smoke for days.',
  },
  the_unraveling: {
    id: 'the_unraveling',
    name: 'The Unraveling',
    base: 'bone_charm',
    itemLevel: 8,
    dropWeight: 60,
    stats: [],
    rules: { maxDepth: 4, spawnCapPerCast: 96, manaMore: 0.4 },
    text: ['Branches can nest 4 deep', 'Spawn cap per cast is 96', 'Spells cost 40% more mana'],
    flavor: 'Pull one thread and the whole cloth follows.',
  },
} satisfies Record<string, UniqueDef>;

export type UniqueId = keyof typeof uniques;

export function isUniqueId(id: string): id is UniqueId {
  return Object.prototype.hasOwnProperty.call(uniques, id);
}
