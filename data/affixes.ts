/**
 * Item stats and affix pools (DESIGN §8.2, CONTENT §3). M4 ships Magic items: up to 1 prefix and
 * 1 suffix. Rare tiers and counts arrive in M5.
 *
 * Values are in display units: whole percent for "%" stats (12 = 12%), cells/s, seconds, points.
 * `statDefs[stat].scale` converts a value to its HeroMods unit (src/sim/hero/stats.ts maps each
 * stat to its HeroMods field). Tier 1 is the best tier; a tier rolls only on items whose item
 * level is at least its `itemLevel`. Values roll as whole numbers from min to max inclusive.
 * Affixes in the same `group` can't both roll on one item.
 */
import type { ItemKind } from './items';

export const statIds = [
  'fire_damage',
  'frost_damage',
  'storm_damage',
  'elemental_damage',
  'branch_damage',
  'strike_flat',
  'cast_speed',
  'crit_chance',
  'mana_cost',
  'terrain_duration',
  'capacity',
  'life_flat',
  'life_inc',
  'mana_flat',
  'mana_regen',
  'fire_resist',
  'frost_resist',
  'storm_resist',
  'ailment_duration',
  'chill_effect',
  'shock_effect',
  'ignite_effect',
  'chill_gain',
  'move_speed',
  'dodge_recharge',
  'fire_spread',
  'conduction_range',
  'rune_levels',
] as const;
export type StatId = (typeof statIds)[number];

export interface StatDef {
  /** Tooltip line; `{v}` is replaced by the value. */
  text: string;
  /** Multiplier from the display value to the HeroMods unit (0.01 for percent). */
  scale: number;
}

export const statDefs = {
  fire_damage: { text: '{v}% increased Fire damage', scale: 0.01 },
  frost_damage: { text: '{v}% increased Frost damage', scale: 0.01 },
  storm_damage: { text: '{v}% increased Storm damage', scale: 0.01 },
  elemental_damage: { text: '{v}% increased Elemental damage', scale: 0.01 },
  branch_damage: { text: '{v}% increased damage with branch spells', scale: 0.01 },
  strike_flat: { text: '+{v} to Strike base damage', scale: 1 },
  cast_speed: { text: '{v}% increased cast speed', scale: 0.01 },
  crit_chance: { text: '+{v}% to crit chance', scale: 0.01 },
  mana_cost: { text: '{v}% reduced mana cost', scale: 0.01 },
  terrain_duration: { text: '{v}% increased duration of terrain effects you create', scale: 0.01 },
  capacity: { text: '+{v} Capacity', scale: 1 },
  life_flat: { text: '+{v} to maximum life', scale: 1 },
  life_inc: { text: '{v}% increased maximum life', scale: 0.01 },
  mana_flat: { text: '+{v} to maximum mana', scale: 1 },
  mana_regen: { text: '+{v} mana regenerated per second', scale: 1 },
  fire_resist: { text: '+{v}% to Fire resistance', scale: 0.01 },
  frost_resist: { text: '+{v}% to Frost resistance', scale: 0.01 },
  storm_resist: { text: '+{v}% to Storm resistance', scale: 0.01 },
  ailment_duration: { text: '{v}% increased duration of ailments you inflict', scale: 0.01 },
  chill_effect: { text: '{v}% increased effect of Chill', scale: 0.01 },
  shock_effect: { text: '{v}% increased effect of Shock', scale: 0.01 },
  ignite_effect: { text: '{v}% increased effect of Ignite', scale: 0.01 },
  chill_gain: { text: '{v}% increased chill build-up', scale: 0.01 },
  move_speed: { text: '{v}% increased move speed', scale: 0.01 },
  dodge_recharge: { text: '{v}% faster dodge recharge', scale: 0.01 },
  fire_spread: { text: '{v}% increased spread chance for fire you create', scale: 0.01 },
  conduction_range: { text: '{v}% increased conduction range', scale: 0.01 },
  rune_levels: { text: '+{v} to all rune levels', scale: 1 },
} satisfies Record<StatId, StatDef>;

export interface AffixTier {
  /** 1 is the best. */
  tier: number;
  /** Lowest item level this tier rolls on. */
  itemLevel: number;
  min: number;
  max: number;
}

export interface AffixDef {
  id: string;
  kind: 'prefix' | 'suffix';
  /** Affixes sharing a group can't both roll on one item. */
  group: string;
  stat: StatId;
  /** Item kinds whose pool holds it. */
  kinds: readonly ItemKind[];
  /** Relative chance against the other affixes that can roll (100 is normal). */
  weight: number;
  /** Best first. */
  tiers: readonly AffixTier[];
}

/**
 * Rift tiers (M6.5): item levels and multipliers on the region's best range for the tiers above
 * it, so gear keeps improving up to rift area level 30 and past it with Rekindles.
 */
export const riftAffixTiers: readonly { itemLevel: number; mult: number }[] = [
  { itemLevel: 16, mult: 1.4 },
  { itemLevel: 24, mult: 1.85 },
  { itemLevel: 32, mult: 2.35 },
];

/** Tiers added above the region's best (rounded, each range above the one below it). */
function riftTiers(best: [number, number]): [number, number][] {
  const out: [number, number][] = [];
  let prevMax = best[1];
  for (const t of riftAffixTiers) {
    const min = Math.max(prevMax + 1, Math.round(best[0] * t.mult));
    const max = Math.max(min, Math.round(best[1] * t.mult));
    out.push([min, max]);
    prevMax = max;
  }
  return out;
}

/**
 * Six tiers: the region's three at item levels 1, `mid` and `top` (T6, T5, T4), then the rift
 * tiers at item levels 16, 24 and 32 (T3, T2, T1; riftAffixTiers).
 */
function tiers3(
  t3: [number, number],
  t2: [number, number],
  t1: [number, number],
  mid = 5,
  top = 9,
): AffixTier[] {
  const rift = riftTiers(t1);
  return [
    ...rift
      .map((r, i) => ({ itemLevel: riftAffixTiers[i]!.itemLevel, min: r[0], max: r[1] }))
      .reverse()
      .map((t, i) => ({ tier: i + 1, ...t })),
    { tier: 4, itemLevel: top, min: t1[0], max: t1[1] },
    { tier: 5, itemLevel: mid, min: t2[0], max: t2[1] },
    { tier: 6, itemLevel: 1, min: t3[0], max: t3[1] },
  ];
}

/** Tiers added above the region's three in M6.5: a save from before then adds this to every tier. */
export const RIFT_TIER_SHIFT = riftAffixTiers.length;

const RESIST_KINDS: readonly ItemKind[] = ['cloak', 'hood', 'boots', 'charm'];

function resist(stat: 'fire_resist' | 'frost_resist' | 'storm_resist'): Omit<AffixDef, 'id'> {
  return {
    kind: 'suffix',
    group: stat,
    stat,
    kinds: RESIST_KINDS,
    weight: 100,
    tiers: tiers3([6, 10], [11, 16], [17, 22], 4, 8),
  };
}

export const affixes = {
  // ---- Spindle prefixes ----
  fire_damage: {
    id: 'fire_damage',
    kind: 'prefix',
    group: 'fire_damage',
    stat: 'fire_damage',
    kinds: ['spindle'],
    weight: 100,
    tiers: tiers3([6, 10], [11, 16], [17, 22]),
  },
  frost_damage: {
    id: 'frost_damage',
    kind: 'prefix',
    group: 'frost_damage',
    stat: 'frost_damage',
    kinds: ['spindle'],
    weight: 100,
    tiers: tiers3([6, 10], [11, 16], [17, 22]),
  },
  storm_damage: {
    id: 'storm_damage',
    kind: 'prefix',
    group: 'storm_damage',
    stat: 'storm_damage',
    kinds: ['spindle'],
    weight: 100,
    tiers: tiers3([6, 10], [11, 16], [17, 22]),
  },
  branch_damage: {
    id: 'branch_damage',
    kind: 'prefix',
    group: 'branch_damage',
    stat: 'branch_damage',
    kinds: ['spindle'],
    weight: 100,
    tiers: tiers3([8, 12], [13, 18], [19, 25]),
  },
  strike_flat: {
    id: 'strike_flat',
    kind: 'prefix',
    group: 'strike_flat',
    stat: 'strike_flat',
    kinds: ['spindle'],
    weight: 100,
    tiers: tiers3([2, 4], [5, 8], [9, 12]),
  },
  // ---- Spindle suffixes ----
  cast_speed: {
    id: 'cast_speed',
    kind: 'suffix',
    group: 'cast_speed',
    stat: 'cast_speed',
    kinds: ['spindle'],
    weight: 100,
    tiers: tiers3([4, 6], [7, 9], [10, 12]),
  },
  crit_chance: {
    id: 'crit_chance',
    kind: 'suffix',
    group: 'crit_chance',
    stat: 'crit_chance',
    kinds: ['spindle'],
    weight: 100,
    tiers: tiers3([1, 1], [2, 2], [3, 3]),
  },
  mana_cost: {
    id: 'mana_cost',
    kind: 'suffix',
    group: 'mana_cost',
    stat: 'mana_cost',
    kinds: ['spindle'],
    weight: 100,
    tiers: tiers3([4, 6], [7, 9], [10, 12]),
  },
  terrain_duration: {
    id: 'terrain_duration',
    kind: 'suffix',
    group: 'terrain_duration',
    stat: 'terrain_duration',
    kinds: ['spindle'],
    weight: 100,
    tiers: tiers3([8, 12], [13, 18], [19, 25]),
  },
  /** CONTENT §3: item level 15+, rare weight. Can't roll in M4 (area levels stop at 10). */
  capacity: {
    id: 'capacity',
    kind: 'suffix',
    group: 'capacity',
    stat: 'capacity',
    kinds: ['spindle'],
    weight: 10,
    tiers: [{ tier: 1, itemLevel: 15, min: 1, max: 1 }],
  },
  // ---- Cloak ----
  life_flat: {
    id: 'life_flat',
    kind: 'prefix',
    group: 'life_flat',
    stat: 'life_flat',
    kinds: ['cloak', 'charm'],
    weight: 100,
    tiers: tiers3([6, 10], [11, 16], [17, 24], 4, 8),
  },
  life_inc: {
    id: 'life_inc',
    kind: 'prefix',
    group: 'life_inc',
    stat: 'life_inc',
    kinds: ['cloak', 'hood', 'boots'],
    weight: 100,
    tiers: tiers3([3, 5], [6, 8], [9, 12]),
  },
  fire_resist: { id: 'fire_resist', ...resist('fire_resist') },
  frost_resist: { id: 'frost_resist', ...resist('frost_resist') },
  storm_resist: { id: 'storm_resist', ...resist('storm_resist') },
  mana_regen: {
    id: 'mana_regen',
    kind: 'suffix',
    group: 'mana_regen',
    stat: 'mana_regen',
    kinds: ['cloak'],
    weight: 100,
    tiers: tiers3([1, 1], [2, 2], [3, 3]),
  },
  // ---- Hood ----
  mana_flat: {
    id: 'mana_flat',
    kind: 'prefix',
    group: 'mana_flat',
    stat: 'mana_flat',
    kinds: ['hood'],
    weight: 100,
    tiers: tiers3([5, 8], [9, 13], [14, 18]),
  },
  ailment_duration: {
    id: 'ailment_duration',
    kind: 'prefix',
    group: 'ailment_duration',
    stat: 'ailment_duration',
    kinds: ['hood'],
    weight: 100,
    tiers: tiers3([5, 8], [9, 12], [13, 16]),
  },
  chill_effect: {
    id: 'chill_effect',
    kind: 'suffix',
    group: 'chill_effect',
    stat: 'chill_effect',
    kinds: ['hood'],
    weight: 100,
    tiers: tiers3([6, 10], [11, 15], [16, 20]),
  },
  shock_effect: {
    id: 'shock_effect',
    kind: 'suffix',
    group: 'shock_effect',
    stat: 'shock_effect',
    kinds: ['hood'],
    weight: 100,
    tiers: tiers3([6, 10], [11, 15], [16, 20]),
  },
  ignite_effect: {
    id: 'ignite_effect',
    kind: 'suffix',
    group: 'ignite_effect',
    stat: 'ignite_effect',
    kinds: ['hood'],
    weight: 100,
    tiers: tiers3([6, 10], [11, 15], [16, 20]),
  },
  // ---- Boots ----
  move_speed: {
    id: 'move_speed',
    kind: 'prefix',
    group: 'move_speed',
    stat: 'move_speed',
    kinds: ['boots'],
    weight: 100,
    tiers: tiers3([4, 6], [7, 9], [10, 12]),
  },
  dodge_recharge: {
    id: 'dodge_recharge',
    kind: 'suffix',
    group: 'dodge_recharge',
    stat: 'dodge_recharge',
    kinds: ['boots'],
    weight: 100,
    tiers: tiers3([5, 8], [9, 12], [13, 16]),
  },
  // ---- Charm ----
  elemental_damage: {
    id: 'elemental_damage',
    kind: 'prefix',
    group: 'elemental_damage',
    stat: 'elemental_damage',
    kinds: ['charm'],
    weight: 100,
    tiers: tiers3([4, 7], [8, 11], [12, 15]),
  },
  fire_spread: {
    id: 'fire_spread',
    kind: 'suffix',
    group: 'fire_spread',
    stat: 'fire_spread',
    kinds: ['charm'],
    weight: 100,
    tiers: tiers3([8, 12], [13, 18], [19, 25]),
  },
  conduction_range: {
    id: 'conduction_range',
    kind: 'suffix',
    group: 'conduction_range',
    stat: 'conduction_range',
    kinds: ['charm'],
    weight: 100,
    tiers: tiers3([8, 12], [13, 18], [19, 25]),
  },
} satisfies Record<string, AffixDef>;

export type AffixId = keyof typeof affixes;

export function isAffixId(id: string): id is AffixId {
  return Object.prototype.hasOwnProperty.call(affixes, id);
}

/** Affix counts by rarity (DESIGN §8.2). Magic: up to 1 prefix and 1 suffix, at least one affix. */
export const affixCounts = {
  normal: { prefixes: 0, suffixes: 0 },
  magic: { prefixes: 1, suffixes: 1 },
  rare: { prefixes: 3, suffixes: 3 },
} as const;

/** Chance a Magic item rolls both a prefix and a suffix; otherwise one of them, evenly. */
export const magicBothChance = 0.5;

/** Magic item names: "<prefix> <base> <suffix>", e.g. "Smoldering Ashwood Spindle of Haste". */
export const affixNames: Record<AffixId, string> = {
  fire_damage: 'Smoldering',
  frost_damage: 'Wintry',
  storm_damage: 'Crackling',
  branch_damage: 'Branching',
  strike_flat: 'Knotted',
  cast_speed: 'of Haste',
  crit_chance: 'of Precision',
  mana_cost: 'of Thrift',
  terrain_duration: 'of Lingering',
  capacity: 'of the Loom',
  life_flat: 'Hale',
  life_inc: 'Stalwart',
  fire_resist: 'of the Kiln',
  frost_resist: 'of the Thaw',
  storm_resist: 'of Grounding',
  mana_regen: 'of Wellsprings',
  mana_flat: 'Lucid',
  ailment_duration: 'Festering',
  chill_effect: 'of Rime',
  shock_effect: 'of Static',
  ignite_effect: 'of Embers',
  move_speed: 'Fleet',
  dodge_recharge: 'of Evasion',
  elemental_damage: 'Primal',
  fire_spread: 'of Wildfire',
  conduction_range: 'of Conduction',
};
