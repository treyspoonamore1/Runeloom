/**
 * Item stats (data/affixes.ts) into HeroMods fields. One function per stat; values arrive in
 * display units and are scaled by statDefs[stat].scale.
 */
import { statDefs, type StatId } from '../../../data/affixes';
import type { SpindleImplicit } from '../../../data/spindles';
import type { HeroMods } from './mods';

type Apply = (m: HeroMods, v: number) => void;

const apply: Record<StatId, Apply> = {
  fire_damage: (m, v) => (m.damageInc.fire += v),
  frost_damage: (m, v) => (m.damageInc.frost += v),
  storm_damage: (m, v) => (m.damageInc.storm += v),
  elemental_damage: (m, v) => {
    m.damageInc.fire += v;
    m.damageInc.frost += v;
    m.damageInc.storm += v;
  },
  branch_damage: (m, v) => (m.branchDamageInc += v),
  strike_flat: (m, v) => (m.strikeFlatAdd += v),
  cast_speed: (m, v) => (m.castSpeedInc += v),
  crit_chance: (m, v) => (m.critChanceAdd += v),
  mana_cost: (m, v) => (m.manaCostReduced += v),
  terrain_duration: (m, v) => (m.terrainDurationInc += v),
  capacity: (m, v) => (m.capacityAdd += v),
  life_flat: (m, v) => (m.maxLifeAdd += v),
  life_inc: (m, v) => (m.maxLifeInc += v),
  mana_flat: (m, v) => (m.maxManaAdd += v),
  mana_regen: (m, v) => (m.manaRegenAdd += v),
  fire_resist: (m, v) => (m.resistAdd.fire += v),
  frost_resist: (m, v) => (m.resistAdd.frost += v),
  storm_resist: (m, v) => (m.resistAdd.storm += v),
  ailment_duration: (m, v) => (m.ailmentDurationInc += v),
  chill_effect: (m, v) => (m.chillEffectInc += v),
  shock_effect: (m, v) => (m.shockEffectInc += v),
  ignite_effect: (m, v) => (m.igniteEffectInc += v),
  chill_gain: (m, v) => (m.chillGainInc += v),
  move_speed: (m, v) => (m.moveSpeedInc += v),
  dodge_recharge: (m, v) => (m.dodgeRechargeInc += v),
  fire_spread: (m, v) => (m.fireSpreadInc += v),
  conduction_range: (m, v) => (m.conductionRangeInc += v),
  rune_levels: (m, v) => (m.runeLevelAdd.all += v),
};

/** Adds one stat, given in display units (12 for 12%), to `mods`. */
export function addStat(mods: HeroMods, stat: StatId, value: number): void {
  apply[stat](mods, value * statDefs[stat].scale);
}

/** A spindle implicit (data/spindles.ts) as stats in display units, for HeroMods and tooltips. */
export function implicitStats(imp: SpindleImplicit): { stat: StatId; value: number }[] {
  const out: { stat: StatId; value: number }[] = [];
  if (imp.increased) {
    const inc = imp.increased;
    if (inc.fire) out.push({ stat: 'fire_damage', value: Math.round(inc.fire * 100) });
    if (inc.frost) out.push({ stat: 'frost_damage', value: Math.round(inc.frost * 100) });
    if (inc.storm) out.push({ stat: 'storm_damage', value: Math.round(inc.storm * 100) });
  }
  if (imp.chillGain) out.push({ stat: 'chill_gain', value: Math.round(imp.chillGain * 100) });
  if (imp.strikeFlat) out.push({ stat: 'strike_flat', value: imp.strikeFlat });
  if (imp.runeLevels) out.push({ stat: 'rune_levels', value: imp.runeLevels });
  return out;
}

/** Tooltip line for a stat value. */
export function statLine(stat: StatId, value: number): string {
  return statDefs[stat].text.replace('{v}', String(value));
}
