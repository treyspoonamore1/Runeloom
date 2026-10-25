/**
 * Pure view models of the Hearth screens (M7): tabs, station routing, number and time formatting,
 * count-up easing, expedition rows and the offline summary. No DOM; the panels only draw these.
 */
import { runeGarden, type StationId } from '../../../data/hearth';
import { gardenPlots } from '../../sim/meta/view';
import type { OfflineGains } from '../../app/hearth';
import type { Expedition } from '../../sim/meta/types';
import type { HearthTab } from './hearthSignals';

export const HEARTH_TABS: ReadonlyArray<{ id: HearthTab; label: string; blurb: string }> = [
  { id: 'buildings', label: 'Buildings', blurb: 'Spend Embers to make the Hearth produce more' },
  { id: 'garden', label: 'Rune Garden', blurb: 'Planted runes gain XP every minute' },
  { id: 'expeditions', label: 'Expeditions', blurb: 'Hired Weavers run timed rifts for you' },
  { id: 'salvage', label: 'Salvage Loom', blurb: 'Turns gear you pick up into Thread Scrap' },
  { id: 'spindlewright', label: 'Spindlewright', blurb: 'Crafting currencies for Thread Scrap' },
  { id: 'rekindle', label: 'Rekindle', blurb: 'Reset the Hearth for Ash and Mutations' },
  { id: 'cartographer', label: 'Cartographer', blurb: 'Open rifts with your sigils' },
];

/** The sub-tab a hub station opens (the Interact event's station). */
export function tabForStation(station: StationId): HearthTab {
  switch (station) {
    case 'spindlewright':
      return 'spindlewright';
    case 'runekeeper':
    case 'rune_garden':
      return 'garden';
    case 'expedition_board':
      return 'expeditions';
    case 'kindling_pit':
      return 'buildings';
    case 'salvage_loom':
      return 'salvage';
    case 'hearth_fire':
      return 'rekindle';
    case 'cartographer':
      return 'cartographer';
  }
}

const NUM = new Intl.NumberFormat('en-US');

/** 12345 → "12,345"; fractions are rounded. */
export const fmtNum = (n: number): string => NUM.format(Math.round(n));

/** Compact for the HUD: 1234 → "1,234", 12 500 → "12.5k", 3 400 000 → "3.4M". */
export function fmtCompact(n: number): string {
  const v = Math.round(n);
  if (v < 10_000) return NUM.format(v);
  if (v < 1_000_000) return `${trim1(v / 1000)}k`;
  return `${trim1(v / 1_000_000)}M`;
}
const trim1 = (x: number): string => String(Math.round(x * 10) / 10);

/** Seconds as "45s", "9m 30s", "1h 02m". Rounds up so a countdown never shows 0 early. */
export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (s < 3600) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** Time away for the offline modal: "3 hours 12 minutes", "45 minutes", "1 minute". */
export function fmtAway(seconds: number): string {
  const mins = Math.max(1, Math.floor(seconds / 60));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hs = `${h} hour${h === 1 ? '' : 's'}`;
  const ms = `${m} minute${m === 1 ? '' : 's'}`;
  if (h === 0) return ms;
  return m === 0 ? hs : `${hs} ${ms}`;
}

/** "+2.4 a minute"; one decimal under 10, none above. */
export function fmtRate(perMinute: number, what: string): string {
  const v = perMinute < 10 ? (Math.round(perMinute * 10) / 10).toFixed(1) : String(Math.round(perMinute));
  return `${v} ${what} a minute`;
}

/** Ease-out cubic of t in [0, 1]. */
export const easeOut = (t: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** The number shown `t` (0..1) of the way from `from` to `to`; whole numbers, exact at the ends. */
export function countUp(from: number, to: number, t: number): number {
  if (t >= 1 || from === to) return to;
  if (t <= 0) return from;
  return Math.round(from + (to - from) * easeOut(t));
}

/** How long a count-up from `from` to `to` takes: longer for bigger jumps, within 0.25 to 0.9 s. */
export function countUpMs(from: number, to: number): number {
  const d = Math.abs(to - from);
  return Math.min(900, 250 + Math.log10(1 + d) * 220);
}

export interface ExpeditionRow {
  uid: number;
  tier: number;
  ready: boolean;
  /** Elapsed share 0..1. */
  frac: number;
  /** "9m 30s left", or "Back". */
  text: string;
  /** The cycle it was sent in (Rekindles then): one from before the last Rekindle brings no sigil. */
  cycle: number;
}

/** Expeditions as rows: ready ones first (they wait on the player), then the soonest back. */
export function expeditionRows(list: readonly Expedition[]): ExpeditionRow[] {
  return list
    .map((e) => {
      const ready = e.left <= 0;
      const frac = ready || e.duration <= 0 ? 1 : Math.min(1, Math.max(0, 1 - e.left / e.duration));
      return {
        uid: e.uid,
        tier: e.tier,
        ready,
        frac,
        text: ready ? 'Back: ready to collect' : `${fmtDuration(e.left)} left`,
        cycle: e.cycle,
      };
    })
    .sort((a, b) => Number(b.ready) - Number(a.ready) || b.frac - a.frac);
}

/** The tiers an expedition can be sent on, 1..maxTier, with their durations. */
export function sendOptions(
  maxTier: number,
  seconds: (tier: number) => number,
): Array<{ tier: number; text: string }> {
  const out: Array<{ tier: number; text: string }> = [];
  for (let t = 1; t <= Math.max(1, maxTier); t++) out.push({ tier: t, text: fmtDuration(seconds(t)) });
  return out;
}

/** Share 0..1 of the way to affording `cost` with `have`. */
export const affordFrac = (have: number, cost: number | null): number =>
  cost === null || cost <= 0 ? 1 : Math.min(1, Math.max(0, have / cost));

/** The "While you were away" lines; skips what is zero. */
export function offlineLines(g: OfflineGains): string[] {
  const out: string[] = [];
  if (g.scrap > 0) out.push(`+${fmtNum(g.scrap)} Thread Scrap from the Kindling Pit`);
  if (g.runeXp > 0)
    out.push(
      `+${fmtNum(g.runeXp)} rune XP in the Rune Garden${g.runeLevels > 0 ? ` (${g.runeLevels} level${g.runeLevels === 1 ? '' : 's'} gained)` : ''}`,
    );
  if (g.expeditionsReturned > 0)
    out.push(
      `${g.expeditionsReturned} expedition${g.expeditionsReturned === 1 ? '' : 's'} came back: collect ${g.expeditionsReturned === 1 ? 'it' : 'them'} at the Expedition Board`,
    );
  return out;
}

/** The sub-tab labels get a dot when something waits there. */
export function tabAttention(ready: number): Partial<Record<HearthTab, number>> {
  return ready > 0 ? { expeditions: ready } : {};
}

/** The Rune Garden level that adds the next plot, or null at the most plots. */
export function nextPlotLevel(level: number): number | null {
  const have = gardenPlots(Math.max(1, level));
  if (have >= runeGarden.maxPlots) return null;
  for (let l = Math.max(1, level) + 1; l <= 60; l++) if (gardenPlots(l) > have) return l;
  return null;
}

/** "2 Fuse parts, 3 currency, 45 Embers": what an expedition brings back. */
export function rewardText(r: { parts: number; currency: number; embers: number; sigils?: number }): string {
  const sigils = r.sigils ? `, ${r.sigils} Rift Sigil${r.sigils === 1 ? '' : 's'}` : '';
  return `${r.parts} Fuse part${r.parts === 1 ? '' : 's'}, ${r.currency} currency${sigils}, ${fmtNum(r.embers)} Embers`;
}
