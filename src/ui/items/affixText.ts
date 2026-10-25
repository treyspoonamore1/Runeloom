/**
 * Affix lines with their tier and roll range (M7.5 menu pass), shared by the inventory tooltips and
 * the crafting bench. Pure: reads data/affixes.ts and the stat text of the sim.
 *
 * Tier 1 is the best tier (data/affixes.ts). A roll's range is its tier's `min`–`max` in display
 * units, the same units as the rolled value ("+26 to maximum life (T3: 20–29)").
 *
 *   affixText(roll)            "+26 to maximum life (T3: 20–29)"
 *   affixText(roll, 'tier')    "+26 to maximum life (T3)"
 *   affixText(roll, 'plain')   "+26 to maximum life"
 *   affixParts(roll)           { text, tier, range, label: "T3: 20–29", side, roll } for rich rendering
 *   tierRange(id, tier)        { tier, itemLevel, min, max } or null
 *   itemLines(item, lines)     describeItem's line strings as typed lines, affix lines with their parts
 */
import { affixes, isAffixId } from '../../../data/affixes';
import { baseImplicits } from '../../sim/hero/aggregate';
import { statLine } from '../../sim/hero/stats';
import type { AffixRoll, Item } from '../../sim/hero/types';

export interface TierRange {
  tier: number;
  /** Lowest item level this tier rolls on. */
  itemLevel: number;
  min: number;
  max: number;
}

/** What `affixText` adds after the stat text. */
export type AffixTextMode = 'plain' | 'tier' | 'range';

export interface AffixParts {
  /** The stat line without tier or range: "+26 to maximum life". */
  text: string;
  tier: number;
  /** The tier's roll range, or null when the tier isn't in the data (an old save). */
  range: TierRange | null;
  /** "T3: 20–29", or "T3" without a known range. */
  label: string;
  side: 'prefix' | 'suffix';
  /** Where the value sits in its range, 0 (lowest) to 1 (highest); null without a range or a single-value range. */
  roll: number | null;
}

/** "20–29", or "5" when the tier rolls one value. */
export function rangeText(r: { min: number; max: number }): string {
  return r.min === r.max ? String(r.min) : `${r.min}–${r.max}`;
}

export function tierRange(affixId: string, tier: number): TierRange | null {
  if (!isAffixId(affixId)) return null;
  const t = affixes[affixId].tiers.find((x) => x.tier === tier);
  return t ? { tier: t.tier, itemLevel: t.itemLevel, min: t.min, max: t.max } : null;
}

/** The parts of an affix line; null when the id isn't an affix of data/affixes.ts. */
export function affixParts(a: AffixRoll): AffixParts | null {
  if (!isAffixId(a.id)) return null;
  const def = affixes[a.id];
  const range = tierRange(a.id, a.tier);
  const roll =
    range && range.max > range.min
      ? Math.min(1, Math.max(0, (a.value - range.min) / (range.max - range.min)))
      : null;
  return {
    text: statLine(def.stat, a.value),
    tier: a.tier,
    range,
    label: range ? `T${a.tier}: ${rangeText(range)}` : `T${a.tier}`,
    side: def.kind,
    roll,
  };
}

/** One affix as text, with its tier and range in brackets by default. */
export function affixText(a: AffixRoll, mode: AffixTextMode = 'range'): string {
  const p = affixParts(a);
  if (!p) return a.id;
  if (mode === 'plain') return p.text;
  return `${p.text} (${mode === 'tier' ? `T${p.tier}` : p.label})`;
}

export type ItemLineKind = 'implicit' | 'affix' | 'unique' | 'fused' | 'plain';

/** A line of an item tooltip. Affix lines carry their parts for the tier and range text. */
export interface ItemLine {
  kind: ItemLineKind;
  /** The line as describeItem wrote it. */
  text: string;
  affix?: AffixParts;
}

/**
 * Types the `lines` of describeItem(item) (src/sim/items/describe.ts): implicits, then the known
 * affixes in order, then a unique's stats and text, then fused-part and socket lines. Lines that
 * don't fit that layout (fixture items) come back as 'plain'.
 */
export function itemLines(item: Item, lines: readonly string[]): ItemLine[] {
  const known = item.affixes.filter((a) => isAffixId(a.id));
  const nImplicit = baseImplicits(item.base).length;
  if (lines.length < nImplicit + known.length || known.length !== item.affixes.length)
    return lines.map((text) => ({ kind: 'plain', text }));
  return lines.map((text, i): ItemLine => {
    if (i < nImplicit) return { kind: 'implicit', text };
    const a = known[i - nImplicit];
    if (a) return { kind: 'affix', text, affix: affixParts(a)! };
    return { kind: /^(Fused:|Socket \d+:)/.test(text) ? 'fused' : 'unique', text };
  });
}
