/**
 * Unique items (CONTENT §8, M5): their stats and rules into HeroMods, and the hooks systems call.
 * Called by heroModsOf after the passive tree, so a granted keystone (Stormglass Charm) can see
 * whether the tree already has it and never stacks with it.
 *
 * Hooks (each returns the plain value without the unique):
 * - Compile (weave/runtime/loadout.ts stateContext): HeroMods maxDepth, spawnCapPerCast,
 *   manaMore; capacityAdd carries The First Thread's Capacity 6; weave/rules.ts branchRunesFree.
 * - igniteImmune (combat/ailments.ts applyIgnite): Kiln-Heart Cloak.
 * - burningGroundHeal (actors/terrain.ts): Kiln-Heart Cloak heals on burning ground.
 * - playerFireTakenMult (combat/hits.ts, combat/ailmentTick.ts): Pyre Hood's 10% more Fire taken.
 * - rimeTrail (actors/player.ts): Rimewalkers' ice trail while dodging.
 */
import { passiveNodes, isPassiveId } from '../../../data/passives';
import { spindles, isSpindleId } from '../../../data/spindles';
import { isUniqueId, uniques, type UniqueDef } from '../../../data/uniques';
import { hydromancerGrounds } from '../../../data/passives';
import { DT } from '../core/constants';
import type { AilmentTarget } from '../combat/ailments';
import { placeRime } from '../grid/tempRime';
import type { GameState } from '../state';
import { addEffects, addStat as addLine } from './effectMods';
import type { HeroMods } from './mods';
import { addStat } from './stats';
import { EQUIP_SLOTS, type HeroState } from './types';

/** Named rule effects uniques set in HeroMods.effects. */
export const UNIQUE_EFFECTS = {
  branchRunesFree: 'branch_runes_free',
  igniteImmune: 'ignite_immune',
  burningGroundHeal: 'burning_ground_heal',
  fireTakenMore: 'fire_taken_more',
  rimeSeconds: 'rime_trail_seconds',
  rimeWidth: 'rime_trail_width',
} as const;

/** Equipped uniques with the slot they're in. */
export function equippedUniques(hero: HeroState): { def: UniqueDef; slot: string }[] {
  const out: { def: UniqueDef; slot: string }[] = [];
  for (const slot of EQUIP_SLOTS) {
    const uid = hero.equipped[slot];
    if (uid === null) continue;
    const it = hero.items.find((x) => x.uid === uid);
    if (it?.rarity === 'unique' && it.unique && isUniqueId(it.unique))
      out.push({ def: uniques[it.unique], slot });
  }
  return out;
}

function bump(mods: HeroMods, key: string, v: number): void {
  mods.effects[key] = (mods.effects[key] ?? 0) + v;
}

function raise(mods: HeroMods, key: string, v: number): void {
  mods.effects[key] = Math.max(mods.effects[key] ?? 0, v);
}

/** Adds the equipped uniques' stats and rules. Depth: The Unraveling raises it, The First Thread caps it. */
export function addUniqueMods(hero: HeroState, mods: HeroMods): void {
  let depthCap = Infinity;
  for (const { def } of equippedUniques(hero)) {
    const r = def.rules;
    for (const s of def.stats) addStat(mods, s.stat, s.value);
    if (r.baseCapacity !== undefined && isSpindleId(def.base))
      mods.capacityAdd += r.baseCapacity - spindles[def.base].capacity;
    if (r.branchRunesFree) raise(mods, UNIQUE_EFFECTS.branchRunesFree, 1);
    if (r.maxDepth !== undefined) mods.maxDepth = Math.max(mods.maxDepth, r.maxDepth);
    if (r.depthCap !== undefined) depthCap = Math.min(depthCap, r.depthCap);
    if (r.spawnCapPerCast !== undefined)
      mods.spawnCapPerCast = Math.max(mods.spawnCapPerCast, r.spawnCapPerCast);
    if (r.manaMore !== undefined) mods.manaMore *= 1 + r.manaMore;
    if (r.igniteImmune) raise(mods, UNIQUE_EFFECTS.igniteImmune, 1);
    if (r.burningGroundHeal !== undefined) bump(mods, UNIQUE_EFFECTS.burningGroundHeal, r.burningGroundHeal);
    if (r.dodgeIceTrail) {
      raise(mods, UNIQUE_EFFECTS.rimeSeconds, r.dodgeIceTrail.seconds);
      raise(mods, UNIQUE_EFFECTS.rimeWidth, r.dodgeIceTrail.width);
    }
    if (r.fireTakenMore !== undefined) bump(mods, UNIQUE_EFFECTS.fireTakenMore, r.fireTakenMore);
    if (r.fireRuneLevels !== undefined) mods.runeLevelAdd.fire += r.fireRuneLevels;
    if (r.keystone !== undefined && isPassiveId(r.keystone) && !mods.keystones.includes(r.keystone)) {
      const node = passiveNodes[r.keystone];
      for (const line of node.stats) addLine(mods, line);
      addEffects(mods, node.effects);
      mods.keystones = [...mods.keystones, r.keystone].sort();
    }
  }
  if (depthCap < mods.maxDepth) mods.maxDepth = depthCap;
}

/** Kiln-Heart Cloak: the player can't be Ignited. */
export function igniteImmune(state: GameState, t: AilmentTarget): boolean {
  return t === state.player && (state.heroMods.effects[UNIQUE_EFFECTS.igniteImmune] ?? 0) > 0;
}

/** Kiln-Heart Cloak: heals the living player standing on a burning cell, a fraction of max life per second. */
export function burningGroundHeal(state: GameState, t: AilmentTarget, burning: boolean): void {
  if (!burning || t !== state.player || state.player.dead) return;
  const rate = state.heroMods.effects[UNIQUE_EFFECTS.burningGroundHeal] ?? 0;
  if (rate <= 0) return;
  const p = state.player;
  p.life = Math.min(p.maxLife, p.life + p.maxLife * rate * DT);
}

/** Pyre Hood: multiplier on Fire damage the player takes (1 for anyone else). */
export function playerFireTakenMult(state: GameState, t: AilmentTarget): number {
  if (t !== state.player) return 1;
  return 1 + (state.heroMods.effects[UNIQUE_EFFECTS.fireTakenMore] ?? 0);
}

/**
 * Rimewalkers: each dodge tick freezes and rimes a disc of the trail's width just ahead of the
 * player (centered half a width along the dodge), so water ahead freezes before the body reaches
 * it and a dodge can cross deep water on the bridge it makes.
 */
export function rimeTrail(state: GameState): void {
  const fx = state.heroMods.effects;
  const seconds = fx[UNIQUE_EFFECTS.rimeSeconds] ?? 0;
  if (seconds <= 0) return;
  const p = state.player;
  const r = (fx[UNIQUE_EFFECTS.rimeWidth] ?? 3) / 2;
  placeRime(state, p.x + p.dodgeDirX * r, p.y + p.dodgeDirY * r, r, seconds, rimeGrounds);
}

/**
 * Dry grounds rime may cover: the ones Hydromancer's water covers, plus metal floors. Not wood:
 * a bridge's `under` holds the water it spans, which rime would overwrite.
 */
const rimeGrounds = [...hydromancerGrounds, 'metal_floor'] as const;
