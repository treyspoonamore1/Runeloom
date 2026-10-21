/**
 * Rare items (DESIGN §8.2, M5): up to 3 prefixes and 3 suffixes, a rolled name. Also the one-affix
 * roll that Golden Needles and Rare rolls share. Pure apart from the RNG passed in.
 */
import { affixCounts, affixes, isAffixId, type AffixDef } from '../../../data/affixes';
import { rareAffixCount, rareNameWords } from '../../../data/currency';
import type { ItemKind } from '../../../data/items';
import type { Rng } from '../core/rng';
import type { AffixRoll } from '../hero/types';
import { eligibleAffixes, rollAffixFrom } from './affixRoll';

const ALL: readonly AffixDef[] = Object.values(affixes);

/** Max prefixes and suffixes for a rarity that has affixes. */
function limitsOf(rarity: 'magic' | 'rare'): { prefix: number; suffix: number } {
  const c = affixCounts[rarity];
  return { prefix: c.prefixes, suffix: c.suffixes };
}

/** Groups and per-side counts of an affix list, looking ids up in `pool`. */
function usage(
  list: readonly AffixRoll[],
  pool: readonly AffixDef[],
): { groups: Set<string>; prefix: number; suffix: number } {
  const groups = new Set<string>();
  let prefix = 0;
  let suffix = 0;
  for (const a of list) {
    const def = pool.find((d) => d.id === a.id);
    if (!def) continue;
    groups.add(def.group);
    if (def.kind === 'prefix') prefix++;
    else suffix++;
  }
  return { groups, prefix, suffix };
}

/**
 * The sides a new affix could go on: a side counts when it has a free slot and at least one
 * affix that can roll there (right kind, item level, no group already on the item).
 */
export function openSides(
  itemKind: ItemKind,
  itemLevel: number,
  rarity: 'magic' | 'rare',
  existing: readonly AffixRoll[],
  pool: readonly AffixDef[] = ALL,
): ('prefix' | 'suffix')[] {
  const lim = limitsOf(rarity);
  const u = usage(existing, pool);
  const out: ('prefix' | 'suffix')[] = [];
  if (u.prefix < lim.prefix && eligibleAffixes(itemKind, 'prefix', itemLevel, u.groups, pool).length > 0)
    out.push('prefix');
  if (u.suffix < lim.suffix && eligibleAffixes(itemKind, 'suffix', itemLevel, u.groups, pool).length > 0)
    out.push('suffix');
  return out;
}

/**
 * Rolls one more affix for an item: a side chosen evenly among the open ones, then a weighted
 * affix on that side. Null when no affix can be added.
 */
export function rollExtraAffix(
  rng: Rng,
  itemKind: ItemKind,
  itemLevel: number,
  rarity: 'magic' | 'rare',
  existing: readonly AffixRoll[],
  pool: readonly AffixDef[] = ALL,
): AffixRoll | null {
  const sides = openSides(itemKind, itemLevel, rarity, existing, pool);
  if (sides.length === 0) return null;
  const side = sides[rng.int(sides.length)]!;
  const list = eligibleAffixes(itemKind, side, itemLevel, usage(existing, pool).groups, pool);
  return rollAffixFrom(rng, list, itemLevel);
}

/** How many affixes a new Rare aims for (data/currency.ts rareAffixCount). */
export function rollRareCount(rng: Rng): number {
  let total = 0;
  for (const c of rareAffixCount) total += c.weight;
  let r = rng.float() * total;
  for (const c of rareAffixCount) {
    r -= c.weight;
    if (r < 0) return c.count;
  }
  return rareAffixCount[rareAffixCount.length - 1]!.count;
}

/**
 * A Rare item's affixes: rollRareCount affixes, each added with rollExtraAffix, so prefixes and
 * suffixes come out about even. Fewer when the kind's pool runs out (boots have one prefix).
 */
export function rollRareAffixes(
  rng: Rng,
  itemKind: ItemKind,
  itemLevel: number,
  pool: readonly AffixDef[] = ALL,
): AffixRoll[] {
  const want = rollRareCount(rng);
  const out: AffixRoll[] = [];
  for (let i = 0; i < want; i++) {
    const a = rollExtraAffix(rng, itemKind, itemLevel, 'rare', out, pool);
    if (!a) break;
    out.push(a);
  }
  return sortAffixes(out);
}

/** Prefixes first, then suffixes, each in roll order (tooltips list them this way). */
export function sortAffixes(list: AffixRoll[]): AffixRoll[] {
  const side = (a: AffixRoll) => (isAffixId(a.id) && affixes[a.id].kind === 'suffix' ? 1 : 0);
  return list
    .map((a, i) => ({ a, i }))
    .sort((x, y) => side(x.a) - side(y.a) || x.i - y.i)
    .map((x) => x.a);
}

/** A Rare name for an item kind: "<first> <second>" (data/currency.ts rareNameWords). */
export function rollRareName(rng: Rng, itemKind: ItemKind): string {
  const first = rareNameWords.first[rng.int(rareNameWords.first.length)]!;
  const seconds = rareNameWords.second[itemKind];
  return `${first} ${seconds[rng.int(seconds.length)]!}`;
}
