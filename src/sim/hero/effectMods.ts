/**
 * Adds the allocated passive nodes (data/passives.ts) and the parts fused into the equipped
 * spindle (data/fuseEffects.ts) into a HeroMods (src/sim/hero/mods.ts). Called by refreshHero
 * on mods that may already hold the item and level sources; it only ever adds.
 *
 * Fuse tiers (CONTENT §4): tier II and III multiply a part's numbers by 1.5 and 2; parts without
 * a number gain 10% / 20% increased damage of their element instead.
 */
import { damageTypes } from '../../../data/combatTypes';
import {
  fuseEffects,
  fuseTierDamageInc,
  fuseTierMult,
  isFusePartId,
  type FuseEffectDef,
} from '../../../data/fuseEffects';
import { isPassiveId, passiveNodes } from '../../../data/passives';
import type { EffectKey, StatLine } from '../../../data/passiveStats';
import type { HeroMods } from './mods';
import type { FusePart, HeroState } from './types';

const ELEMENTAL = ['fire', 'frost', 'storm'] as const;

/** Adds one stat line × k to the mods. */
export function addStat(mods: HeroMods, line: StatLine, k = 1): void {
  const v = line.value * k;
  const stat = line.stat;
  if (stat.startsWith('damageInc.') || stat.startsWith('resistAdd.')) {
    const [group, type] = stat.split('.') as ['damageInc' | 'resistAdd', string];
    const target = mods[group];
    if (type === 'elemental') for (const t of ELEMENTAL) target[t] += v;
    else if ((damageTypes as readonly string[]).includes(type)) target[type as keyof typeof target] += v;
    return;
  }
  switch (stat) {
    case 'ailmentEffectInc':
      mods.igniteEffectInc += v;
      mods.chillEffectInc += v;
      mods.shockEffectInc += v;
      return;
    case 'maxLifeAdd':
    case 'maxManaAdd':
    case 'manaRegenAdd':
    case 'castSpeedInc':
    case 'critChanceAdd':
    case 'manaCostReduced':
    case 'capacityAdd':
    case 'branchDamageInc':
    case 'moveSpeedInc':
    case 'dodgeRechargeInc':
    case 'dodgeChargesAdd':
    case 'projectileDamageTakenLess':
    case 'ailmentDurationInc':
    case 'igniteDurationInc':
    case 'igniteEffectInc':
    case 'chillEffectInc':
    case 'shockEffectInc':
    case 'chillGainInc':
    case 'freezeDurationInc':
    case 'freezeDurationAdd':
    case 'terrainDurationInc':
    case 'fireSpreadInc':
    case 'iceDurationInc':
    case 'chargeDurationAdd':
    case 'conductionRangeInc':
    case 'conductionRangeAdd':
    case 'conductionCellsAdd':
      mods[stat] += v;
      return;
  }
}

function addEffects(mods: HeroMods, effects: Readonly<Partial<Record<EffectKey, number>>>, k = 1): void {
  for (const [key, v] of Object.entries(effects)) mods.effects[key] = (mods.effects[key] ?? 0) + (v ?? 0) * k;
}

/** Allocated passives: stats, rule effects, and keystone ids (sorted). Unknown ids are skipped. */
export function addPassiveMods(hero: HeroState, mods: HeroMods): void {
  const keystones: string[] = [];
  for (const id of hero.passives) {
    if (!isPassiveId(id)) continue;
    const node = passiveNodes[id];
    for (const line of node.stats) addStat(mods, line);
    addEffects(mods, node.effects);
    if (node.type === 'keystone') keystones.push(id);
  }
  if (keystones.length > 0) mods.keystones = [...mods.keystones, ...keystones].sort();
}

/** The parts fused into the equipped spindle, in socket order (none without one). */
export function fusedParts(hero: HeroState): FusePart[] {
  const uid = hero.equipped.spindle;
  if (uid === null) return [];
  const item = hero.items.find((it) => it.uid === uid);
  if (!item) return [];
  return item.fused.filter((p): p is FusePart => p !== null);
}

/** Fused parts: listed in mods.parts, their effects scaled by tier. Unknown part ids are listed only. */
export function addPartMods(hero: HeroState, mods: HeroMods): void {
  for (const p of fusedParts(hero)) {
    mods.parts.push({ part: p.part, tier: p.tier });
    if (!isFusePartId(p.part)) continue;
    const def: FuseEffectDef = fuseEffects[p.part];
    const k = def.numeric ? fuseTierMult[p.tier - 1] : 1;
    for (const line of def.stats) addStat(mods, line, k);
    addEffects(mods, def.effects, k);
    for (const w of def.extraWeaves) mods.extraWeaves.push(w);
    const inc = def.numeric ? 0 : fuseTierDamageInc[p.tier - 1];
    if (inc > 0 && def.element !== null) mods.damageInc[def.element] += inc;
  }
}

/** Both of the above: the effects agent's share of refreshHero. */
export function addPassiveAndPartMods(hero: HeroState, mods: HeroMods): void {
  addPassiveMods(hero, mods);
  addPartMods(hero, mods);
}
