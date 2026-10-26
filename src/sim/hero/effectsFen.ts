/**
 * The Fen's Fuse parts (M8, CONTENT §4; data/fuseEffects.ts), as rules the combat, terrain and
 * movement code asks about. Every function returns the neutral value when no part applies.
 *
 * - pike_scale (Pike Scale): the player isn't slowed by shallow water or mud
 *   (playerUnslowedGrounds, actors/player.ts).
 * - charge_taken_less (Copper Carapace): the player takes this much less from charged water and
 *   metal that isn't their own (chargeDamageMult, actors/terrain.ts).
 * - charge_damage_more (Heron Plume): the player's charge deals this much more (chargeDamageMult).
 * - wet_fire_more (Slag Core), mire_more (Mire Horn), shocked_physical_more (Bell Bronze): per-hit
 *   "more" in hero/effectsCombat.ts playerHitPacket.
 * - kill_charge (Sparkfly Lantern): an enemy the player kills while it stands in water releases
 *   the player's charge into it for this fraction of the killing hit (lanternKill, combat/hits.ts).
 * - gust_seconds_add, gust_area_inc (Toad Bellows): the player's gusts last longer and cover more
 *   area (playerGustScale, for grid/wind.ts's Gale gusts).
 */
import { MAT, OWNER, materialByCode } from '../../../data/materials';
import { pikeScaleGrounds } from '../../../data/fuseEffects';
import { PLAYER_ID, type Enemy } from '../actors/enemies';
import { cellOf } from '../actors/swim';
import type { AilmentTarget } from '../combat/ailments';
import type { HitResult } from '../combat/damage';
import { applyElement } from '../grid/paint';
import type { GameState } from '../state';

const PIKE_TABLE = (() => {
  const t = new Uint8Array(materialByCode.length);
  for (const id of pikeScaleGrounds) t[MAT[id]] = 1;
  return t;
})();

/** Grounds whose slow the player ignores (Pike Scale), as a lookup by material code; null: none. */
export function playerUnslowedGrounds(state: GameState): Readonly<Uint8Array> | null {
  return (state.heroMods.effects.pike_scale ?? 0) > 0 ? PIKE_TABLE : null;
}

/**
 * Multiplier on a charge hit (rules 11–12) on `t` from charge owned by `owner`: Copper Carapace
 * on the player against charge that isn't theirs, Heron Plume on enemies from the player's.
 */
export function chargeDamageMult(state: GameState, t: AilmentTarget, owner: number): number {
  const fx = state.heroMods.effects;
  if (t === state.player) {
    const less = fx.charge_taken_less ?? 0;
    return owner !== OWNER.player && less > 0 ? Math.max(0, 1 - less) : 1;
  }
  const more = fx.charge_damage_more ?? 0;
  return owner === OWNER.player && more > 0 ? 1 + more : 1;
}

/** Sparkfly Lantern: the player killed `e` with `res`; in water, it releases the player's charge. */
export function lanternKill(state: GameState, e: Enemy, res: HitResult): void {
  const k = state.heroMods.effects.kill_charge ?? 0;
  if (k <= 0 || res.total <= 0) return;
  const i = cellOf(state, e.x, e.y);
  if (i < 0 || materialByCode[state.grid.ground[i]!]!.water === null) return;
  const w = state.grid.width;
  const x = i % w;
  applyElement(state, {
    element: 'storm',
    shape: { kind: 'circle', x: x + 0.5, y: (i - x) / w + 0.5, r: 0.1 },
    owner: OWNER.player,
    sourceId: PLAYER_ID,
    hitDamage: res.total * k,
    durationMult: 1,
  });
}

/**
 * Toad Bellows on the player's gusts: seconds to add, and the radius multiplier that covers
 * 1 + gust_area_inc times the area (area grows with the radius squared).
 */
export function playerGustScale(state: GameState): { secondsAdd: number; radiusMult: number } {
  const fx = state.heroMods.effects;
  return { secondsAdd: fx.gust_seconds_add ?? 0, radiusMult: Math.sqrt(1 + (fx.gust_area_inc ?? 0)) };
}

/** Mire Horn: `e` stands on mud or in shallow water. */
export function onMireGround(state: GameState, e: Enemy): boolean {
  const i = cellOf(state, e.x, e.y);
  if (i < 0) return false;
  const c = state.grid.ground[i]!;
  return c === MAT.mud || c === MAT.shallow_water;
}
