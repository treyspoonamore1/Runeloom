/**
 * Playtest 8 ("the gale visual looked weird on a lob"): radial Gale gusts are drawn as bursts
 * streaking out of their center (render/terrain/galeBursts.ts), and Gale spells have their own
 * look instead of the plain physical pellet (render/elementLook.ts).
 */
import { describe, expect, it } from 'vitest';
import { Button, DT, type GameState } from '../../src/sim';
import { GaleBursts } from '../../src/render/terrain/galeBursts';
import { spellLook, secondLook } from '../../src/render/elementLook';
import { ofType, room, run, weaves } from '../sim/terrain/helpers';

function castAndWatch(notation: string, ticks: number): { s: GameState; bursts: GaleBursts; landed: number[] } {
  const s = room('.');
  weaves(s, [notation]);
  const bursts = new GaleBursts();
  const t = s.weaves.slots[0]!.program!.castTime;
  const hold = Math.ceil((t * 0.25 - 1e-9) / DT);
  const landed: number[] = [];
  for (let i = 0; i < hold + ticks; i++) {
    const ev = run(s, 1, i < hold ? Button.Cast1 : 0, [50, 40]);
    bursts.handle(ev);
    for (const l of ofType(ev, 'lobLand')) landed.push(l.x, l.y);
    bursts.update(s);
  }
  return { s, bursts, landed };
}

describe('Gale bursts (playtest 8)', () => {
  it('a Lob[Gale] landing leaves one burst at its landing point, as wide as its gust', () => {
    const { s, bursts, landed } = castAndWatch('Cast > Lob[Gale]', 40);
    expect(landed).toHaveLength(2);
    const list = bursts.update(s);
    expect(list).toHaveLength(1);
    expect(list[0]!.x).toBeCloseTo(landed[0]!, 5);
    expect(list[0]!.y).toBeCloseTo(landed[1]!, 5);
    // The 5-cell burst: its farthest cell plus a little margin.
    expect(list[0]!.reach).toBeGreaterThan(5);
    expect(list[0]!.reach).toBeLessThan(7);
  });

  it('a Nova[Gale] is a burst around its center', () => {
    const { s, bursts } = castAndWatch('Cast > Nova[Gale]', 30);
    const list = bursts.update(s);
    expect(list).toHaveLength(1);
    expect(list[0]!.x).toBeCloseTo(20, 0);
    expect(list[0]!.y).toBeCloseTo(40, 0);
  });

  it('cones and other elements make no burst; a burst ends with its gust', () => {
    const strike = castAndWatch('Cast > Strike[Gale]', 10);
    expect(strike.s.grid.gusts).toHaveLength(1);
    expect(strike.bursts.update(strike.s)).toHaveLength(0);
    const fire = castAndWatch('Cast > Lob[Fire]', 40);
    expect(fire.bursts.update(fire.s)).toHaveLength(0);
    const { s, bursts } = castAndWatch('Cast > Lob[Gale]', 40 + 60 * 3);
    expect(bursts.update(s)).toHaveLength(0);
  });
});

describe('the Gale look (playtest 8)', () => {
  it('Gale spells are a ball of wind, not the physical pellet', () => {
    const g = spellLook(['gale']);
    expect(g.boltCore).toBe('bolt_gale');
    expect(g.shed).toBe('wisp');
    expect(g.rim).toBe(0xe8f4f0);
    expect(spellLook(['tide']).boltCore).toBe('bolt_plain');
    expect(secondLook(['fire', 'gale'])).toBe(g);
  });
});
