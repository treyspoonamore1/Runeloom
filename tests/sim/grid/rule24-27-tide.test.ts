/**
 * Tide on terrain (M8, DESIGN §6.5): rule 24 for every row of the Tide table, borrowed terrain
 * and rule 27, and how Tide meets the other elements (slot order, oil, charge, ice).
 */
import { describe, expect, it } from 'vitest';
import { SURFACE } from '../../../data/materials';
import { defaultTuning } from '../../../data/tuning';
import { placeTempWater } from '../../../src/sim/grid/tempWater';
import { hydromancerGrounds } from '../../../data/passives';
import { MAT, OWNER, cellShape, circle, field, gridGame, gridTicks, hit, idx, ofType } from './helpers';
import type { GameState } from '../../../src/sim';

/** Cell (1, 1) of tile tx in row 0. */
const C = (tx: number) => tx * 4 + 1;
const TIDE_TICKS = defaultTuning.tide.floodSeconds * 20;

function tideAt(s: GameState, x: number, y = 1, extra = {}) {
  return hit(s, 'tide', cellShape(x, y), extra);
}

describe('rule 24: Tide hits terrain (every row of the DESIGN §6.5 table)', () => {
  it('rule 24: stone and ash become borrowed shallow water for 10 s, under = the ground', () => {
    const s = gridGame(['..']);
    const ash = idx(s, C(1), 1);
    s.grid.ground[ash] = MAT.ash;
    for (const i of [idx(s, C(0), 1), ash]) {
      const was = s.grid.ground[i]!;
      const ev = hit(s, 'tide', cellShape(i % s.grid.width, 1));
      expect(s.grid.ground[i]).toBe(MAT.shallow_water);
      expect(s.grid.borrowed[i]).toBe(1);
      expect(s.grid.under[i]).toBe(was);
      expect(s.grid.timer[i]).toBe(TIDE_TICKS);
      expect(ofType(ev, 'tided')).toHaveLength(1);
    }
    gridTicks(s, TIDE_TICKS - 1);
    expect(s.grid.ground[ash]).toBe(MAT.shallow_water);
    const ev = gridTicks(s, 1);
    expect(s.grid.ground[ash]).toBe(MAT.ash);
    expect(s.grid.ground[idx(s, C(0), 1)]).toBe(MAT.stone);
    expect(s.grid.borrowed[ash]).toBe(0);
    expect(ofType(ev, 'borrowedEnded')[0]!.count).toBe(2);
  });

  it('rule 24: a pit becomes borrowed deep water for 10 s; Frost on it makes an ice bridge that returns to pit', () => {
    const s = gridGame(['_']);
    const i = idx(s, 1, 1);
    tideAt(s, 1);
    expect(s.grid.ground[i]).toBe(MAT.deep_water);
    expect(s.grid.under[i]).toBe(MAT.pit);
    expect(s.room.solid[i]).toBe(1);
    hit(s, 'frost', cellShape(1, 1));
    expect(s.grid.ground[i]).toBe(MAT.ice_bridge);
    expect(s.room.solid[i]).toBe(0); // Tide then Frost crosses a gap
    expect(s.grid.borrowed[i]).toBe(1);
    gridTicks(s, (8 + 1.5) * 20);
    expect(s.grid.ground[i]).toBe(MAT.pit); // not deep water
    expect(s.grid.borrowed[i]).toBe(0);
  });

  it('rule 24: dirt becomes mud for good; Frost turns it to dirt and fire dries it (rules 10, 23)', () => {
    const s = gridGame([',,']);
    const i = idx(s, 1, 1);
    tideAt(s, 1);
    expect(s.grid.ground[i]).toBe(MAT.mud);
    expect(s.grid.borrowed[i]).toBe(0);
    gridTicks(s, 400);
    expect(s.grid.ground[i]).toBe(MAT.mud);
    hit(s, 'frost', cellShape(1, 1));
    expect(s.grid.ground[i]).toBe(MAT.dirt);
    const j = idx(s, 5, 1);
    tideAt(s, 5);
    hit(s, 'fire', cellShape(5, 1));
    gridTicks(s, 20);
    expect(s.grid.ground[j]).toBe(MAT.dirt);
  });

  it('rule 24: grass, bramble, wood, crates, barricades and oil barrels are wet for 10 s and cannot ignite', () => {
    const s = gridGame(['"*+c|b']);
    for (let tx = 0; tx < 6; tx++) {
      const i = idx(s, C(tx), 1);
      const was = s.grid.ground[i]!;
      tideAt(s, C(tx));
      expect(s.grid.ground[i], `tile ${tx}`).toBe(was);
      expect(s.grid.wet[i], `tile ${tx}`).toBe(defaultTuning.tide.wetSeconds * 20);
      hit(s, 'fire', cellShape(C(tx), 1));
      expect(s.grid.fire[i], `tile ${tx}`).toBe(0);
    }
    gridTicks(s, 200);
    const grass = idx(s, C(0), 1);
    expect(s.grid.wet[grass]).toBe(0);
    hit(s, 'fire', cellShape(C(0), 1));
    expect(s.grid.fire[grass]).toBeGreaterThan(0); // dry again: it burns
  });

  it('rule 24: a burning cell goes out, keeps its fuel and stays wet (no relight for 10 s)', () => {
    const s = field('"', 3, 1);
    const i = idx(s, 5, 1);
    hit(s, 'fire', cellShape(5, 1));
    gridTicks(s, 3);
    const fuel = s.grid.fuel[i]!;
    expect(s.grid.fire[i]).toBeGreaterThan(0);
    hit(s, 'tide', circle(6, 2, 8)); // the whole field
    expect(s.grid.fire[i]).toBe(0);
    expect(s.grid.fuel[i]).toBe(fuel);
    expect(s.grid.wet[i]).toBe(200);
    hit(s, 'fire', cellShape(5, 1));
    expect(s.grid.fire[i]).toBe(0);
    gridTicks(s, 200);
    hit(s, 'fire', cellShape(5, 1));
    expect(s.grid.fire[i]).toBeGreaterThan(0);
    expect(s.grid.fuel[i]).toBe(fuel); // the kept fuel burns first (as rule 9)
  });

  it('rule 24: a lit furnace vent is doused for 10 s (a borrowed walkable grate), then relights', () => {
    const s = gridGame(['f']);
    const i = idx(s, 1, 1);
    expect(s.room.solid[i]).toBe(1);
    hit(s, 'tide', circle(2, 2, 3));
    expect(s.grid.ground[i]).toBe(MAT.vent_doused);
    expect(s.grid.borrowed[i]).toBe(1);
    expect(s.grid.under[i]).toBe(MAT.vent_lit);
    expect(s.room.solid[i]).toBe(0);
    gridTicks(s, defaultTuning.tide.ventSeconds * 20);
    expect(s.grid.ground[i]).toBe(MAT.vent_lit);
    expect(s.room.solid[i]).toBe(1);
  });

  it('rule 24: borrowed water gets its timer back to 10 s', () => {
    const s = gridGame(['.']);
    const i = idx(s, 1, 1);
    tideAt(s, 1);
    gridTicks(s, 150);
    expect(s.grid.timer[i]).toBe(50);
    tideAt(s, 1);
    expect(s.grid.timer[i]).toBe(TIDE_TICKS);
    expect(s.grid.ground[i]).toBe(MAT.shallow_water);
  });

  it('rule 24: shallow and deep water, ice, ice bridges, mud, rime, metal, pylons and walls do not change', () => {
    const s = gridGame(['~wi:mM#']);
    const ib = idx(s, C(6), 2);
    s.grid.ground[ib] = MAT.ice_bridge;
    const rime = idx(s, C(6), 1);
    s.grid.ground[rime] = MAT.rime;
    const before = s.grid.ground.slice();
    const under = s.grid.under.slice();
    hit(s, 'tide', circle(14, 2, 20));
    expect([...s.grid.ground]).toEqual([...before]);
    expect([...s.grid.under]).toEqual([...under]);
    expect(s.grid.borrowed.every((b) => b === 0)).toBe(true);
    expect(s.grid.wet.every((w) => w === 0)).toBe(true);
  });

  it('rule 24: Lingering (and terrain duration) makes every Tide time 50% longer (15 s)', () => {
    const s = gridGame(['."f']);
    hit(s, 'tide', circle(6, 2, 8), { durationMult: 1.5 });
    expect(s.grid.timer[idx(s, 1, 1)]).toBe(300);
    expect(s.grid.wet[idx(s, 5, 1)]).toBe(300); // u16 since M8: 15 s doesn't clip at 255
    expect(s.grid.timer[idx(s, 9, 1)]).toBe(300);
  });

  it('rule 24: Tide is ownerless water; borrowed water keeps no owner and puts out an enemy fire as well', () => {
    const s = field('"', 2, 1);
    const i = idx(s, 1, 1);
    hit(s, 'fire', cellShape(1, 1), { owner: OWNER.enemy });
    hit(s, 'tide', cellShape(1, 1));
    expect(s.grid.fire[i]).toBe(0);
  });
});

describe('Tide with oil, charge and slot order (DESIGN §6.5)', () => {
  it('oil floats on borrowed water and stays on the ground when the water goes; burning oil stays out while wet', () => {
    const s = gridGame(['o']);
    const i = idx(s, 1, 1);
    hit(s, 'fire', cellShape(1, 1));
    expect(s.grid.fire[i]).toBe(255);
    tideAt(s, 1);
    expect(s.grid.fire[i]).toBe(0);
    expect(s.grid.ground[i]).toBe(MAT.shallow_water);
    expect(s.grid.surface[i]).toBe(SURFACE.oil);
    hit(s, 'fire', cellShape(1, 1));
    expect(s.grid.fire[i]).toBe(0); // wet: no relight
    gridTicks(s, TIDE_TICKS);
    expect(s.grid.ground[i]).toBe(MAT.stone);
    expect(s.grid.surface[i]).toBe(SURFACE.oil);
    hit(s, 'fire', cellShape(1, 1));
    expect(s.grid.fire[i]).toBe(255);
  });

  it('borrowed water conducts like shallow water; its charge ends when it returns to stone', () => {
    const s = gridGame(['....']);
    hit(s, 'tide', { kind: 'strip', x: 0, y: 2, dirX: 1, dirY: 0, length: 16, width: 3 });
    hit(s, 'storm', cellShape(1, 2));
    const far = idx(s, 14, 2);
    expect(s.grid.charge[far]).toBeGreaterThan(0);
    // Make the water go while it's still charged.
    for (let k = 0; k < s.grid.timer.length; k++) if (s.grid.borrowed[k] === 1) s.grid.timer[k] = 1;
    gridTicks(s, 1);
    expect(s.grid.ground[far]).toBe(MAT.stone);
    expect(s.grid.charge[far]).toBe(0);
  });

  it('charge already on the grid does not spread into water made after its event', () => {
    const s = gridGame(['~.']);
    hit(s, 'storm', cellShape(1, 1));
    tideAt(s, 5);
    gridTicks(s, 2);
    expect(s.grid.charge[idx(s, 5, 1)]).toBe(0);
  });

  it('slot order: [Tide, Fire] on stone makes water then steam; [Fire, Tide] places fire and puts it out', () => {
    const a = gridGame(['.']);
    hit(a, 'tide', cellShape(1, 1));
    const ev = hit(a, 'fire', cellShape(1, 1));
    expect(ofType(ev, 'steam')).toHaveLength(1);
    expect(a.grid.fire[idx(a, 1, 1)]).toBe(0);
    const b = gridGame(['.']);
    hit(b, 'fire', cellShape(1, 1));
    expect(b.grid.fire[idx(b, 1, 1)]).toBe(128);
    hit(b, 'tide', cellShape(1, 1));
    expect(b.grid.fire[idx(b, 1, 1)]).toBe(0);
    expect(b.grid.ground[idx(b, 1, 1)]).toBe(MAT.shallow_water);
  });
});

describe('rule 27: borrowed terrain goes back', () => {
  it('rule 27: [Tide, Frost] on stone is a 15 s ice path that returns to stone, not water', () => {
    const s = gridGame(['.']);
    const i = idx(s, 1, 1);
    hit(s, 'tide', cellShape(1, 1));
    hit(s, 'frost', cellShape(1, 1));
    expect(s.grid.ground[i]).toBe(MAT.ice);
    expect(s.grid.borrowed[i]).toBe(1);
    expect(s.grid.timer[i]).toBe(300);
    gridTicks(s, 299);
    expect(s.grid.ground[i]).toBe(MAT.ice);
    gridTicks(s, 1);
    expect(s.grid.ground[i]).toBe(MAT.stone);
    expect(s.grid.borrowed[i]).toBe(0);
  });

  it('rule 27: Fire on borrowed ice returns the cell to under at once, with steam', () => {
    const s = gridGame(['._']);
    hit(s, 'tide', circle(4, 2, 8));
    hit(s, 'frost', circle(4, 2, 8));
    expect(s.grid.ground[idx(s, 5, 1)]).toBe(MAT.ice_bridge);
    const ev = hit(s, 'fire', circle(4, 2, 8));
    expect(s.grid.ground[idx(s, 1, 1)]).toBe(MAT.stone);
    expect(s.grid.ground[idx(s, 5, 1)]).toBe(MAT.pit);
    expect(ofType(ev, 'steam')).toHaveLength(1);
    expect(s.grid.air[idx(s, 1, 1)]).toBe(2);
  });

  it('rule 27: map ice and map water are not borrowed (Frost-then-thaw on map water stays water)', () => {
    const s = gridGame(['~']);
    const i = idx(s, 1, 1);
    hit(s, 'frost', cellShape(1, 1));
    gridTicks(s, 300);
    expect(s.grid.ground[i]).toBe(MAT.shallow_water);
    gridTicks(s, 400);
    expect(s.grid.ground[i]).toBe(MAT.shallow_water);
  });

  it('rule 27: Hydromancer water is borrowed: frozen, it still returns to the ground (the old tempWater limit)', () => {
    const s = gridGame(['.']);
    const i = idx(s, 1, 1);
    placeTempWater(s, 2, 2, 1.5, 6, hydromancerGrounds);
    expect(s.grid.ground[i]).toBe(MAT.shallow_water);
    expect(s.grid.borrowed[i]).toBe(1);
    hit(s, 'frost', circle(2, 2, 2));
    expect(s.grid.ground[i]).toBe(MAT.ice);
    gridTicks(s, 300);
    expect(s.grid.ground[i]).toBe(MAT.stone);
    // Melted before its time, it is gone at once instead of becoming permanent water.
    placeTempWater(s, 2, 2, 1.5, 6, hydromancerGrounds);
    hit(s, 'frost', circle(2, 2, 2));
    hit(s, 'fire', circle(2, 2, 2));
    expect(s.grid.ground[i]).toBe(MAT.stone);
  });

  it('rule 27 / rule 30: Fire on a doused vent relights it at once; Frost and Storm change neither vent', () => {
    const s = gridGame(['f']);
    const i = idx(s, 1, 1);
    hit(s, 'frost', circle(2, 2, 3));
    hit(s, 'storm', circle(2, 2, 3));
    expect(s.grid.ground[i]).toBe(MAT.vent_lit);
    hit(s, 'tide', circle(2, 2, 3));
    hit(s, 'frost', circle(2, 2, 3));
    expect(s.grid.ground[i]).toBe(MAT.vent_doused);
    hit(s, 'storm', circle(2, 2, 3), { hitDamage: 10 });
    expect(s.grid.charge[i]).toBeGreaterThan(0); // conducts like metal floor
    hit(s, 'fire', circle(2, 2, 3));
    expect(s.grid.ground[i]).toBe(MAT.vent_lit);
    expect(s.grid.borrowed[i]).toBe(0);
    expect(s.grid.charge[i]).toBe(0);
  });
});
