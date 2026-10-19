import { describe, expect, it } from 'vitest';
import { cellAt, iceCrackProgress } from '../../../src/sim';
import { MAT, cellShape, circle, field, gridGame, gridTicks, hit, idx, ofType } from './helpers';

describe('frost (rules 7–10)', () => {
  it('rule 07: frost on shallow water makes ice that thaws after 15 s', () => {
    const s = field('~', 3, 3);
    const i = idx(s, 6, 6);
    const ev = hit(s, 'frost', cellShape(6, 6));
    expect(s.grid.ground[i]).toBe(MAT.ice);
    expect(s.grid.timer[i]).toBe(300);
    expect(ofType(ev, 'iceFormed')).toEqual([
      { type: 'iceFormed', count: 1, minX: 6, minY: 6, maxX: 6, maxY: 6 },
    ]);
    expect(s.room.solid[i]).toBe(0);
    gridTicks(s, 299);
    expect(s.grid.ground[i]).toBe(MAT.ice);
    gridTicks(s, 1);
    expect(s.grid.ground[i]).toBe(MAT.shallow_water);
    expect(s.grid.under[i]).toBe(MAT.shallow_water);
  });

  it('rule 07: Lingering lengthens ice; frost again restarts a thawing ice timer', () => {
    const s = field('~', 3, 3);
    const i = idx(s, 6, 6);
    hit(s, 'frost', cellShape(6, 6), { durationMult: 2 });
    expect(s.grid.timer[i]).toBe(600);
    gridTicks(s, 100);
    hit(s, 'frost', cellShape(6, 6));
    expect(s.grid.timer[i]).toBe(500); // a shorter refresh never cuts it short
    gridTicks(s, 400);
    hit(s, 'frost', cellShape(6, 6));
    expect(s.grid.timer[i]).toBe(300);
  });

  it('rule 07: map-placed ice is permanent (timer 0) until fire melts it', () => {
    const s = gridGame(['iii']);
    const i = idx(s, 5, 1);
    expect(s.grid.timer[i]).toBe(0);
    hit(s, 'frost', cellShape(5, 1));
    expect(s.grid.timer[i]).toBe(0);
    gridTicks(s, 1000);
    expect(s.grid.ground[i]).toBe(MAT.ice);
  });

  it('rule 08: frost on deep water makes a walkable ice bridge: 8 s, 1.5 s cracking, then deep water', () => {
    const s = field('w', 3, 3);
    const i = idx(s, 6, 6);
    expect(s.room.solid[i]).toBe(1);
    hit(s, 'frost', cellShape(6, 6));
    expect(s.grid.ground[i]).toBe(MAT.ice_bridge);
    expect(s.room.solid[i]).toBe(0);
    expect(s.grid.timer[i]).toBe(190); // 160 + 30 grid ticks
    expect(iceCrackProgress(s.grid, i)).toBe(0);
    let ev = gridTicks(s, 159);
    expect(ofType(ev, 'iceBreaking')).toHaveLength(0);
    ev = gridTicks(s, 1);
    expect(ofType(ev, 'iceBreaking')).toEqual([
      { type: 'iceBreaking', count: 1, minX: 6, minY: 6, maxX: 6, maxY: 6 },
    ]);
    expect(iceCrackProgress(s.grid, i)).toBe(0);
    gridTicks(s, 15);
    expect(cellAt(s, 6.5, 6.5).crackProgress).toBeCloseTo(0.5, 6);
    ev = gridTicks(s, 14);
    expect(s.grid.ground[i]).toBe(MAT.ice_bridge);
    expect(ofType(ev, 'iceBroke')).toHaveLength(0);
    ev = gridTicks(s, 1);
    expect(s.grid.ground[i]).toBe(MAT.deep_water);
    expect(s.room.solid[i]).toBe(1);
    expect(ofType(ev, 'iceBroke')).toHaveLength(1);
  });

  it('rule 08: Lingering lengthens the bridge but not its cracking', () => {
    const s = field('w', 3, 3);
    hit(s, 'frost', cellShape(6, 6), { durationMult: 1.5 });
    expect(s.grid.timer[idx(s, 6, 6)]).toBe(240 + 30);
  });

  it('rule 09: frost puts a fire out and keeps its fuel, so it can reignite', () => {
    const s = field('"', 3, 3);
    const i = idx(s, 6, 6);
    hit(s, 'fire', cellShape(6, 6));
    gridTicks(s, 5);
    expect(s.grid.fuel[i]).toBe(35);
    hit(s, 'frost', circle(6, 6, 3));
    expect(s.grid.fire[i]).toBe(0);
    expect(s.grid.fuel[i]).toBe(35);
    expect(s.grid.ground[i]).toBe(MAT.grass);
    hit(s, 'fire', cellShape(6, 6));
    expect(s.grid.fire[i]).toBeGreaterThan(0);
    expect(s.grid.fuel[i]).toBe(35);
  });

  it('rule 10: frost on mud makes dirt', () => {
    const s = gridGame([':::']);
    const i = idx(s, 5, 1);
    hit(s, 'frost', cellShape(5, 1));
    expect(s.grid.ground[i]).toBe(MAT.dirt);
    expect(s.grid.ground[idx(s, 6, 1)]).toBe(MAT.mud);
  });
});
