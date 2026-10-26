/**
 * Fuse parts (DESIGN §8.4, CONTENT §4). Monsters drop them; fusing one into a spindle socket adds
 * its effect. Tier II and III multiply numeric values by 1.5 and 2 (`partValue`). Parts without
 * a number gain 10% / 20% increased damage of their element at higher tiers (`partElementBonus`).
 *
 * The passive/effects agent applies the effects (HeroMods `parts`, `effects` and the numeric
 * fields named in `values`); the hero/items agent drops, fuses and describes them.
 */
import type { ElementId } from './runes';

export interface PartValueDef {
  /** Tier I value, in the HeroMods unit (fractions for percentages, seconds, counts). */
  base: number;
  /** How the tooltip shows it: 'pct' 0.4 → "40%", 'sec' 0.5 → "0.5 s", 'int' 2 → "2". */
  format: 'pct' | 'sec' | 'int';
}

export interface FusePartDef {
  id: string;
  name: string;
  /** Enemy kind (data/enemies.ts) that drops it. */
  dropsFrom: string;
  /** Tooltip text; `{key}` is replaced by the tier-scaled value of `values[key]`. */
  text: string;
  /** Numeric values, scaled by tier. Empty for rule-only parts. */
  values: Readonly<Record<string, PartValueDef>>;
  /** Rule-only parts: the element whose damage tiers II and III increase. */
  element?: ElementId;
}

export const fuseParts = {
  tinder_tooth: {
    id: 'tinder_tooth',
    name: 'Tinder Tooth',
    dropsFrom: 'tinderling',
    text: 'The first Fire rune in each weave costs 0 complexity',
    values: {},
    element: 'fire',
  },
  bog_gill: {
    id: 'bog_gill',
    name: 'Bog Gill',
    dropsFrom: 'bog_lurker',
    text: 'Storm arcs between Wet enemies reach {range} farther and hit {targets} more targets',
    values: { range: { base: 0.5, format: 'pct' }, targets: { base: 2, format: 'int' } },
  },
  tar_gland: {
    id: 'tar_gland',
    name: 'Tar Gland',
    dropsFrom: 'tar_hulk',
    text: 'Your Fire hits leave a 2-cell oil patch, which they then ignite',
    values: {},
    element: 'fire',
  },
  rime_mote: {
    id: 'rime_mote',
    name: 'Rime Mote',
    dropsFrom: 'frost_wisp',
    text: 'Freeze lasts {freeze} longer',
    values: { freeze: { base: 0.4, format: 'pct' } },
  },
  shield_plate: {
    id: 'shield_plate',
    name: 'Shield Plate',
    dropsFrom: 'shieldbearer',
    text: 'Take {less} less damage from projectiles',
    values: { less: { base: 0.2, format: 'pct' } },
  },
  storm_antler: {
    id: 'storm_antler',
    name: 'Storm Antler',
    dropsFrom: 'stormcaller',
    text: 'Charge you create on water and metal lasts {seconds} longer',
    values: { seconds: { base: 0.5, format: 'sec' } },
  },
  ember_feather: {
    id: 'ember_feather',
    name: 'Ember Feather',
    dropsFrom: 'ember_archer',
    text: 'Bolt and Lob projectiles are {speed} faster',
    values: { speed: { base: 0.25, format: 'pct' } },
  },
  kiln_chitin: {
    id: 'kiln_chitin',
    name: 'Kiln Chitin',
    dropsFrom: 'kiln_mite',
    text: 'Dodge recharges {faster} faster',
    values: { faster: { base: 0.15, format: 'pct' } },
  },
  matriarchs_sac: {
    id: 'matriarchs_sac',
    name: "Matriarch's Sac",
    dropsFrom: 'tar_matriarch',
    text: 'Your hits apply Oiled for {seconds}',
    values: { seconds: { base: 2, format: 'sec' } },
  },
  cinder_heart: {
    id: 'cinder_heart',
    name: 'Cinder Heart',
    dropsFrom: 'cinder_warden',
    text: 'Grants `Harvest > Nova[Fire]` as an extra weave that uses no slot and no Capacity',
    values: {},
    element: 'fire',
  },
  // M8: the Glasswater Fen's parts.
  pike_scale: {
    id: 'pike_scale',
    name: 'Pike Scale',
    dropsFrom: 'glasspike',
    text: "You aren't slowed by shallow water or mud",
    values: {},
    element: 'storm',
  },
  copper_carapace: {
    id: 'copper_carapace',
    name: 'Copper Carapace',
    dropsFrom: 'copperback',
    text: 'Take {less} less damage from charged water and metal',
    values: { less: { base: 0.3, format: 'pct' } },
  },
  heron_plume: {
    id: 'heron_plume',
    name: 'Heron Plume',
    dropsFrom: 'spark_heron',
    text: '{more} more damage with charge you create',
    values: { more: { base: 0.25, format: 'pct' } },
  },
  slag_core: {
    id: 'slag_core',
    name: 'Slag Core',
    dropsFrom: 'slagshell',
    text: 'Your Fire hits on Wet enemies deal {more} more damage',
    values: { more: { base: 0.3, format: 'pct' } },
  },
  sparkfly_lantern: {
    id: 'sparkfly_lantern',
    name: 'Sparkfly Lantern',
    dropsFrom: 'sparkfly',
    text: 'Enemies you kill while they stand in water release your charge into it ({share} of the killing hit)',
    values: { share: { base: 0.5, format: 'pct' } },
  },
  mire_horn: {
    id: 'mire_horn',
    name: 'Mire Horn',
    dropsFrom: 'mire_bull',
    text: 'Enemies on mud or in shallow water take {more} more damage from you',
    values: { more: { base: 0.15, format: 'pct' } },
  },
  toad_bellows: {
    id: 'toad_bellows',
    name: 'Toad Bellows',
    dropsFrom: 'bellows_toad',
    text: 'Your gusts last {seconds} longer and cover {area} more area',
    values: { seconds: { base: 1, format: 'sec' }, area: { base: 0.3, format: 'pct' } },
  },
  bell_bronze: {
    id: 'bell_bronze',
    name: 'Bell Bronze',
    dropsFrom: 'bellshell',
    text: 'Shocked enemies take {more} more Physical damage (Tide and Gale hits)',
    values: { more: { base: 0.15, format: 'pct' } },
  },
  // M8: the Drowned Foundry's bosses (always drop their part, data/loot.ts bossPartChance).
  bellwethers_clapper: {
    id: 'bellwethers_clapper',
    name: "Bellwether's Clapper",
    dropsFrom: 'bellwether',
    text: 'Charge you create reaches {reach} farther (water distance and both cell caps)',
    values: { reach: { base: 0.3, format: 'pct' } },
  },
  coil_dynamo: {
    id: 'coil_dynamo',
    name: 'Coil Dynamo',
    dropsFrom: 'glasswater_coil',
    text: 'When charge you created on water or metal ends, it pulses once more for {share} of its damage (each entity can be hit again)',
    values: { share: { base: 0.5, format: 'pct' } },
  },
} satisfies Record<string, FusePartDef>;

export type FusePartId = keyof typeof fuseParts;

export function isFusePartId(id: string): id is FusePartId {
  return Object.prototype.hasOwnProperty.call(fuseParts, id);
}

/** Tier multipliers for numeric values: I, II, III. */
export const partTierMult = [1, 1.5, 2] as const;

/** Increased damage of its element that a rule-only part adds at each tier: I, II, III. */
export const partElementInc = [0, 0.1, 0.2] as const;

/** A part's numeric value at a tier (base × 1, 1.5 or 2). 0 if the part has no such value. */
export function partValue(part: string, key: string, tier: 1 | 2 | 3): number {
  const def: FusePartDef | undefined = isFusePartId(part) ? fuseParts[part] : undefined;
  const v = def?.values[key];
  return v ? v.base * partTierMult[tier - 1]! : 0;
}

/** Increased damage of the part's element at a tier (rule-only parts), else 0. */
export function partElementBonus(part: string, tier: 1 | 2 | 3): { element: ElementId; inc: number } | null {
  const def: FusePartDef | undefined = isFusePartId(part) ? fuseParts[part] : undefined;
  if (!def?.element) return null;
  return { element: def.element, inc: partElementInc[tier - 1]! };
}

/** The part each enemy kind drops, if any. */
export function partDroppedBy(kind: string): FusePartId | null {
  for (const id of Object.keys(fuseParts) as FusePartId[]) if (fuseParts[id].dropsFrom === kind) return id;
  return null;
}
