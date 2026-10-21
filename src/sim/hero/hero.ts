/**
 * Creating, refreshing and hashing the character (src/sim/hero/types.ts).
 *
 * CONTRACT (M4): `refreshHero` is the one place `state.heroMods` is rebuilt. Call it after any
 * change to `state.hero` (HeroEdit, level up, pickup of a Heart Seed or Loom Shard, load). The
 * hero/items agent fills in the item and level parts; the effects agent the passive and Fuse
 * parts (through its own aggregation function called from here).
 */
import { EQUIP_SLOTS, type FusePart, type HeroState, type Item, type RuneItem } from './types';
import { emptyHeroMods, type HeroMods } from './mods';
import { addPassiveAndPartMods } from './effectMods';
import { syncHeroEffects } from './effects';
import { currencyIds } from '../../../data/currency';
import type { Hasher } from '../core/hash';
import type { GameState } from '../state';
import { addHeroItemMods } from './aggregate';
import { syncPlayerToHero } from '../actors/playerVitals';
import { recompileWeaves } from '../weave/runtime/loadout';

/** A level 1 character with nothing: sandbox, arena and lab games use it as is. */
export function createHero(): HeroState {
  return {
    level: 1,
    xp: 0,
    unlockedRunes: [],
    runes: [],
    items: [],
    equipped: { spindle: null, cloak: null, hood: null, boots: null, charm1: null, charm2: null },
    parts: [],
    passives: [],
    heartSeeds: 0,
    loomShards: 0,
    threadScrap: 0,
    currency: {},
    patternSeeds: 0,
    nextUid: 1,
  };
}

/**
 * Rebuilds `state.heroMods` from `state.hero`, then brings the systems that cache character
 * numbers up to date: the player's level, max life and mana, resistances and dodge charges, and
 * every weave's compiled program (Capacity, cast speed, rune levels, Strike bonus, mana cost).
 * A hero with nothing (sandbox, arena, lab) gives neutral mods and changes nothing.
 */
export function refreshHero(state: GameState): void {
  state.heroMods = heroModsOf(state.hero);
  syncPlayerToHero(state);
  // Once every source is in: compile rules and extra weaves (effects agent: hero/effects.ts),
  // then every weave's program against the new Capacity, cast speed and rune levels.
  syncHeroEffects(state);
  recompileWeaves(state);
}

/**
 * What a hero's build adds up to, pure (refreshHero stores it in state.heroMods; the UI compares
 * hypothetical heroes with it): items, Heart Seeds, Loom Shards (hero/aggregate.ts), then the
 * passive tree and fused Fuse parts (effects agent: hero/effectMods.ts).
 */
export function heroModsOf(hero: Readonly<HeroState>): HeroMods {
  const mods = emptyHeroMods();
  addHeroItemMods(mods, hero as HeroState);
  addPassiveAndPartMods(hero as HeroState, mods);
  return mods;
}

/**
 * Passive points earned (DESIGN §9): one per level above 1, plus Pattern Seeds. Unspent points
 * are this minus `hero.passives.length`.
 */
export function passivePointsEarned(hero: HeroState): number {
  return hero.level - 1 + hero.patternSeeds;
}

export function hashRune(h: Hasher, r: RuneItem): void {
  h.u32(r.uid).string(r.rune).byte(0).u32(r.level).num(r.xp).num(r.quality);
}

export function hashPart(h: Hasher, p: FusePart): void {
  h.u32(p.uid).string(p.part).byte(0).u32(p.tier);
}

export function hashItem(h: Hasher, it: Item): void {
  h.u32(it.uid).string(it.base).byte(0).string(it.rarity).byte(0).u32(it.itemLevel);
  h.u32(it.affixes.length);
  for (const a of it.affixes) h.string(a.id).byte(0).u32(a.tier).num(a.value);
  h.u32(it.fused.length);
  for (const f of it.fused) {
    if (f) hashPart(h, f);
    else h.u32(0);
  }
  h.string(it.name ?? '')
    .byte(0)
    .string(it.unique ?? '')
    .byte(0);
}

export function hashHero(h: Hasher, hero: HeroState): void {
  h.u32(hero.level).num(hero.xp).u32(hero.nextUid);
  h.u32(hero.unlockedRunes.length);
  for (const r of hero.unlockedRunes) h.string(r).byte(0);
  h.u32(hero.runes.length);
  for (const r of hero.runes) hashRune(h, r);
  h.u32(hero.items.length);
  for (const it of hero.items) hashItem(h, it);
  for (const slot of EQUIP_SLOTS) h.num(hero.equipped[slot] ?? -1);
  h.u32(hero.parts.length);
  for (const p of hero.parts) hashPart(h, p);
  h.u32(hero.passives.length);
  for (const n of hero.passives) h.string(n).byte(0);
  h.u32(hero.heartSeeds).u32(hero.loomShards).u32(hero.threadScrap).u32(hero.patternSeeds);
  for (const c of currencyIds) h.u32(hero.currency[c] ?? 0);
}
