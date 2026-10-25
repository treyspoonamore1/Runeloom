/**
 * One rolled affix as the crafting bench shows it: its stat line, side and tier, and the range
 * its tier rolls in (data/affixes.ts). LOCAL formatter: the bench keeps its own until the
 * shared src/ui/items/affixText.ts lands, then this file can delegate to it.
 */
import { affixes, isAffixId } from '../../../data/affixes';
import { statLine } from '../../sim/hero/stats';
import type { AffixRoll, Item } from '../../sim/hero/types';
import { tiersAt } from '../../sim/items/affixRoll';

export interface AffixView {
  /** What makes two lines "the same" in a before/after diff: affix, tier and rolled value. */
  key: string;
  text: string;
  side: 'prefix' | 'suffix' | null;
  tier: number | null;
  /** The tier's roll range, "11–16", or null for lines that aren't rolled affixes. */
  range: string | null;
  /** Hover text: side, tier, range, and the best tier this item level can roll. */
  hint: string;
}

export function affixLine(affix: AffixRoll, item: Pick<Item, 'itemLevel'>): AffixView {
  const key = `${affix.id}|${affix.tier}|${affix.value}`;
  if (!isAffixId(affix.id)) return { key, text: affix.id, side: null, tier: affix.tier, range: null, hint: '' };
  const def = affixes[affix.id];
  const tier = def.tiers.find((t) => t.tier === affix.tier);
  const range = tier ? (tier.min === tier.max ? `${tier.min}` : `${tier.min}–${tier.max}`) : null;
  const side = def.kind === 'prefix' ? 'Prefix' : 'Suffix';
  const best = tiersAt(def, item.itemLevel)[0];
  const parts = [`${side}, tier ${affix.tier}`];
  if (range) parts.push(`rolls ${range}`);
  if (tier) parts.push(`needs item level ${tier.itemLevel}`);
  if (best) parts.push(`best tier at item level ${item.itemLevel}: ${best.tier}`);
  return {
    key,
    text: statLine(def.stat, affix.value),
    side: def.kind,
    tier: affix.tier,
    range,
    hint: parts.join(' · '),
  };
}

/** A plain line (a rune's quality bonus) in the same shape, so diffs treat all targets alike. */
export function plainLine(text: string): AffixView {
  return { key: `text|${text}`, text, side: null, tier: null, range: null, hint: '' };
}
