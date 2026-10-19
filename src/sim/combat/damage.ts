import { damageTypes, type DamageAmounts, type DamageType } from '../../../data/combatTypes';
import type { Rng } from '../core/rng';

/**
 * Everything a hit carries before it meets a target (DESIGN §7). Built by the spell or enemy
 * attack that deals it; resolveHit applies the target side.
 */
export interface DamagePacket {
  /** Damage per type before multipliers: base damage × element share. */
  base: DamageAmounts;
  /** 0–1. */
  critChance: number;
  /** Damage multiplier on a crit (1.5 = 150%). */
  critMultiplier: number;
  /** Sum of all "increased" and "reduced" modifiers (0.3 = 30% increased). */
  increased: number;
  /** Each "more" or "less" modifier as a fraction (0.3 = 30% more, -0.25 = 25% less). */
  more: readonly number[];
  /**
   * Multiplier on the durations of the Ignite, Shock and Freeze this hit applies (1.3 with
   * Lingering). Missing means 1. Chill decay and boss freeze immunity are not scaled.
   */
  ailmentDuration?: number;
  /**
   * Extra "increased" per damage type, added to `increased` for that type only (Ashwood: 10%
   * increased Fire damage). Missing means none.
   */
  increasedByType?: DamageAmounts;
  /** Multiplier on the chill points this hit adds (Rimeglass 1.2). Missing means 1. */
  chillGain?: number;
}

/** The target side of the formula. */
export interface DamageTarget {
  /** Resistance per type (0.75 = 75%, negative takes extra). Caps are applied where it is set. */
  resist: DamageAmounts;
  /** Shock: increased damage taken as a fraction (0.2 = 20%); see combat/ailments.ts. */
  shock: number;
  /** Other damage-taken multiplier (a doused Tinderling takes 1.5×). Missing means 1. */
  takenMult?: number;
}

export interface HitResult {
  /** Total damage over all types. */
  total: number;
  crit: boolean;
  byType: DamageAmounts;
  /** The type that dealt the most (ties go to the earlier type in damageTypes). */
  mainType: DamageType;
  /**
   * The target's Shock that multiplied this hit (fraction). byType[t] / (1 + shock) is the
   * damage before Shock, which ailment magnitudes use.
   */
  shock: number;
  /** The target's other damage-taken multiplier on this hit (1 = none); ailments divide it out like Shock. */
  takenMult: number;
}

export function zeroAmounts(): DamageAmounts {
  return { physical: 0, fire: 0, frost: 0, storm: 0 };
}

/** A packet with no increased/more modifiers: base × share per type. */
export function makePacket(
  baseDamage: number,
  shares: Partial<DamageAmounts>,
  critChance: number,
  critMultiplier: number,
): DamagePacket {
  const base = zeroAmounts();
  for (const t of damageTypes) base[t] = baseDamage * (shares[t] ?? 0);
  return { base, critChance, critMultiplier, increased: 0, more: [], ailmentDuration: 1 };
}

/**
 * Hit damage = base × element share × (1 + Σ increased) × Π (1 + more) × (crit ? crit multi : 1)
 *              × (1 − resistance) × (1 + shock) × takenMult, per type, summed.
 *
 * The crit roll uses `rng` (the state's dedicated combat stream) and is skipped entirely when
 * critChance ≤ 0, so hits that can't crit don't shift later rolls.
 */
export function resolveHit(packet: DamagePacket, target: DamageTarget, rng: Rng): HitResult {
  const byTypeInc = packet.increasedByType;
  let common = byTypeInc ? 1 : 1 + packet.increased;
  for (const m of packet.more) common *= 1 + m;
  const crit = packet.critChance > 0 && rng.float() < packet.critChance;
  if (crit) common *= packet.critMultiplier;
  const taken = target.takenMult ?? 1;
  common *= (1 + target.shock) * taken;

  const byType = zeroAmounts();
  let total = 0;
  let mainType: DamageType = damageTypes[0];
  let best = -Infinity;
  for (const t of damageTypes) {
    const base = packet.base[t];
    if (base === 0) continue;
    const inc = byTypeInc ? 1 + packet.increased + byTypeInc[t] : 1;
    const dmg = base * inc * common * (1 - target.resist[t]);
    byType[t] = dmg;
    total += dmg;
    if (dmg > best) {
      best = dmg;
      mainType = t;
    }
  }
  return { total, crit, byType, mainType, shock: target.shock, takenMult: taken };
}

/** base × growth^(level − 1), by repeated multiplication (exact for integer levels, no Math.pow). */
export function scaleByLevel(base: number, growth: number, level: number): number {
  let v = base;
  for (let i = 1; i < level; i++) v *= growth;
  return v;
}
