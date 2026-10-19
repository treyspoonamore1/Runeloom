/**
 * The stat lines passive nodes and Fuse parts carry (DESIGN §9, CONTENT §4 and §7), shared by
 * data/passives.ts and data/fuseEffects.ts.
 *
 * - `StatKey` names a numeric HeroMods field (src/sim/hero/mods.ts); `damageInc.elemental` adds
 *   to fire, frost and storm, `resistAdd.elemental` likewise, and `ailmentEffectInc` adds to the
 *   ignite, chill and shock effect fields. Values are in the field's own unit (fractions for %).
 * - `EffectKey` names a rule in `HeroMods.effects`; the systems that apply each one document it
 *   (src/sim/hero/effects*.ts and the hooks they list). Values from several sources add up.
 */
import type { DamageType } from './combatTypes';

export type StatKey =
  | `damageInc.${DamageType | 'elemental'}`
  | `resistAdd.${DamageType | 'elemental'}`
  | 'maxLifeAdd'
  | 'maxManaAdd'
  | 'manaRegenAdd'
  | 'castSpeedInc'
  | 'critChanceAdd'
  | 'manaCostReduced'
  | 'capacityAdd'
  | 'branchDamageInc'
  | 'moveSpeedInc'
  | 'dodgeRechargeInc'
  | 'dodgeChargesAdd'
  | 'projectileDamageTakenLess'
  | 'ailmentDurationInc'
  | 'igniteDurationInc'
  | 'ailmentEffectInc'
  | 'igniteEffectInc'
  | 'chillEffectInc'
  | 'shockEffectInc'
  | 'chillGainInc'
  | 'freezeDurationInc'
  | 'freezeDurationAdd'
  | 'terrainDurationInc'
  | 'fireSpreadInc'
  | 'iceDurationInc'
  | 'chargeDurationAdd'
  | 'conductionRangeInc'
  | 'conductionRangeAdd'
  | 'conductionCellsAdd';

export interface StatLine {
  stat: StatKey;
  value: number;
}

/**
 * Rule effects (HeroMods.effects). Each value's meaning:
 * - wildheart: your Fire hits deal this much less (0.3); your terrain fire's ignite scales with
 *   your increased Fire damage.
 * - pyre_walker: immune to terrain fire; this much more damage while on burning ground (0.2).
 * - hydromancer: always Wet; a dodge leaves shallow water lasting this many seconds (6).
 * - stormglass: ice conducts your Storm; Shocked and Frozen enemies take this much more Storm (0.4).
 * - living_loom: automatic triggers cost no mana and share a global cooldown of this many seconds.
 * - single_thread: weaves without modifiers deal this much more (0.7).
 * - oilcraft: Oiled enemies take this much more Fire damage from you (0.25).
 * - brittle: Chilled or Frozen enemies take this much more Strike damage from you (0.25).
 * - rainshadow: Wet enemies take this much more Storm damage from you (0.15).
 * - echoing_thread: Echo's repeat deals full damage (> 0).
 * - tinder_tooth: the first Fire rune in each weave costs 0 complexity (> 0).
 * - arc_range_inc / arc_targets_add: your rule 19 arcs reach this much farther / hit more targets.
 * - tar_gland: your Fire hits leave an oil patch of this radius (cells), then ignite it.
 * - oiled_on_hit: your hits apply Oiled for this many seconds.
 * - projectile_speed_inc: Bolt and Lob projectiles this much faster.
 */
export const EFFECT_KEYS = [
  'wildheart',
  'pyre_walker',
  'hydromancer',
  'stormglass',
  'living_loom',
  'single_thread',
  'oilcraft',
  'brittle',
  'rainshadow',
  'echoing_thread',
  'tinder_tooth',
  'arc_range_inc',
  'arc_targets_add',
  'tar_gland',
  'oiled_on_hit',
  'projectile_speed_inc',
] as const;
export type EffectKey = (typeof EFFECT_KEYS)[number];

const TYPE_NAME: Record<DamageType | 'elemental', string> = {
  physical: 'Physical',
  fire: 'Fire',
  frost: 'Frost',
  storm: 'Storm',
  elemental: 'Elemental',
};

/** 0.08 → "8", 0.375 → "37.5". */
export function pct(v: number): string {
  return String(Math.round(v * 1000) / 10);
}

/** Short node name and the tooltip line for one stat. */
export const statInfo: Record<StatKey, { name: string; text: (v: number) => string }> = {
  'damageInc.physical': { name: 'Physical Damage', text: (v) => `${pct(v)}% increased Physical damage` },
  'damageInc.fire': { name: 'Fire Damage', text: (v) => `${pct(v)}% increased Fire damage` },
  'damageInc.frost': { name: 'Frost Damage', text: (v) => `${pct(v)}% increased Frost damage` },
  'damageInc.storm': { name: 'Storm Damage', text: (v) => `${pct(v)}% increased Storm damage` },
  'damageInc.elemental': {
    name: 'Elemental Damage',
    text: (v) => `${pct(v)}% increased ${TYPE_NAME.elemental} damage`,
  },
  'resistAdd.physical': { name: 'Toughness', text: (v) => `+${pct(v)}% Physical resistance` },
  'resistAdd.fire': { name: 'Fire Resistance', text: (v) => `+${pct(v)}% Fire resistance` },
  'resistAdd.frost': { name: 'Frost Resistance', text: (v) => `+${pct(v)}% Frost resistance` },
  'resistAdd.storm': { name: 'Storm Resistance', text: (v) => `+${pct(v)}% Storm resistance` },
  'resistAdd.elemental': {
    name: 'Elemental Resistance',
    text: (v) => `+${pct(v)}% to Fire, Frost and Storm resistance`,
  },
  maxLifeAdd: { name: 'Life', text: (v) => `+${v} maximum life` },
  maxManaAdd: { name: 'Mana', text: (v) => `+${v} maximum mana` },
  manaRegenAdd: { name: 'Mana Flow', text: (v) => `+${v} mana regenerated per second` },
  castSpeedInc: { name: 'Cast Speed', text: (v) => `${pct(v)}% increased cast speed` },
  critChanceAdd: { name: 'Critical Chance', text: (v) => `+${pct(v)}% critical strike chance` },
  manaCostReduced: { name: 'Thrift', text: (v) => `${pct(v)}% reduced mana cost` },
  capacityAdd: { name: 'Capacity', text: (v) => `${v > 0 ? '+' : '−'}${Math.abs(v)} Capacity` },
  branchDamageInc: { name: 'Branch Damage', text: (v) => `${pct(v)}% increased damage with branch spells` },
  moveSpeedInc: { name: 'Swiftness', text: (v) => `${pct(v)}% increased movement speed` },
  dodgeRechargeInc: { name: 'Dodge Recharge', text: (v) => `Dodge recharges ${pct(v)}% faster` },
  dodgeChargesAdd: { name: 'Dodge Charge', text: (v) => `+${v} dodge charge${v === 1 ? '' : 's'}` },
  projectileDamageTakenLess: {
    name: 'Deflection',
    text: (v) => `Take ${pct(v)}% less damage from projectiles`,
  },
  ailmentDurationInc: { name: 'Ailment Duration', text: (v) => `${pct(v)}% increased ailment duration` },
  igniteDurationInc: { name: 'Ignite Duration', text: (v) => `Ignite lasts ${pct(v)}% longer` },
  ailmentEffectInc: {
    name: 'Ailment Effect',
    text: (v) => `${pct(v)}% increased effect of Ignite, Chill and Shock`,
  },
  igniteEffectInc: { name: 'Ignite Effect', text: (v) => `${pct(v)}% increased Ignite damage` },
  chillEffectInc: { name: 'Chill Effect', text: (v) => `${pct(v)}% increased effect of Chill` },
  shockEffectInc: { name: 'Shock Effect', text: (v) => `${pct(v)}% increased effect of Shock` },
  chillGainInc: { name: 'Chill Build-up', text: (v) => `${pct(v)}% increased chill build-up` },
  freezeDurationInc: { name: 'Freeze Duration', text: (v) => `Freeze lasts ${pct(v)}% longer` },
  freezeDurationAdd: { name: 'Deep Cold', text: (v) => `Freeze lasts ${v} s longer` },
  terrainDurationInc: {
    name: 'Terrain Duration',
    text: (v) => `${pct(v)}% increased duration of terrain effects you create`,
  },
  fireSpreadInc: { name: 'Fire Spread', text: (v) => `Fire you create spreads ${pct(v)}% faster` },
  iceDurationInc: { name: 'Ice Duration', text: (v) => `Ice you create lasts ${pct(v)}% longer` },
  chargeDurationAdd: { name: 'Charge Duration', text: (v) => `Charge you create lasts ${v} s longer` },
  conductionRangeInc: { name: 'Conduction', text: (v) => `${pct(v)}% increased conduction range` },
  conductionRangeAdd: { name: 'Conduction', text: (v) => `Water you electrify conducts ${v} cells farther` },
  conductionCellsAdd: { name: 'Conduction', text: (v) => `+${v} to the electrified water cell cap` },
};
