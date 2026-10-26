/**
 * The open rift's modifiers as numbers for the systems that read them (CONTENT §10, M6). Outside
 * a rift room every value is neutral, so callers multiply or add without checking. Terrain
 * suffixes rewrite the rooms when the rift is built (terrain.ts); these are the runtime parts:
 *
 * - Monsters (actors/enemies.ts spawnEnemy, ai/common.ts, actors/roomSpawns.ts): more life
 *   (Hardened), +resistance to Fire, Frost and Storm (Resolute), faster movement (Hasty), more
 *   pack members and enemy-line enemies (Teeming).
 * - Monster damage (combat/hits.ts): hits on the player from monsters deal more (Brutal). World
 *   hazards (barrels, pylons, world fire) don't count.
 * - The tier (M7): monster life and hit damage grow per tier on top of the area level
 *   (data/rift.ts riftTierScaling), so climbing needs the power the Hearth and gear give.
 * - Chemistry (grid/tick.ts, grid/elements.ts, actors/terrain.ts): fire spread chance (Drought),
 *   ice duration (Permafrost), smoke duration and monsters not Blinded by smoke (Choking Smoke),
 *   monsters always Oiled (Tinderbox), pylon pulses (Live Wires, pulse.ts), room wind (of the
 *   Gale, M8: grid.wind set when the room is entered, world/transition.ts).
 * - Loot (items/drops.ts): item quantity and rarity, the sum over the modifiers.
 */
import { riftMods, riftTierScaling, type RiftModDef } from '../../../../data/rift';
import type { GameState } from '../../state';
import type { RiftSpec } from './types';
import { WIND_BY_NAME, type WindDir } from '../../grid/windDir';
import { isRiftRoomId } from './types';
import { sigilBonus } from '../../items/sigils';

export interface RiftRules {
  monsterDamageMore: number;
  packSizeMore: number;
  monsterLifeMore: number;
  monsterResistAdd: number;
  monsterSpeedMore: number;
  /** Monster life and hit damage × these for the rift's tier (M7, data/rift.ts riftTierScaling). */
  tierLifeMult: number;
  tierDamageMult: number;
  fireSpreadMult: number;
  iceDurationMult: number;
  smokeDurationMult: number;
  monstersSeeInSmoke: boolean;
  monstersOiled: boolean;
  /** 0: no pulses. */
  pylonPulseSeconds: number;
  /** M8 "of the Gale": room wind in every rift room (0 none; grid/windDir.ts), set on room entry. */
  wind: WindDir;
  quantity: number;
  rarity: number;
}

export const NEUTRAL_RIFT_RULES: Readonly<RiftRules> = Object.freeze({
  monsterDamageMore: 0,
  packSizeMore: 0,
  monsterLifeMore: 0,
  monsterResistAdd: 0,
  monsterSpeedMore: 0,
  tierLifeMult: 1,
  tierDamageMult: 1,
  fireSpreadMult: 1,
  iceDurationMult: 1,
  smokeDurationMult: 1,
  monstersSeeInSmoke: false,
  monstersOiled: false,
  pylonPulseSeconds: 0,
  wind: 0,
  quantity: 0,
  rarity: 0,
});

/** Monster life and hit damage multipliers of a rift tier (M7): × (1 + perTier)^(tier − 1). */
export function tierScaling(tier: number): { life: number; damage: number } {
  const n = Math.max(0, tier - 1);
  return {
    life: Math.pow(1 + riftTierScaling.lifeMorePerTier, n),
    damage: Math.pow(1 + riftTierScaling.damageMorePerTier, n),
  };
}

/** Rules of a modifier list at a tier: "more" and "add" values sum, multipliers multiply. */
export function rulesOf(mods: RiftSpec['mods'], tier = 1): RiftRules {
  const r: RiftRules = { ...NEUTRAL_RIFT_RULES };
  const ts = tierScaling(tier);
  r.tierLifeMult = ts.life;
  r.tierDamageMult = ts.damage;
  for (const id of mods) {
    const m: RiftModDef = riftMods[id];
    r.monsterDamageMore += m.monsterDamageMore ?? 0;
    r.packSizeMore += m.packSizeMore ?? 0;
    r.monsterLifeMore += m.monsterLifeMore ?? 0;
    r.monsterResistAdd += m.monsterResistAdd ?? 0;
    r.monsterSpeedMore += m.monsterSpeedMore ?? 0;
    r.fireSpreadMult *= m.fireSpreadMult ?? 1;
    r.iceDurationMult *= m.iceDurationMult ?? 1;
    r.smokeDurationMult *= m.smokeDurationMult ?? 1;
    r.monstersSeeInSmoke ||= m.monstersSeeInSmoke === true;
    r.monstersOiled ||= m.monstersOiled === true;
    if (m.pylonPulseSeconds !== undefined) r.pylonPulseSeconds = m.pylonPulseSeconds;
    if (m.wind !== undefined) r.wind = WIND_BY_NAME[m.wind]!;
  }
  const bonus = sigilBonus(mods);
  r.quantity = bonus.quantity;
  r.rarity = bonus.rarity;
  return r;
}

const cache = new WeakMap<RiftSpec, RiftRules>();

/** The rules in effect in the current room: the open rift's inside its rooms, else neutral. */
export function riftRules(state: GameState): Readonly<RiftRules> {
  const rift = state.world.rift;
  if (!rift || !isRiftRoomId(state.room.id)) return NEUTRAL_RIFT_RULES;
  let r = cache.get(rift.spec);
  if (!r) {
    r = rulesOf(rift.spec.mods, rift.spec.tier);
    cache.set(rift.spec, r);
  }
  return r;
}
