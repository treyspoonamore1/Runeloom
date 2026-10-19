import { describe, expect, it } from 'vitest';
import { AIR, SURFACE } from '../../../data/materials';
import { MAT, cellShape, circle, countCells, field, gridGame, gridTicks, hit, idx, ofType } from './helpers';

describe('fire on water, ice and oil (rules 4–6)', () => {
  it('rule 04: fire on shallow or deep water makes 3×3 steam for 3 s, no fire', () => {
    for (const ch of ['~', 'w']) {
      const s = field(ch, 4, 4);
      const ev = hit(s, 'fire', cellShape(8, 8));
      const steamed = countCells(s, (i) => s.grid.air[i] === AIR.steam);
      expect(steamed, ch).toBe(9);
      for (let y = 7; y <= 9; y++)
        for (let x = 7; x <= 9; x++) expect(s.grid.air[idx(s, x, y)], ch).toBe(AIR.steam);
      expect(
        countCells(s, (i) => s.grid.fire[i]! > 0),
        ch,
      ).toBe(0);
      expect(ofType(ev, 'steam')).toEqual([{ type: 'steam', count: 9, minX: 7, minY: 7, maxX: 9, maxY: 9 }]);
      expect(s.grid.airTimer[idx(s, 8, 8)]).toBe(60);
      gridTicks(s, 59);
      expect(s.grid.air[idx(s, 8, 8)]).toBe(AIR.steam);
      gridTicks(s, 1);
      expect(countCells(s, (i) => s.grid.air[i] !== AIR.none)).toBe(0);
    }
  });

  it('rule 04: steam scales with the footprint and Lingering lengthens it', () => {
    const s = field('~', 8, 8);
    hit(s, 'fire', circle(16, 16, 3), { durationMult: 2 });
    // Footprint cells (28 centers within r = 3) plus a one-cell ring.
    const steamed = countCells(s, (i) => s.grid.air[i] === AIR.steam);
    expect(steamed).toBeGreaterThan(28);
    expect(steamed).toBeLessThanOrEqual(64);
    expect(s.grid.airTimer[idx(s, 16, 16)]).toBe(120);
  });

  it('rule 04: steam does not cover walls', () => {
    const s = gridGame(['#~']);
    hit(s, 'fire', cellShape(4, 1));
    expect(s.grid.air[idx(s, 3, 1)]).toBe(AIR.none);
    expect(s.grid.air[idx(s, 5, 1)]).toBe(AIR.steam);
  });

  it('rule 05: fire melts ice into shallow water and ice bridges into deep water', () => {
    const s = gridGame(['~i~']); // map ice: permanent, but fire still melts it
    const i = idx(s, 5, 1);
    expect(s.grid.ground[i]).toBe(MAT.ice);
    hit(s, 'fire', cellShape(5, 1));
    expect(s.grid.ground[i]).toBe(MAT.shallow_water);
    expect(s.grid.fire[i]).toBe(0);
    expect(s.grid.ground[idx(s, 6, 1)]).toBe(MAT.ice); // only the hit area

    const b = field('w', 3, 3);
    hit(b, 'frost', circle(6, 6, 2));
    const j = idx(b, 6, 6);
    expect(b.grid.ground[j]).toBe(MAT.ice_bridge);
    expect(b.room.solid[j]).toBe(0);
    hit(b, 'fire', cellShape(6, 6));
    expect(b.grid.ground[j]).toBe(MAT.deep_water);
    expect(b.room.solid[j]).toBe(1);
  });

  it('rule 06: oil ignites hot, burns 2 s, then is gone and the stone stays', () => {
    const s = gridGame(['.o.']);
    const i = idx(s, 5, 1);
    expect(s.grid.surface[i]).toBe(SURFACE.oil);
    hit(s, 'fire', cellShape(5, 1));
    expect(s.grid.fire[i]).toBe(255);
    expect(s.grid.fuel[i]).toBe(40);
    gridTicks(s, 40);
    expect(s.grid.fire[i]).toBe(0);
    expect(s.grid.surface[i]).toBe(SURFACE.none);
    expect(s.grid.ground[i]).toBe(MAT.stone);
    // Burning oil smokes densely.
    expect(s.grid.air[idx(s, 3, 1)]).toBe(AIR.smoke);
  });

  it('rule 06: burning oil spreads fast through an oil slick (seeded ranges)', () => {
    let total = 0;
    for (const seed of [1, 2, 3, 4]) {
      const s = field('o', 6, 6, seed);
      hit(s, 'fire', cellShape(12, 12));
      gridTicks(s, 6);
      const lit = countCells(s, (i) => s.grid.fire[i]! > 0 || s.grid.surface[i] === SURFACE.none);
      expect(lit).toBeGreaterThan(20);
      total += lit;
    }
    // At p = 0.7 the front moves almost a cell per tick: about a diamond of radius ~5.
    expect(total / 4).toBeGreaterThan(30);
    expect(total / 4).toBeLessThan(85);
  });

  it('rule 06: oil floats on water and burns there without steam', () => {
    const s = gridGame(['~O~']);
    const i = idx(s, 5, 1);
    const ev = hit(s, 'fire', cellShape(5, 1));
    expect(s.grid.fire[i]).toBe(255);
    expect(ofType(ev, 'steam')).toHaveLength(0);
    gridTicks(s, 40);
    expect(s.grid.surface[i]).toBe(SURFACE.none);
    expect(s.grid.ground[i]).toBe(MAT.shallow_water);
  });

  it('rule 06: oil on grass burns first, then the grass catches', () => {
    const s = field('"', 2, 2);
    const i = idx(s, 3, 3);
    s.grid.surface[i] = SURFACE.oil;
    hit(s, 'fire', cellShape(3, 3));
    expect(s.grid.fire[i]).toBe(255);
    gridTicks(s, 40);
    expect(s.grid.surface[i]).toBe(SURFACE.none);
    expect(s.grid.fire[i]).toBe(s.tuning.grid.fireIntensity.material);
    expect(s.grid.fuel[i]).toBe(40);
    gridTicks(s, 40);
    expect(s.grid.ground[i]).toBe(MAT.ash);
  });
});
