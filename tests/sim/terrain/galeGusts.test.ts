/**
 * The Gale rune (CONTENT §1.3) and its gust shapes by form (DESIGN §6.6 table): Bolt a 60° cone of
 * radius 12 from its impact or expiry point along the bolt; Beam, Strike and Swath the same cone
 * from the caster along the aim; Nova, Lob and Orb their footprint, blowing away from its center.
 */
import { describe, expect, it } from 'vitest';
import { Button, DT, type GameState, type SimEvent } from '../../../src/sim';
import { dummy, idx, ofType, room, run, weaves } from './helpers';

const LMB = Button.Cast1;
const E = 1;
const N = 3;
const SW = 6;
const SE = 8;

function cast(s: GameState, aim: [number, number]): SimEvent[] {
  const t = s.weaves.slots[0]!.program!.castTime;
  const n = Math.ceil((t * 0.25 - 1e-9) / DT);
  return [...run(s, n, LMB, aim), ...run(s, 1, 0, aim)];
}

const gust = (s: GameState, x: number, y: number) => s.grid.gustDir[idx(s, x, y)]!;
const timer = (s: GameState, x: number, y: number) => s.grid.gustTimer[idx(s, x, y)]!;

/** A Gale weave cast from (20, 40) at `aim`; the events of the cast and `extra` ticks. */
function galeCast(notation: string, aim: [number, number] = [60, 40], extra = 1): [GameState, SimEvent[]] {
  const s = room('.');
  weaves(s, [notation]);
  const ev = [...cast(s, aim), ...run(s, extra)];
  return [s, ev];
}

describe('Gale gust shapes (DESIGN §6.6)', () => {
  it('Bolt: a 60° cone of radius 12 from its expiry point, along the bolt', () => {
    const [s, ev] = galeCast('Cast > Bolt[Gale]', [60, 40], 60);
    const end = ofType(ev, 'spellEnd')[0]!;
    const x = Math.floor(end.x);
    const y = Math.floor(end.y);
    // Read right after it ended: 60 ticks is enough for a 0.9 s bolt; the gust lasts 2 s.
    expect(gust(s, x + 6, y)).toBe(E);
    expect(gust(s, x + 11, y)).toBe(E);
    expect(gust(s, x + 14, y)).toBe(0);
    expect(gust(s, x - 3, y)).toBe(0);
    expect(gust(s, x + 3, y + 5)).toBe(0); // outside the 30° half angle
  });

  it('Bolt: from its impact point when it hits', () => {
    const s = room('.');
    weaves(s, ['Cast > Bolt[Gale]']);
    dummy(s, 40, 40);
    const ev = [...cast(s, [60, 40]), ...run(s, 30)];
    const end = ofType(ev, 'spellEnd')[0]!;
    expect(end.x).toBeLessThan(42);
    expect(gust(s, Math.floor(end.x) + 8, 40)).toBe(E);
    expect(gust(s, 30, 40)).toBe(0);
  });

  for (const form of ['Beam', 'Strike', 'Swath'])
    it(`${form}: a 60° cone of radius 12 from the caster, along the aim`, () => {
      const [s] = galeCast(`Cast > ${form}[Gale]`, [60, 40], 2);
      expect(gust(s, 26, 40)).toBe(E);
      expect(gust(s, 31, 40)).toBe(E);
      expect(gust(s, 34, 40)).toBe(0);
      expect(gust(s, 26, 47)).toBe(0);
      expect(gust(s, 15, 40)).toBe(0);
    });

  it('a diagonal aim quantizes to 8 directions', () => {
    const [s] = galeCast('Cast > Strike[Gale]', [40, 60], 2);
    expect(gust(s, 25, 45)).toBe(SE);
  });

  it('Nova: its disc, blowing away from its center', () => {
    const [s] = galeCast('Cast > Nova[Gale]', [60, 40], 20);
    expect(gust(s, 25, 40)).toBe(E);
    expect(gust(s, 20, 34)).toBe(N);
    expect(gust(s, 15, 45)).toBe(SW);
    expect(gust(s, 32, 40)).toBe(0); // beyond the 10-cell ring
    expect(s.grid.gusts).toHaveLength(1); // every band of one Nova is one gust
  });

  it('Lob: its burst, blowing away from where it lands', () => {
    const [s, ev] = galeCast('Cast > Lob[Gale]', [60, 40], 40);
    const end = ofType(ev, 'spellEnd')[0]!;
    expect(gust(s, Math.floor(end.x) + 3, Math.floor(end.y))).toBe(E);
    expect(gust(s, Math.floor(end.x), Math.floor(end.y) - 3)).toBe(N);
  });

  it('Orb: its trail circles, blowing away from the orb; one gust for the whole orb', () => {
    const [s] = galeCast('Cast > Orb[Gale]', [60, 40], 60);
    let cells = 0;
    for (let i = 0; i < s.grid.gustTimer.length; i++) if (s.grid.gustTimer[i]! > 0) cells++;
    expect(cells).toBeGreaterThan(10);
    expect(s.grid.gusts).toHaveLength(1);
  });

  it('a gust lasts 2 s, × Lingering; Saturate doubles its area', () => {
    const [plain] = galeCast('Cast > Strike[Gale]', [60, 40], 0);
    const [ling] = galeCast('Cast > Strike[Gale, Lingering]', [60, 40], 0);
    const t0 = timer(plain, 26, 40);
    expect(t0).toBeGreaterThanOrEqual(39);
    expect(t0).toBeLessThanOrEqual(40);
    expect(timer(ling, 26, 40)).toBeGreaterThanOrEqual(59);
    const [sat] = galeCast('Cast > Strike[Gale, Saturate]', [60, 40], 0);
    expect(gust(sat, 35, 40)).toBe(E); // 12·√2 ≈ 17 cells
    expect(gust(plain, 35, 40)).toBe(0);
  });
});

describe('the Gale rune (CONTENT §1.3)', () => {
  it('deals Physical damage with double knockback', () => {
    const plain = room('.');
    weaves(plain, ['Cast > Strike[]']);
    const a = dummy(plain, 23, 40);
    const gale = room('.');
    weaves(gale, ['Cast > Strike[Gale]']);
    const b = dummy(gale, 23, 40);
    cast(plain, [40, 40]);
    const ev = [...cast(gale, [40, 40])];
    run(plain, 40);
    run(gale, 40);
    const hit = ofType(ev, 'hit')[0]!;
    expect(hit.byType?.physical).toBeGreaterThan(0);
    expect(b.x - 23).toBeCloseTo(2 * (a.x - 23), 1);
  });

  it('its gust moves nothing but chemistry: an entity in the wind keeps its place', () => {
    const s = room('.');
    weaves(s, ['Cast > Nova[Gale]']);
    const d = dummy(s, 40, 40); // outside the Nova's 10 cells: not hit, only in wind
    s.grid.wind = 5; // and room wind on top
    cast(s, [60, 40]);
    run(s, 60);
    expect(d.x).toBe(40);
    expect(d.y).toBe(40);
  });
});
