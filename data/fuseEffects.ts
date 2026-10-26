/**
 * What each Fuse part does once fused into the equipped spindle (CONTENT §4), keyed by part id
 * (the same ids as data/fuseParts.ts, which holds drops and names). Read by the aggregation in
 * src/sim/hero/passives.ts; the systems apply the resulting HeroMods.
 *
 * Tiers (CONTENT §4): tier II and III multiply every number by 1.5 and 2. Parts without a
 * number (`numeric: false`) instead gain 10% / 20% increased damage of their `element`.
 */
import type { EffectKey, StatLine } from './passiveStats';
import { statInfo, pct } from './passiveStats';

export interface FuseEffectDef {
  /** Player-facing name (for tooltips when data/fuseParts.ts isn't at hand). */
  name: string;
  stats: readonly StatLine[];
  effects: Readonly<Partial<Record<EffectKey, number>>>;
  /** Extra weaves granted, using no slot and no Capacity (Cinder Heart). */
  extraWeaves: readonly string[];
  /** False: no number to scale; higher tiers add increased damage of `element` instead. */
  numeric: boolean;
  element: 'fire' | 'frost' | 'storm' | null;
  /** Tooltip text at tier I, `{n}` placeholders replaced by the tier-scaled effect values in order. */
  text: string;
}

/** Number multiplier per tier (index tier − 1). */
export const fuseTierMult = [1, 1.5, 2] as const;
/** Increased damage of the part's element per tier for parts without a number. */
export const fuseTierDamageInc = [0, 0.1, 0.2] as const;

const none = { stats: [], effects: {}, extraWeaves: [] };

export const fuseEffects = {
  tinder_tooth: {
    ...none,
    name: 'Tinder Tooth',
    effects: { tinder_tooth: 1 },
    numeric: false,
    element: 'fire',
    text: 'The first Fire rune in each weave costs 0 complexity',
  },
  bog_gill: {
    ...none,
    name: 'Bog Gill',
    effects: { arc_range_inc: 0.5, arc_targets_add: 2 },
    numeric: true,
    element: 'storm',
    text: 'Storm arcs between Wet enemies reach {pct}% farther and hit {n} more targets',
  },
  tar_gland: {
    ...none,
    name: 'Tar Gland',
    effects: { tar_gland: 2 },
    numeric: true,
    element: 'fire',
    text: 'Your Fire hits leave a {n}-cell oil patch, which they then ignite',
  },
  rime_mote: {
    ...none,
    name: 'Rime Mote',
    stats: [{ stat: 'freezeDurationInc', value: 0.4 }],
    numeric: true,
    element: 'frost',
    text: '',
  },
  shield_plate: {
    ...none,
    name: 'Shield Plate',
    stats: [{ stat: 'projectileDamageTakenLess', value: 0.2 }],
    numeric: true,
    element: null,
    text: '',
  },
  storm_antler: {
    ...none,
    name: 'Storm Antler',
    stats: [{ stat: 'chargeDurationAdd', value: 0.5 }],
    numeric: true,
    element: 'storm',
    text: '',
  },
  ember_feather: {
    ...none,
    name: 'Ember Feather',
    effects: { projectile_speed_inc: 0.25 },
    numeric: true,
    element: 'fire',
    text: 'Bolt and Lob projectiles are {pct}% faster',
  },
  kiln_chitin: {
    ...none,
    name: 'Kiln Chitin',
    stats: [{ stat: 'dodgeRechargeInc', value: 0.15 }],
    numeric: true,
    element: null,
    text: '',
  },
  matriarchs_sac: {
    ...none,
    name: "Matriarch's Sac",
    effects: { oiled_on_hit: 2 },
    numeric: true,
    element: 'fire',
    text: 'Your hits apply Oiled for {n} s',
  },
  cinder_heart: {
    ...none,
    name: 'Cinder Heart',
    extraWeaves: ['Harvest > Nova[Fire]'],
    numeric: false,
    element: 'fire',
    text: 'Grants Harvest > Nova[Fire] as an extra weave that uses no slot and no Capacity',
  },
  // M8: the Glasswater Fen's parts (src/sim/hero/effectsFen.ts).
  pike_scale: {
    ...none,
    name: 'Pike Scale',
    effects: { pike_scale: 1 },
    numeric: false,
    element: 'storm',
    text: "You aren't slowed by shallow water or mud",
  },
  copper_carapace: {
    ...none,
    name: 'Copper Carapace',
    effects: { charge_taken_less: 0.3 },
    numeric: true,
    element: 'storm',
    text: 'Take {pct}% less damage from charged water and metal',
  },
  heron_plume: {
    ...none,
    name: 'Heron Plume',
    effects: { charge_damage_more: 0.25 },
    numeric: true,
    element: 'storm',
    text: '{pct}% more damage with charge you create',
  },
  slag_core: {
    ...none,
    name: 'Slag Core',
    effects: { wet_fire_more: 0.3 },
    numeric: true,
    element: 'fire',
    text: 'Your Fire hits on Wet enemies deal {pct}% more damage',
  },
  sparkfly_lantern: {
    ...none,
    name: 'Sparkfly Lantern',
    effects: { kill_charge: 0.5 },
    numeric: true,
    element: 'storm',
    text: 'Enemies you kill while they stand in water release your charge into it ({pct}% of the killing hit)',
  },
  mire_horn: {
    ...none,
    name: 'Mire Horn',
    effects: { mire_more: 0.15 },
    numeric: true,
    element: null,
    text: 'Enemies on mud or in shallow water take {pct}% more damage from you',
  },
  toad_bellows: {
    ...none,
    name: 'Toad Bellows',
    effects: { gust_seconds_add: 1, gust_area_inc: 0.3 },
    numeric: true,
    element: null,
    text: 'Your gusts last {n} s longer and cover {pct}% more area',
  },
  bell_bronze: {
    ...none,
    name: 'Bell Bronze',
    effects: { shocked_physical_more: 0.15 },
    numeric: true,
    element: 'storm',
    text: 'Shocked enemies take {pct}% more Physical damage from you',
  },
} as const satisfies Record<string, FuseEffectDef>;

/** Pike Scale (M8): the grounds whose slow it removes. */
export const pikeScaleGrounds = ['shallow_water', 'mud'] as const;

export type FusePartId = keyof typeof fuseEffects;

export function isFusePartId(id: string): id is FusePartId {
  return Object.prototype.hasOwnProperty.call(fuseEffects, id);
}

/** Tooltip lines for a part at a tier (1–3). Unknown parts get none. */
export function fuseEffectLines(part: string, tier: 1 | 2 | 3): string[] {
  if (!isFusePartId(part)) return [];
  const def: FuseEffectDef = fuseEffects[part];
  const k = def.numeric ? fuseTierMult[tier - 1] : 1;
  const lines: string[] = def.stats.map((l) => statInfo[l.stat].text(l.value * k));
  if (def.text !== '') {
    const values = Object.values(def.effects).map((v) => (v ?? 0) * k);
    let i = 0;
    lines.push(
      def.text.replace(/\{(n|pct)\}/g, (_m, kind: string) => {
        const v = values[i++] ?? 0;
        return kind === 'pct' ? pct(v) : String(v);
      }),
    );
  }
  const inc = def.numeric || def.element === null ? 0 : fuseTierDamageInc[tier - 1];
  if (inc > 0 && def.element !== null) lines.push(statInfo[`damageInc.${def.element}`].text(inc));
  return lines;
}
