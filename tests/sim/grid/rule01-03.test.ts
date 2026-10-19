import { describe, expect, it } from 'vitest';
import { AIR } from '../../../data/materials';
import {
  MAT,
  OWNER,
  cellShape,
  circle,
  countCells,
  field,
  gridGame,
  gridTicks,
  hit,
  idx,
  ofType,
  paint,
} from './helpers';

describe('fire on flammable cells (rules 1–3)', () => {
  it('rule 01: fire ignites a dry flammable cell', () => {
    const s = field('"', 4, 4);
    const i = idx(s, 5, 5);
    const ev = hit(s, 'fire', cellShape(5, 5));
    expect(s.grid.fire[i]).toBe(s.tuning.grid.fireIntensity.material);
    expect(s.grid.fuel[i]).toBe(40); // grass burns 2 s = 40 grid ticks
    expect(s.grid.owner[i]).toBe(OWNER.player);
    expect(ofType(ev, 'cellIgnited')).toEqual([
      { type: 'cellIgnited', count: 1, minX: 5, minY: 5, maxX: 5, maxY: 5 },
    ]);
  });

  it('rule 01: wet cells do not ignite', () => {
    const s = field('"', 4, 4);
    const i = idx(s, 5, 5);
    s.grid.wet[i] = 30;
    const ev = hit(s, 'fire', cellShape(5, 5));
    expect(s.grid.fire[i]).toBe(0);
    expect(ofType(ev, 'cellIgnited')).toHaveLength(0);
    // Wet ground also blocks placed fire (rule 26).
    const t = field('.', 4, 4);
    t.grid.wet[idx(t, 5, 5)] = 30;
    hit(t, 'fire', cellShape(5, 5));
    expect(t.grid.fire[idx(t, 5, 5)]).toBe(0);
  });

  it('rule 01: fuel per material, Lingering lengthens it', () => {
    const fuel: [string, number][] = [
      ['"', 40],
      ['*', 20],
      ['=', 120],
      ['+', 120],
      ['c', 60],
      ['|', 80],
    ];
    for (const [ch, ticks] of fuel) {
      const s = gridGame([`.${ch}.`]);
      hit(s, 'fire', cellShape(5, 1));
      expect(s.grid.fuel[idx(s, 5, 1)], ch).toBe(ticks);
    }
    const s = field('"', 2, 2);
    hit(s, 'fire', cellShape(1, 1), { durationMult: 1.5 });
    expect(s.grid.fuel[idx(s, 1, 1)]).toBe(60);
  });

  it('rule 02: fire spreads through grass at about the spread chance (seeded ranges)', () => {
    // 40×40 cells of grass lit in the middle. After 10 grid ticks (0.5 s) at p = 0.2 per
    // neighbor per tick the fire has grown to a few dozen cells (about 30 on average; a single
    // seed ranges roughly 5–50). Assert per-seed bounds and a band for the mean.
    let total = 0;
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    for (const seed of seeds) {
      const s = field('"', 10, 10, seed);
      hit(s, 'fire', cellShape(20, 20));
      gridTicks(s, 10);
      const lit = countCells(s, (i) => s.grid.fire[i]! > 0);
      expect(lit, `seed ${seed}`).toBeGreaterThanOrEqual(1);
      expect(lit, `seed ${seed}`).toBeLessThanOrEqual(100);
      total += lit;
    }
    expect(total / seeds.length).toBeGreaterThan(15);
    expect(total / seeds.length).toBeLessThan(50);
  });

  it('rule 02: spread rate follows the material (bramble faster than wood)', () => {
    const burnt = (ch: string) => {
      let total = 0;
      for (const seed of [1, 2, 3]) {
        const s = field(ch, 10, 10, seed);
        hit(s, 'fire', cellShape(20, 20));
        gridTicks(s, 12);
        total += countCells(
          s,
          (i) => s.grid.fire[i]! > 0 || s.grid.ground[i] !== MAT[ch === '*' ? 'bramble' : 'wood'],
        );
      }
      return total;
    };
    expect(burnt('*')).toBeGreaterThan(burnt('=') * 3);
  });

  it('rule 02: fire does not spread into stone, water or wet grass', () => {
    const s = gridGame(['."~', '...']);
    // Wet the grass column next to the lit one: x = 5 lit, x = 6 wet.
    for (let y = 0; y < 4; y++) s.grid.wet[idx(s, 6, y)] = 255;
    hit(s, 'fire', circle(4.5, 2, 0.6)); // cells (4,1) and (4,2) of the grass tile
    gridTicks(s, 30);
    for (let y = 0; y < 8; y++) {
      for (const x of [3, 8]) expect(s.grid.fire[idx(s, x, y)]).toBe(0);
      expect(s.grid.fire[idx(s, 6, y)]).toBe(0);
    }
    for (let y = 4; y < 8; y++) for (let x = 4; x < 8; x++) expect(s.grid.fire[idx(s, x, y)]).toBe(0);
  });

  it('rule 02: spreading fire keeps the owner of the cell it spread from; a new effect overwrites', () => {
    const s = field('"', 10, 10);
    hit(s, 'fire', cellShape(20, 20), { owner: OWNER.enemy });
    gridTicks(s, 15);
    let burning = 0;
    for (let i = 0; i < s.grid.fire.length; i++)
      if (s.grid.fire[i]! > 0) {
        burning++;
        expect(s.grid.owner[i]).toBe(OWNER.enemy);
      }
    expect(burning).toBeGreaterThan(3);
    // The player's fire on a burning cell takes it over.
    const lit = s.grid.fire.findIndex((f) => f > 0);
    hit(s, 'fire', cellShape(lit % s.grid.width, Math.floor(lit / s.grid.width)));
    expect(s.grid.owner[lit]).toBe(OWNER.player);
  });

  it('rule 03: a burnt-out cell becomes its burnt material', () => {
    const cases: [string, number, number][] = [
      ['"', 40, MAT.ash],
      ['*', 20, MAT.ash],
      ['c', 60, MAT.ash],
      ['|', 80, MAT.stone],
      ['=', 120, MAT.deep_water], // a bridge drops into what is under it
      ['+', 120, MAT.pit],
    ];
    for (const [ch, ticks, result] of cases) {
      const s = gridGame([`.${ch}.`]);
      const i = idx(s, 5, 1);
      hit(s, 'fire', cellShape(5, 1));
      gridTicks(s, ticks - 1);
      expect(s.grid.fire[i], ch).toBeGreaterThan(0);
      const ev = gridTicks(s, 1);
      expect(s.grid.fire[i], ch).toBe(0);
      expect(s.grid.ground[i], ch).toBe(result);
      expect(ofType(ev, 'burntOut').length, ch).toBe(1);
    }
  });

  it('rule 03: grass smokes lightly, bramble densely; smoke lasts 4 s after the fire', () => {
    const s = field('.', 4, 4);
    paint(s, 5, 5, 'grass');
    hit(s, 'fire', cellShape(5, 5));
    gridTicks(s, 1);
    expect(s.grid.air[idx(s, 5, 5)]).toBe(AIR.smoke);
    expect(s.grid.air[idx(s, 6, 5)]).toBe(AIR.none); // light: the burning cell only
    gridTicks(s, 39); // burnt out on the 40th tick
    expect(s.grid.ground[idx(s, 5, 5)]).toBe(MAT.ash);
    expect(s.grid.airTimer[idx(s, 5, 5)]).toBe(80); // 4 s from the last burning tick
    gridTicks(s, 79);
    expect(s.grid.air[idx(s, 5, 5)]).toBe(AIR.smoke);
    gridTicks(s, 1);
    expect(s.grid.air[idx(s, 5, 5)]).toBe(AIR.none);

    const d = field('.', 4, 4);
    paint(d, 5, 5, 'bramble');
    hit(d, 'fire', cellShape(5, 5));
    gridTicks(d, 1);
    for (const [x, y] of [
      [4, 5],
      [6, 5],
      [5, 4],
      [5, 6],
    ] as const)
      expect(d.grid.air[idx(d, x, y)]).toBe(AIR.smoke);
    expect(d.grid.air[idx(d, 6, 6)]).toBe(AIR.none);
  });

  it('rule 03: burning bramble opens a path and the masks follow', () => {
    const s = gridGame(['.*.']);
    const i = idx(s, 5, 1);
    expect(s.room.solid[i]).toBe(1);
    const v = s.grid.walkVersion;
    hit(s, 'fire', cellShape(5, 1));
    gridTicks(s, 20);
    expect(s.grid.ground[i]).toBe(MAT.ash);
    expect(s.room.solid[i]).toBe(0);
    expect(s.grid.walkVersion).toBeGreaterThan(v);
    // A wooden bridge burning drops into deep water: solid for walking, not for shots.
    const b = gridGame(['w=w']);
    const j = idx(b, 5, 1);
    hit(b, 'fire', cellShape(5, 1));
    gridTicks(b, 120);
    expect(b.room.solid[j]).toBe(1);
    expect(b.room.shotSolid[j]).toBe(0);
    // Crates and barricades stop blocking shots once burnt.
    const c = gridGame(['.c.']);
    hit(c, 'fire', cellShape(5, 1));
    gridTicks(c, 60);
    expect(c.room.shotSolid[idx(c, 5, 1)]).toBe(0);
  });
});
