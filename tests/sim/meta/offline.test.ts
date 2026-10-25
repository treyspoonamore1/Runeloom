/**
 * M7 acceptance: closed-form offline gains match a step-by-step simulation within 1%
 * (advanceHearth over a span vs one-second steps, and vs real step() ticks).
 */
import { describe, expect, it } from 'vitest';
import { maxRuneLevel, runeXpToNext } from '../../../data/progression';
import { offline } from '../../../data/hearth';
import { NEUTRAL_INPUT, step, type GameState, type RuneItem } from '../../../src/sim';
import { applyHeroEdit } from '../../../src/sim/hero/edits';
import { advanceHearth } from '../../../src/sim/meta/hearth';
import { build, hub, plant } from './helpers';

/** A rune's XP from level 1. */
function totalXp(r: RuneItem): number {
  let t = r.xp;
  for (let l = 1; l < r.level; l++) t += runeXpToNext(l);
  return t;
}

interface Setup {
  pit: number;
  garden: number;
  board: number;
  bright?: number;
}

/** A lit Hearth with buildings, five garden runes (one high level, one with quality) and three expeditions. */
function hearth(s: Setup): GameState {
  const state = hub();
  build(state, { kindling_pit: s.pit, rune_garden: s.garden, expedition_board: s.board });
  if (s.bright) state.hero.hearth.mutations.bright_hearth = s.bright;
  plant(state, ['bolt', 'fire'], 1);
  plant(state, ['nova'], 12);
  plant(state, ['wide'], 3, 15);
  plant(state, ['split'], maxRuneLevel - 1);
  const h = state.hero.hearth;
  h.expeditions.push(
    { uid: 900, tier: 1, left: 600, duration: 720, cycle: 0 },
    { uid: 901, tier: 5, left: 5000.5, duration: 6000, cycle: 0 },
    { uid: 902, tier: 9, left: 40000, duration: 40000, cycle: 0 },
  );
  return state;
}

function snapshot(state: GameState) {
  const h = state.hero.hearth;
  const runes = h.garden.map((u) => state.hero.runes.find((r) => r.uid === u)!);
  return {
    scrap: state.hero.threadScrap + h.scrapCarry,
    levels: runes.map((r) => r.level),
    xp: runes.map(totalXp),
    left: h.expeditions.map((e) => e.left),
    back: h.expeditions.filter((e) => e.left === 0).length,
  };
}

function within1pct(a: number, b: number): void {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(Math.max(1e-6, 0.01 * Math.max(Math.abs(a), Math.abs(b))));
}

function compare(closed: GameState, stepped: GameState): void {
  const a = snapshot(closed);
  const b = snapshot(stepped);
  within1pct(a.scrap, b.scrap);
  expect(Math.floor(a.scrap)).toBe(Math.floor(b.scrap));
  expect(a.levels).toEqual(b.levels);
  a.xp.forEach((x, i) => within1pct(x, b.xp[i]!));
  a.left.forEach((x, i) => within1pct(x, b.left[i]!));
  expect(a.back).toBe(b.back);
}

const SETUPS: Setup[] = [
  { pit: 1, garden: 1, board: 1 },
  { pit: 8, garden: 6, board: 6 },
  { pit: 15, garden: 12, board: 11, bright: 3 },
  { pit: 25, garden: 20, board: 15, bright: 10 },
];

describe('closed-form offline progress (M7 acceptance)', () => {
  for (const s of SETUPS) {
    it(`8 hours at once = 28,800 one-second steps (pit ${s.pit}, garden ${s.garden}, board ${s.board}, Bright Hearth ${s.bright ?? 0})`, () => {
      const closed = hearth(s);
      const stepped = hearth(s);
      const before = snapshot(closed);
      const g = advanceHearth(closed, offline.capSeconds);
      for (let i = 0; i < offline.capSeconds; i++) advanceHearth(stepped, 1);
      compare(closed, stepped);
      const after = snapshot(closed);
      // It produced something, and its totals are what changed.
      expect(g.scrap).toBe(closed.hero.threadScrap);
      expect(g.scrap).toBeGreaterThan(0);
      expect(g.runeLevels).toBe(after.levels.reduce((x, y) => x + y) - before.levels.reduce((x, y) => x + y));
      expect(g.expeditionsReturned).toBe(2);
      if (s.garden >= 6) expect(after.levels[4]).toBe(maxRuneLevel); // XP stops at the cap
    });
  }

  it('a short span (90 s) matches too, and so do uneven pieces', () => {
    const s = SETUPS[2]!;
    const closed = hearth(s);
    const stepped = hearth(s);
    const pieces = hearth(s);
    advanceHearth(closed, 90);
    for (let i = 0; i < 90; i++) advanceHearth(stepped, 1);
    for (const t of [0.5, 13.25, 40, 36.25]) advanceHearth(pieces, t);
    compare(closed, stepped);
    compare(closed, pieces);
  });

  it('Bright Hearth raises Thread Scrap and rune XP by 10% a purchase', () => {
    const plain = hearth({ pit: 10, garden: 10, board: 1 });
    const bright = hearth({ pit: 10, garden: 10, board: 1, bright: 2 });
    advanceHearth(plain, 3600);
    advanceHearth(bright, 3600);
    within1pct(snapshot(bright).scrap, snapshot(plain).scrap * 1.2);
    within1pct(snapshot(bright).xp[0]!, snapshot(plain).xp[0]! * 1.2);
  });

  it('an unlit Hearth makes nothing', () => {
    const state = hub({ lit: false });
    build(state, { kindling_pit: 5, rune_garden: 5 });
    const r = plant(state, ['bolt'])[0]!;
    const g = advanceHearth(state, 3600);
    expect(g).toEqual({ seconds: 3600, scrap: 0, runeXp: 0, runeLevels: 0, expeditionsReturned: 0 });
    expect(state.hero.threadScrap).toBe(0);
    expect(r.xp).toBe(0);
  });
});

describe('online production (step)', () => {
  it('three minutes of ticks match advanceHearth(180 s)', () => {
    const s = SETUPS[1]!;
    const online = hearth(s);
    const closed = hearth(s);
    for (let i = 0; i < 180 * 60; i++) step(online, NEUTRAL_INPUT);
    advanceHearth(closed, 180);
    compare(closed, online);
    expect(online.hero.hearth.playSeconds).toBe(180);
    expect(online.hero.hearth.clock).toBe(0);
  });

  it('one Hearth second per 60 ticks; hitstop ticks do not count', () => {
    const state = hearth(SETUPS[0]!);
    for (let i = 0; i < 59; i++) step(state, NEUTRAL_INPUT);
    expect(state.hero.hearth.playSeconds).toBe(0);
    state.hitstopLeft = 0.5;
    for (let i = 0; i < 30; i++) step(state, NEUTRAL_INPUT);
    expect(state.hero.hearth.clock).toBe(59);
    for (let i = 0; i < 40; i++) step(state, NEUTRAL_INPUT); // hitstop runs out, then the second ticks
    expect(state.hero.hearth.playSeconds).toBe(1);
  });

  it('an unlit Hearth keeps no clock', () => {
    const state = hub({ lit: false });
    for (let i = 0; i < 120; i++) step(state, NEUTRAL_INPUT);
    expect(state.hero.hearth.clock).toBe(0);
    expect(state.hero.hearth.playSeconds).toBe(0);
  });
});

describe("the 'offline' edit", () => {
  it('advances the Hearth and reports the totals, anywhere', () => {
    const state = hearth(SETUPS[1]!);
    const twin = hearth(SETUPS[1]!);
    expect(applyHeroEdit(state, { kind: 'offline', seconds: 7200 })).toBeNull();
    const g = advanceHearth(twin, 7200);
    const ev = state.events.find((e) => e.type === 'offlineGains');
    expect(ev).toEqual({ type: 'offlineGains', ...g });
    expect(g.scrap).toBeGreaterThan(0);
    expect(g.runeXp).toBeGreaterThan(0);
    const away = hub({ roomId: 'test/elsewhere' });
    expect(applyHeroEdit(away, { kind: 'offline', seconds: 60 })).toBeNull();
  });

  it('is refused unlit, at 0 or less, and past the 8 hour cap', () => {
    expect(applyHeroEdit(hub({ lit: false }), { kind: 'offline', seconds: 60 })).toMatch(/not lit/);
    const state = hub();
    expect(applyHeroEdit(state, { kind: 'offline', seconds: 0 })).toMatch(/more than 0/);
    expect(applyHeroEdit(state, { kind: 'offline', seconds: -5 })).toMatch(/more than 0/);
    expect(applyHeroEdit(state, { kind: 'offline', seconds: Number.NaN })).toMatch(/more than 0/);
    expect(applyHeroEdit(state, { kind: 'offline', seconds: offline.capSeconds + 1 })).toMatch(/8 hours/);
    expect(applyHeroEdit(state, { kind: 'offline', seconds: offline.capSeconds })).toBeNull();
  });

  it('a garden level-up sends gardenRuneLevel with the new level', () => {
    const state = hub();
    build(state, { rune_garden: 5 });
    const r = plant(state, ['bolt'])[0]!;
    expect(applyHeroEdit(state, { kind: 'offline', seconds: 3600 })).toBeNull();
    expect(r.level).toBeGreaterThan(1);
    expect(state.events).toContainEqual({ type: 'gardenRuneLevel', uid: r.uid, level: r.level });
  });
});
