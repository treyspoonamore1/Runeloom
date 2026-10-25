/**
 * Before and after of a craft: a snapshot of the target's affix lines, a diff that marks lines
 * added (new) and lines lost (gone), and the one-line outcome ("Magic → Rare", "rerolled 4 affixes").
 * Pure: snapshots copy what they show, so a later craft can't change an earlier result.
 */
import { getRune } from '../../../data/runes';
import type { CurrencyId } from '../../../data/currency';
import type { HeroState, ItemRarity } from '../../sim/hero/types';
import { itemDescription, runeDescription } from '../inventory/adapter';
import { affixLine, plainLine, type AffixView } from './affixLine';

export interface Snapshot {
  uid: number;
  kind: 'item' | 'rune';
  name: string;
  /** Items: their rarity; runes have none. */
  rarity: ItemRarity | null;
  /** Rune quality in %, for Rune Polish. */
  quality: number | null;
  lines: AffixView[];
}

/** The item or rune with `uid` as it is now, or null when the hero has neither. */
export function snapshotOf(hero: Readonly<HeroState>, uid: number): Snapshot | null {
  const it = hero.items.find((x) => x.uid === uid);
  if (it)
    return {
      uid,
      kind: 'item',
      name: itemDescription(it).name,
      rarity: it.rarity,
      quality: null,
      lines: it.affixes.map((a) => affixLine(a, it)),
    };
  const r = hero.runes.find((x) => x.uid === uid);
  if (!r) return null;
  const d = runeDescription(r);
  const bonus = d.lines.filter((l) => l.endsWith('(quality)'));
  return {
    uid,
    kind: 'rune',
    name: getRune(r.rune)?.name ?? d.name,
    rarity: null,
    quality: r.quality,
    lines: [plainLine(`Quality ${r.quality}%`), ...bonus.map(plainLine)],
  };
}

export type Mark = 'same' | 'new' | 'gone';
export interface DiffRow {
  line: AffixView;
  mark: Mark;
}

/**
 * Pairs lines of `before` and `after` by key (a line that appears twice pairs twice). Lines left
 * unpaired in `before` are gone, in `after` are new; paired lines are the same.
 */
export function diffLines(before: readonly AffixView[], after: readonly AffixView[]): { before: DiffRow[]; after: DiffRow[] } {
  const pair = (from: readonly AffixView[], against: readonly AffixView[], other: Mark): DiffRow[] => {
    const pool: (string | null)[] = against.map((l) => l.key);
    return from.map((line) => {
      const i = pool.indexOf(line.key);
      if (i < 0) return { line, mark: other };
      pool[i] = null;
      return { line, mark: 'same' };
    });
  };
  return { before: pair(before, after, 'gone'), after: pair(after, before, 'new') };
}

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const affixes = (n: number) => `${n} affix${n === 1 ? '' : 'es'}`;

/** What the craft did, in a few words. */
export function outcomeText(currency: CurrencyId, before: Snapshot, after: Snapshot): string {
  if (before.rarity && after.rarity && before.rarity !== after.rarity)
    return `${cap(before.rarity)} → ${cap(after.rarity)} · ${affixes(after.lines.length)}`;
  switch (currency) {
    case 'spool_of_change':
    case 'chaos_skein':
      return `rerolled ${affixes(after.lines.length)}`;
    case 'golden_needle':
      return 'added 1 affix';
    case 'unpick':
      return 'removed 1 affix';
    case 'rune_polish':
      return `Quality ${before.quality ?? 0}% → ${after.quality ?? 0}%`;
    default:
      return 'no change';
  }
}

/** The last craft, kept until the next one. */
export interface CraftResult {
  n: number;
  uid: number;
  currency: CurrencyId;
  outcome: string;
  before: Snapshot;
  after: Snapshot;
  diff: { before: DiffRow[]; after: DiffRow[] };
}

export function buildResult(n: number, currency: CurrencyId, before: Snapshot, after: Snapshot): CraftResult {
  return {
    n,
    uid: after.uid,
    currency,
    outcome: outcomeText(currency, before, after),
    before,
    after,
    diff: diffLines(before.lines, after.lines),
  };
}
