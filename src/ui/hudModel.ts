/**
 * Pure helpers for the HUD: number formatting, the per-frame snapshot of what the HUD shows, and
 * the comparison that keeps DOM updates down to frames where something visible changed.
 * No DOM here, so it runs in Node tests.
 */
import { playerDodgeCharges, playerDodgeRecharge, type GameState } from '../sim';
import { enemiesRemaining, readArena, type ArenaView } from './arena';
import type { BarSnap, SlotSnap } from './hudSlots';

export type { BarSnap, SlotSnap } from './hudSlots';

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Rounds a 0..1 fraction to `steps` levels, so tiny frame-to-frame changes don't touch the DOM. */
export function quantize(v: number, steps: number): number {
  return Math.round(clamp01(v) * steps) / steps;
}

/** "74" for life shown rounded up (a sliver of life still reads 1), mana rounded down. */
export function fmtVital(v: number, round: 'ceil' | 'floor'): number {
  const r = round === 'ceil' ? Math.ceil(v - 1e-6) : Math.floor(v + 1e-6);
  return Math.max(0, r);
}

/** Mana cost for display: "4" or "6.6". */
export function fmtCost(c: number): string {
  const r = Math.round(c * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Seconds on a countdown: whole seconds, rounded up, never negative. */
export function fmtCountdown(seconds: number): number {
  return Math.max(0, Math.ceil(seconds - 1e-6));
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Dodge pip fills, 0..1 each: whole charges are 1, the next one fills as it recharges. */
export function dodgePips(
  charges: number,
  maxCharges: number,
  rechargeLeft: number,
  rechargeTime: number,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < maxCharges; i++) {
    if (i < charges) out.push(1);
    else if (i === charges && rechargeTime > 0) out.push(quantize(1 - rechargeLeft / rechargeTime, 24));
    else out.push(0);
  }
  return out;
}

/** Fraction of the current cast done (0 when this slot isn't casting). */
export function castProgress(castSlot: number, castLeft: number, castTime: number, slot: number): number {
  if (castSlot !== slot || castTime <= 0) return 0;
  return quantize(1 - castLeft / castTime, 40);
}

export interface WaveSnap {
  wave: number;
  phase: ArenaView['phase'];
  /** Whole seconds left in the intermission. */
  countdown: number;
  remaining: number;
}

export interface HudSnap {
  life: number;
  maxLife: number;
  lifeFrac: number;
  mana: number;
  maxMana: number;
  manaFrac: number;
  dead: boolean;
  respawnSec: number;
  pips: number[];
  slots: SlotSnap[];
  /** The weave bars (hudSlots.barSnap): the live bar and the other bar's preview. */
  bar: BarSnap;
  wave: WaveSnap | null;
  god: boolean;
}

const NO_BAR: BarSnap = { active: 0, other: [] };

/**
 * Vitals, dodge and wave from the state; `slots` and `bar` come from hudSlots.slotSnaps and
 * barSnap (the loadout contract).
 */
export function readSnap(state: GameState, slots: SlotSnap[] = [], bar: BarSnap = NO_BAR): HudSnap {
  const p = state.player;
  const a = readArena(state);
  return {
    // Life rounds up so a sliver reads 1, but never past the shown max (749.4 of 749.4 reads 749 / 749).
    life: Math.min(fmtVital(p.life, 'ceil'), Math.round(p.maxLife)),
    maxLife: Math.round(p.maxLife),
    lifeFrac: quantize(p.maxLife > 0 ? p.life / p.maxLife : 0, 100),
    mana: fmtVital(p.mana, 'floor'),
    maxMana: Math.round(p.maxMana),
    manaFrac: quantize(p.maxMana > 0 ? p.mana / p.maxMana : 0, 100),
    dead: p.dead,
    respawnSec: p.dead ? fmtCountdown(p.respawnLeft) : 0,
    // With the character's dodge mods (passives, items): 0 of them outside adventure mode.
    pips: dodgePips(p.dodgeCharges, playerDodgeCharges(state), p.dodgeRechargeLeft, playerDodgeRecharge(state)),
    slots,
    bar,
    wave: a
      ? { wave: a.wave, phase: a.phase, countdown: fmtCountdown(a.timer), remaining: enemiesRemaining(state) }
      : null,
    god: state.cheats.god,
  };
}

function shallowEq(a: object, b: object): boolean {
  const ka = Object.keys(a) as Array<keyof typeof a>;
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}

/** True when two snapshots would draw identically. */
export function snapEqual(a: HudSnap, b: HudSnap): boolean {
  if (a.pips.length !== b.pips.length || a.slots.length !== b.slots.length) return false;
  if (!a.pips.every((v, i) => v === b.pips[i])) return false;
  if (!a.slots.every((s, i) => shallowEq(s, b.slots[i]!))) return false;
  if (a.bar.active !== b.bar.active) return false;
  if (a.bar.other.length !== b.bar.other.length) return false;
  if (!a.bar.other.every((s, i) => shallowEq(s, b.bar.other[i]!))) return false;
  if ((a.wave === null) !== (b.wave === null)) return false;
  if (a.wave && b.wave && !shallowEq(a.wave, b.wave)) return false;
  const { pips: _p, slots: _s, wave: _w, bar: _b, ...ra } = a;
  const { pips: _p2, slots: _s2, wave: _w2, bar: _b2, ...rb } = b;
  return shallowEq(ra, rb);
}

/** Headline and detail lines for the top-center wave panel. */
export function waveText(w: WaveSnap): { title: string; detail: string } {
  if (w.phase === 'fighting') {
    return {
      title: `Wave ${w.wave}`,
      detail:
        w.remaining === 0 ? 'Clearing the last ones' : plural(w.remaining, 'enemy left', 'enemies left'),
    };
  }
  // Between waves: the banner says the last wave was cleared, so the panel looks ahead.
  return { title: `Wave ${w.wave + 1}`, detail: `Starting in ${w.countdown}…` };
}
