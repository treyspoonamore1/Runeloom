/**
 * One rolled affix as the crafting bench shows it: its stat line, side and tier, and the range
 * its tier rolls in (data/affixes.ts). Built on the shared src/ui/items/affixText.ts; this adds
 * the diff key, the bench's hover text and the unknown-id fallback.
 */
import { affixes, type AffixId } from '../../../data/affixes';
import type { AffixRoll, Item } from '../../sim/hero/types';
import { tiersAt } from '../../sim/items/affixRoll';
import { affixParts, rangeText } from '../items/affixText';

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
  const p = affixParts(affix);
  if (!p) return { key, text: affix.id, side: null, tier: affix.tier, range: null, hint: '' };
  const range = p.range ? rangeText(p.range) : null;
  const best = tiersAt(affixes[affix.id as AffixId], item.itemLevel)[0];
  const parts = [`${p.side === 'prefix' ? 'Prefix' : 'Suffix'}, tier ${affix.tier}`];
  if (range) parts.push(`rolls ${range}`);
  if (p.range) parts.push(`needs item level ${p.range.itemLevel}`);
  if (best) parts.push(`best tier at item level ${item.itemLevel}: ${best.tier}`);
  return { key, text: p.text, side: p.side, tier: affix.tier, range, hint: parts.join(' · ') };
}

/** A plain line (a rune's quality bonus) in the same shape, so diffs treat all targets alike. */
export function plainLine(text: string): AffixView {
  return { key: `text|${text}`, text, side: null, tier: null, range: null, hint: '' };
}
