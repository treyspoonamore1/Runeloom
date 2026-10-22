/**
 * Kill drops (M4 task 7, M5, M6 rift sigils and bonuses): random runes from unlocked runes only, spindle bases by item level
 * and cloaks, hoods, boots and charms (Normal, Magic or Rare), crafting currencies, uniques, Fuse parts by enemy kind with a tier
 * by area level, and Thread Scrap. Rates are in data/loot.ts; monster rarity adds rolls
 * (quantity) and raises the Magic spindle chance (quality). Every roll uses `state.lootRng`.
 */
import { dropRates, partTierFrom } from '../../../data/loot';
import { gearBases, type GearBaseDef } from '../../../data/items';
import { partDroppedBy } from '../../../data/fuseParts';
import { bossKinds, runeDiscovery, spindleDropFrom } from '../../../data/progression';
import type { RuneId } from '../../../data/runes';
import { spindles, type SpindleId } from '../../../data/spindles';
import type { Enemy, EnemyRarity } from '../actors/enemies';
import type { GameState } from '../state';
import type { Item } from '../hero/types';
import { currencies, currencyIds, type CurrencyId } from '../../../data/currency';
import type { ItemKind } from '../../../data/items';
import type { Rng } from '../core/rng';
import { rollMagicAffixes } from './affixRoll';
import { rollRareAffixes, rollRareName, sortAffixes } from './rare';
import { rollUnique } from './uniqueItems';
import { makeItem, makePart, makeRune } from './items';
import { dropLoot, type LootContent } from './loot';
import { rollSigil } from './sigils';
import { riftDrops } from '../../../data/rift';
import { riftRules } from '../world/rift/rules';
import { isRiftRoomId } from '../world/rift/types';

/** Fuse part tier for an area level (DESIGN §8.4). */
export function partTierFor(areaLevel: number): 1 | 2 | 3 {
  if (areaLevel >= partTierFrom[3]) return 3;
  if (areaLevel >= partTierFrom[2]) return 2;
  return 1;
}

/** Spindle bases that can drop at an item level: the Twig always, others from spindleDropFrom. */
export function spindleBasesAt(itemLevel: number): SpindleId[] {
  const out: SpindleId[] = ['twig'];
  for (const [id, from] of Object.entries(spindleDropFrom) as [SpindleId, number][])
    if (from <= itemLevel) out.push(id);
  return out;
}

type RarityWeights = { readonly normal: number; readonly magic: number; readonly rare: number };

/** Normal, Magic or Rare by weight. */
export function rollRarity(rng: Rng, w: RarityWeights): 'normal' | 'magic' | 'rare' {
  const r = rng.float() * (w.normal + w.magic + w.rare);
  if (r < w.normal) return 'normal';
  if (r < w.normal + w.magic) return 'magic';
  return 'rare';
}

/** A new item of a base and rarity, its affixes (and a Rare's name) rolled with the loot RNG. */
function rolledItem(
  state: GameState,
  base: string,
  kind: ItemKind,
  rarity: 'normal' | 'magic' | 'rare',
  level: number,
): Item {
  const rng = state.lootRng;
  if (rarity === 'normal') return makeItem(state.hero, base, 'normal', level);
  if (rarity === 'magic')
    return makeItem(state.hero, base, 'magic', level, sortAffixes(rollMagicAffixes(rng, kind, level)));
  const name = rollRareName(rng, kind);
  const item = makeItem(state.hero, base, 'rare', level, rollRareAffixes(rng, kind, level));
  item.name = name;
  return item;
}

/** A random spindle for an item level, its rarity rolled from `weights`. */
export function rollSpindle(state: GameState, itemLevel: number, weights: RarityWeights): Item {
  const rng = state.lootRng;
  const bases = spindleBasesAt(itemLevel);
  const base = bases[rng.int(bases.length)]!;
  const level = Math.max(itemLevel, spindles[base].itemLevel);
  return rolledItem(state, base, 'spindle', rollRarity(rng, weights), level);
}

/** A random cloak, hood, boots or charm for an item level, its rarity rolled from `weights`. */
export function rollGear(state: GameState, itemLevel: number, weights: RarityWeights): Item {
  const rng = state.lootRng;
  const bases: GearBaseDef[] = Object.values(gearBases).filter((b) => b.itemLevel <= itemLevel);
  const def = bases[rng.int(bases.length)]!;
  return rolledItem(state, def.id, def.kind, rollRarity(rng, weights), itemLevel);
}

/** A crafting currency picked by dropWeight. */
export function rollCurrency(rng: Rng): CurrencyId {
  let total = 0;
  for (const id of currencyIds) total += currencies[id].dropWeight;
  let r = rng.float() * total;
  for (const id of currencyIds) {
    r -= currencies[id].dropWeight;
    if (r < 0) return id;
  }
  return currencyIds[currencyIds.length - 1]!;
}

/** Rarity weights with Magic and Rare × `mult` (rift item rarity); the same object when 1. */
function rarer(w: RarityWeights, mult: number): RarityWeights {
  return mult === 1 ? w : { normal: w.normal, magic: w.magic * mult, rare: w.rare * mult };
}

function rarityKey(e: Enemy): EnemyRarity | 'boss' {
  return bossKinds.includes(e.kind) ? 'boss' : e.rarity;
}

/** What one enemy's death drops, in roll order. Pure apart from the loot RNG and uids. */
export function rollKillLoot(state: GameState, e: Enemy): LootContent[] {
  const rng = state.lootRng;
  const out: LootContent[] = [];
  const key = rarityKey(e);
  const mult = dropRates.kindMult[e.kind] ?? 1;
  if (mult <= 0) return out;
  const level = e.areaLevel;
  const part = partDroppedBy(e.kind);
  const c = dropRates.chance;
  if (key === 'boss' && part && rng.chance(dropRates.bossPartChance))
    out.push({ kind: 'part', part: makePart(state.hero, part, partTierFor(level)) });
  const rolls = key === 'boss' ? dropRates.bossRolls : dropRates.rolls[key];
  // Rift modifiers (M6): item quantity scales every category's chance, item rarity the Magic and
  // Rare weights and the unique chance; a rift also drops Rift Sigils.
  const rift = state.world.rift;
  const rules = riftRules(state);
  const qty = mult * (1 + rules.quantity);
  const rar = 1 + rules.rarity;
  for (let i = 0; i < rolls; i++) {
    if (rng.chance(c.rune * mult)) {
      const unlocked = state.hero.unlockedRunes;
      if (unlocked.length > 0)
        out.push({ kind: 'rune', rune: makeRune(state.hero, unlocked[rng.int(unlocked.length)]!) });
    }
    const weights = rarer(dropRates.itemRarity[key], rar);
    if (rng.chance(c.gear * qty)) out.push({ kind: 'item', item: rollGear(state, level, weights) });
    if (rng.chance(c.spindle * qty)) out.push({ kind: 'item', item: rollSpindle(state, level, weights) });
    if (part && rng.chance(c.part * qty))
      out.push({ kind: 'part', part: makePart(state.hero, part, partTierFor(level)) });
    if (rng.chance(c.scrap * qty)) {
      const { min, max } = dropRates.scrapAmount;
      out.push({ kind: 'scrap', amount: min + rng.int(max - min + 1) });
    }
    if (rng.chance(c.currency * qty)) out.push({ kind: 'currency', currency: rollCurrency(rng), amount: 1 });
    if (rng.chance(c.unique * qty * rar)) {
      const u = rollUnique(state, level);
      if (u) out.push({ kind: 'item', item: u });
    }
    if (rift && isRiftRoomId(state.room.id) && rng.chance(riftDrops.sigilChance * qty)) {
      const up = rng.chance(riftDrops.tierUpChance) ? 1 : 0;
      out.push({ kind: 'sigil', sigil: rollSigil(state.hero, rng, rift.spec.tier + up) });
    }
  }
  // M5 rune discovery (data/progression.ts runeDiscovery): Rares sometimes, bosses always.
  const discover =
    key === 'boss' ? runeDiscovery.bossCount : key === 'rare' && rng.chance(runeDiscovery.rareChance) ? 1 : 0;
  for (let i = 0; i < discover; i++) {
    const r = rollDiscovery(state, level, out);
    if (r) out.push({ kind: 'rune', rune: makeRune(state.hero, r) });
  }
  if (key === 'boss' && rng.chance(dropRates.bossUniqueChance)) {
    const u = rollUnique(state, level);
    if (u) out.push({ kind: 'item', item: u });
  }
  return out;
}

/**
 * A locked M5 rune the area level allows (not unlocked and not already in `pending` drops),
 * picked evenly with the loot RNG, or null when none is left.
 */
export function rollDiscovery(
  state: GameState,
  areaLevel: number,
  pending: readonly LootContent[],
): RuneId | null {
  const have = new Set<string>(state.hero.unlockedRunes);
  for (const c of pending) if (c.kind === 'rune') have.add(c.rune.rune);
  for (const d of state.loot) if (d.content.kind === 'rune') have.add(d.content.rune.rune);
  const list = (Object.entries(runeDiscovery.from) as [RuneId, number][])
    .filter(([id, from]) => from <= areaLevel && !have.has(id))
    .map(([id]) => id);
  if (list.length === 0) return null;
  return list[state.lootRng.int(list.length)]!;
}

/** Rolls an enemy's drops and puts them on the floor around its body. */
export function dropKillLoot(state: GameState, e: Enemy): void {
  rollKillLoot(state, e).forEach((c, i) => dropLoot(state, e.x, e.y, c, i));
}
