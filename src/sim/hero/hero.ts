/**
 * Creating, refreshing and hashing the character (src/sim/hero/types.ts).
 *
 * CONTRACT (M4): `refreshHero` is the one place `state.heroMods` is rebuilt. Call it after any
 * change to `state.hero` (HeroEdit, level up, pickup of a Heart Seed or Loom Shard, load). The
 * hero/items agent fills in the item and level parts; the effects agent the passive and Fuse
 * parts (through its own aggregation function called from here).
 */
import { EQUIP_SLOTS, type FusePart, type HeroState, type Item, type RuneItem } from './types';
import { emptyHeroMods } from './mods';
import type { Hasher } from '../core/hash';
import type { GameState } from '../state';

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
    patternSeeds: 0,
    nextUid: 1,
  };
}

/** Rebuilds `state.heroMods` from `state.hero`. Stub: neutral mods until the M4 agents fill it. */
export function refreshHero(state: GameState): void {
  state.heroMods = emptyHeroMods();
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
}
