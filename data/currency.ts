/**
 * Crafting currencies (DESIGN §8.5, M5). Thread Scrap stays its own counter (HeroState.threadScrap,
 * used since M4); the seven crafting currencies here are stacks in HeroState.currency.
 *
 * Every currency is applied to one target from the crafting bench (src/sim/items/craft.ts) and
 * rolls with GameState.craftRng, so crafting never shifts drop or combat rolls.
 */

export const currencyIds = [
  'weavers_knot',
  'spool_of_change',
  'loom_shuttle',
  'chaos_skein',
  'golden_needle',
  'unpick',
  'rune_polish',
] as const;
export type CurrencyId = (typeof currencyIds)[number];

export interface CurrencyDef {
  id: CurrencyId;
  name: string;
  /** What it does, for the bench and tooltips. */
  text: string;
  /** What it can be used on. */
  target: 'item' | 'rune';
  /** Relative chance against the other currencies when a currency drops. */
  dropWeight: number;
}

export const currencies = {
  weavers_knot: {
    id: 'weavers_knot',
    name: "Weaver's Knot",
    text: 'Turns a Normal item into a Magic item',
    target: 'item',
    dropWeight: 100,
  },
  spool_of_change: {
    id: 'spool_of_change',
    name: 'Spool of Change',
    text: "Rerolls a Magic item's affixes",
    target: 'item',
    dropWeight: 90,
  },
  loom_shuttle: {
    id: 'loom_shuttle',
    name: 'Loom Shuttle',
    text: 'Turns a Normal item into a Rare item',
    target: 'item',
    dropWeight: 40,
  },
  chaos_skein: {
    id: 'chaos_skein',
    name: 'Chaos Skein',
    text: "Rerolls a Rare item's affixes",
    target: 'item',
    dropWeight: 25,
  },
  golden_needle: {
    id: 'golden_needle',
    name: 'Golden Needle',
    text: 'Adds one random affix to a Rare item',
    target: 'item',
    dropWeight: 6,
  },
  unpick: {
    id: 'unpick',
    name: 'Unpick',
    text: 'Removes one random affix from a Magic or Rare item',
    target: 'item',
    dropWeight: 20,
  },
  rune_polish: {
    id: 'rune_polish',
    name: 'Rune Polish',
    text: '+1% quality to a rune (up to 20%)',
    target: 'rune',
    dropWeight: 35,
  },
} satisfies Record<CurrencyId, CurrencyDef>;

export function isCurrencyId(id: string): id is CurrencyId {
  return (currencyIds as readonly string[]).includes(id);
}

/** Highest rune quality, in % (DESIGN §5.1). */
export const maxRuneQuality = 20;

/**
 * How many affixes a new Rare item rolls (a Loom Shuttle, a Chaos Skein, a Rare drop), with
 * relative weights. Capped by the 3 prefix and 3 suffix slots and by the kind's pool.
 */
export const rareAffixCount = [
  { count: 4, weight: 55 },
  { count: 5, weight: 30 },
  { count: 6, weight: 15 },
] as const;

/**
 * Rare names: "<first> <second>", one word from each list, rolled when the item becomes Rare and
 * kept through rerolls. The second word depends on the item kind.
 */
export const rareNameWords = {
  first: [
    'Ash',
    'Cinder',
    'Ember',
    'Rime',
    'Storm',
    'Hollow',
    'Bramble',
    'Kiln',
    'Thorn',
    'Gloam',
    'Tallow',
    'Moth',
    'Brine',
    'Soot',
    'Wraith',
    'Dusk',
  ],
  second: {
    spindle: ['Loom', 'Spire', 'Shuttle', 'Distaff', 'Reel', 'Bobbin', 'Needle', 'Weft'],
    cloak: ['Mantle', 'Shroud', 'Wrap', 'Veil', 'Pall', 'Cape'],
    hood: ['Cowl', 'Crown', 'Hood', 'Visage', 'Brow', 'Veil'],
    boots: ['Tread', 'Stride', 'March', 'Step', 'Track', 'Trail'],
    charm: ['Knot', 'Token', 'Talisman', 'Trinket', 'Bead', 'Sigil'],
  },
} as const;
