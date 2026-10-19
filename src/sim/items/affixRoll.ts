/**
 * Rolling affixes (DESIGN §8.2, CONTENT §3): each item kind has its own pool; tiers are gated by
 * item level; affixes in the same group can't both roll. All rolls use the loot RNG stream.
 */
import { affixCounts, affixes, magicBothChance, type AffixDef, type AffixTier } from '../../../data/affixes';
import type { ItemKind } from '../../../data/items';
import type { Rng } from '../core/rng';
import type { AffixRoll } from '../hero/types';

const ALL: readonly AffixDef[] = Object.values(affixes);

/** Tiers of an affix that can roll at an item level, best first. */
export function tiersAt(def: AffixDef, itemLevel: number): AffixTier[] {
  return def.tiers.filter((t) => t.itemLevel <= itemLevel);
}

/** Affixes of a kind ('prefix' or 'suffix') that can roll on `itemKind` at `itemLevel`, outside `usedGroups`. */
export function eligibleAffixes(
  itemKind: ItemKind,
  which: 'prefix' | 'suffix',
  itemLevel: number,
  usedGroups: ReadonlySet<string>,
  pool: readonly AffixDef[] = ALL,
): AffixDef[] {
  return pool.filter(
    (a) =>
      a.kind === which &&
      a.kinds.includes(itemKind) &&
      !usedGroups.has(a.group) &&
      a.tiers.some((t) => t.itemLevel <= itemLevel),
  );
}

function pickWeighted(rng: Rng, list: readonly AffixDef[]): AffixDef {
  let total = 0;
  for (const a of list) total += a.weight;
  let r = rng.float() * total;
  for (const a of list) {
    r -= a.weight;
    if (r < 0) return a;
  }
  return list[list.length - 1]!;
}

/** One affix roll: a weighted affix, a uniform tier among those the item level allows, a whole value in its range. */
function rollOne(rng: Rng, list: readonly AffixDef[], itemLevel: number): AffixRoll {
  const def = pickWeighted(rng, list);
  const tiers = tiersAt(def, itemLevel);
  const tier = tiers[rng.int(tiers.length)]!;
  const value = tier.min + rng.int(tier.max - tier.min + 1);
  return { id: def.id, tier: tier.tier, value };
}

/**
 * Rolls up to `prefixes` prefixes then up to `suffixes` suffixes (fewer if the pool runs out),
 * never two from one group.
 */
export function rollAffixSet(
  rng: Rng,
  itemKind: ItemKind,
  itemLevel: number,
  prefixes: number,
  suffixes: number,
  pool: readonly AffixDef[] = ALL,
): AffixRoll[] {
  const out: AffixRoll[] = [];
  const used = new Set<string>();
  const byId = new Map(pool.map((a) => [a.id, a]));
  const roll = (which: 'prefix' | 'suffix', n: number) => {
    for (let i = 0; i < n; i++) {
      const list = eligibleAffixes(itemKind, which, itemLevel, used, pool);
      if (list.length === 0) return;
      const r = rollOne(rng, list, itemLevel);
      used.add(byId.get(r.id)!.group);
      out.push(r);
    }
  };
  roll('prefix', prefixes);
  roll('suffix', suffixes);
  return out;
}

/** A Magic item's affixes: both a prefix and a suffix (magicBothChance), else one of them, never none. */
export function rollMagicAffixes(rng: Rng, itemKind: ItemKind, itemLevel: number): AffixRoll[] {
  const max = affixCounts.magic;
  let p: number = max.prefixes;
  let s: number = max.suffixes;
  if (!rng.chance(magicBothChance)) {
    if (rng.chance(0.5)) p = 0;
    else s = 0;
  }
  const out = rollAffixSet(rng, itemKind, itemLevel, p, s);
  // A pool with no suffix (or prefix) for this kind still yields at least one affix.
  if (out.length === 0) return rollAffixSet(rng, itemKind, itemLevel, max.prefixes - p, max.suffixes - s);
  return out;
}
