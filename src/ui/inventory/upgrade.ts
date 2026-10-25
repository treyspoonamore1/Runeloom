/**
 * Upgrade markers (M7.5): does swapping an unequipped item into its slot improve on what you
 * wear? The answer is a score over the rows of the character sheet (stats.ts statRows) weighted by
 * data/ui.ts inventoryUi.upgrade, so it counts exactly what the sheet shows, resistances only up
 * to their cap. Pure; `upgradeInfo` caches one answer per item for each hero revision.
 */
import { inventoryUi } from '../../../data/ui';
import type { Tuning } from '../../../data/tuning';
import type { HeroMods } from '../../sim/hero/mods';
import type { EquipSlot, HeroState, Item } from '../../sim/hero/types';
import { diffStats, statRows, withEquipped, type StatRow } from './stats';

type Weights = Record<string, number>;

export interface Weighting {
  perUnit: Weights;
  perPoint: Weights;
  minGain: number;
}

export const DEFAULT_WEIGHTING: Weighting = inventoryUi.upgrade;

/** Sum of weight × value over the sheet rows (percent rows count per percentage point). */
export function scoreRows(rows: readonly StatRow[], w: Weighting = DEFAULT_WEIGHTING): number {
  let total = 0;
  for (const r of rows) {
    const flat = w.perUnit[r.key];
    if (flat !== undefined) total += flat * r.value;
    const pt = w.perPoint[r.key];
    if (pt !== undefined) total += pt * r.value * 100;
  }
  return total;
}

/**
 * 'up': the score rises by at least `minGain`. 'down': strictly worse, every changed stat is
 * worse. 'same': otherwise, including trades that gain a little and lose a little.
 */
export type Verdict = 'up' | 'down' | 'same';

export interface UpgradeInfo {
  /** The slot the item would go in: an empty one, else the one it improves most (the weaker charm). */
  slot: EquipSlot | null;
  /** Score change in that slot. */
  gain: number;
  verdict: Verdict;
}

export interface UpgradeCtx {
  hero: Readonly<HeroState>;
  modsFor(h: Readonly<HeroState>): HeroMods;
  tuning: Tuning;
  weighting?: Weighting;
}

interface Swap extends UpgradeInfo {
  slot: EquipSlot;
  better: boolean;
  worse: boolean;
}

function trySwap(ctx: UpgradeCtx, base: readonly StatRow[], item: Item, slot: EquipSlot): Swap {
  const w = ctx.weighting ?? DEFAULT_WEIGHTING;
  const after = withEquipped(ctx.hero, item, slot);
  const rows = statRows(after, ctx.modsFor(after), ctx.tuning);
  const deltas = diffStats(base, rows);
  const gain = scoreRows(rows, w) - scoreRows(base, w);
  const better = deltas.some((d) => d.good);
  const worse = deltas.some((d) => !d.good);
  const verdict: Verdict = gain >= w.minGain ? 'up' : worse && !better ? 'down' : 'same';
  return { slot, gain, verdict, better, worse };
}

/** Rows of the current hero (the baseline of every swap). */
function baseRows(ctx: UpgradeCtx): StatRow[] {
  return statRows(ctx.hero, ctx.modsFor(ctx.hero), ctx.tuning);
}

/** How equipping `item` (unequipped) would change things, in the slot that suits it best. */
export function evaluateItem(
  ctx: UpgradeCtx,
  item: Item,
  slots: readonly EquipSlot[],
  base: readonly StatRow[] = baseRows(ctx),
): UpgradeInfo {
  const options = slots.filter((s) => ctx.hero.equipped[s] !== item.uid);
  if (options.length === 0) return { slot: null, gain: 0, verdict: 'same' };
  const empty = options.find((s) => ctx.hero.equipped[s] === null);
  if (empty !== undefined) {
    const { slot, gain, verdict } = trySwap(ctx, base, item, empty);
    return { slot, gain, verdict };
  }
  let best: Swap | null = null;
  for (const s of options) {
    const r = trySwap(ctx, base, item, s);
    if (!best || r.gain > best.gain) best = r;
  }
  return { slot: best!.slot, gain: best!.gain, verdict: best!.verdict };
}

/** The slot a click or right-click equips the item into: its only slot, an empty one, else the weaker charm. */
export function bestSlot(ctx: UpgradeCtx, item: Item, slots: readonly EquipSlot[]): EquipSlot | null {
  if (slots.length <= 1) return slots[0] ?? null;
  return evaluateItem(ctx, item, slots).slot;
}

// ---- Cache: one answer per item for each hero revision ----

let cached: {
  rev: number;
  hero: object;
  count: number;
  tuning: object;
  base: StatRow[];
  byUid: Map<number, UpgradeInfo>;
} | null = null;

/** `evaluateItem`, remembered until `rev` (heroRev), the hero object or the tuning changes. */
export function upgradeInfo(
  rev: number,
  ctx: UpgradeCtx,
  item: Item,
  slots: readonly EquipSlot[],
): UpgradeInfo {
  if (
    !cached ||
    cached.rev !== rev ||
    cached.hero !== ctx.hero ||
    cached.count !== ctx.hero.items.length ||
    cached.tuning !== ctx.tuning
  )
    cached = {
      rev,
      hero: ctx.hero,
      count: ctx.hero.items.length,
      tuning: ctx.tuning,
      base: baseRows(ctx),
      byUid: new Map(),
    };
  let info = cached.byUid.get(item.uid);
  if (!info) {
    info = evaluateItem(ctx, item, slots, cached.base);
    cached.byUid.set(item.uid, info);
  }
  return info;
}

/** Forgets every cached answer (tests). */
export function resetUpgradeCache(): void {
  cached = null;
}
