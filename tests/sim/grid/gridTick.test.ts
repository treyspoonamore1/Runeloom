import { describe, expect, it } from 'vitest';
import {
  activeCount,
  cellAt,
  hashState,
  NEUTRAL_INPUT,
  prepareEnemyAI,
  spawnEnemy,
  step,
  terrainFireDps,
  hazardHurts,
  wakeRegion,
  type Footprint,
} from '../../../src/sim';
import { rasterize } from '../../../src/sim/grid/raster';
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
} from './helpers';

const cellsOf = (s: ReturnType<typeof field>, shape: Footprint) => {
  const l = rasterize(s.grid, shape);
  return Array.from(l.cells.subarray(0, l.len), (i) => [i % s.grid.width, Math.floor(i / s.grid.width)]);
};

describe('grid tick', () => {
  it('ticks every 3rd sim tick at 20 Hz', () => {
    const s = field('.', 4, 4);
    for (let k = 0; k < 9; k++) step(s, NEUTRAL_INPUT);
    expect(s.grid.tick).toBe(3);
  });

  it("hitstop doesn't advance the grid tick or desync its 3-tick rhythm", () => {
    const s = field('"', 4, 4);
    hit(s, 'fire', cellShape(8, 8));
    step(s, NEUTRAL_INPUT); // clock 1
    s.hitstopLeft = 0.1; // 6 frozen ticks
    const fuel = s.grid.fuel[idx(s, 8, 8)];
    for (let k = 0; k < 6; k++) step(s, NEUTRAL_INPUT);
    expect(s.hitstopLeft).toBe(0);
    expect(s.grid.tick).toBe(0);
    expect(s.grid.clock).toBe(1);
    expect(s.grid.fuel[idx(s, 8, 8)]).toBe(fuel);
    step(s, NEUTRAL_INPUT);
    expect(s.grid.tick).toBe(0);
    step(s, NEUTRAL_INPUT); // third non-hitstop tick
    expect(s.grid.tick).toBe(1);
    expect(s.grid.fuel[idx(s, 8, 8)]).toBe(fuel! - 1);
  });

  it('quiet terrain is not visited; burnt-out cells leave the active set', () => {
    const s = field('"', 8, 8);
    gridTicks(s, 5);
    expect(activeCount(s.grid.active)).toBe(0);
    hit(s, 'fire', cellShape(3, 3));
    expect(activeCount(s.grid.active)).toBe(1);
    gridTicks(s, 2000);
    expect(countCells(s, (i) => s.grid.fire[i]! > 0 || s.grid.airTimer[i]! > 0)).toBe(0);
    expect(activeCount(s.grid.active)).toBe(0);
  });

  it('cellIgnited and burntOut are batched per grid tick', () => {
    const s = field('"', 10, 10);
    hit(s, 'fire', circle(20, 20, 4));
    let ignitedEvents = 0;
    let burnt = 0;
    for (let k = 0; k < 60; k++) {
      const ev = gridTicks(s, 1);
      expect(ofType(ev, 'cellIgnited').length).toBeLessThanOrEqual(1);
      expect(ofType(ev, 'burntOut').length).toBeLessThanOrEqual(1);
      ignitedEvents += ofType(ev, 'cellIgnited').length;
      for (const e of ofType(ev, 'burntOut')) {
        burnt += e.count;
        expect(e.minX).toBeLessThanOrEqual(e.maxX);
      }
    }
    expect(ignitedEvents).toBeGreaterThan(10);
    expect(burnt).toBe(countCells(s, (i) => s.grid.ground[i] === MAT.ash));
  });

  it('the same seed and hits give the same grid and hash; another seed spreads differently', () => {
    const run = (seed: number) => {
      const s = field('"', 12, 12, seed);
      for (let k = 0; k < 120; k++) {
        if (k === 3) hit(s, 'fire', circle(24, 24, 2));
        if (k === 40) hit(s, 'storm', circle(10, 10, 5));
        step(s, NEUTRAL_INPUT);
      }
      return s;
    };
    const a = run(7);
    const b = run(7);
    expect(hashState(a)).toBe(hashState(b));
    expect(Buffer.from(a.grid.fire).equals(Buffer.from(b.grid.fire))).toBe(true);
    expect(Buffer.from(run(8).grid.fire).equals(Buffer.from(a.grid.fire))).toBe(false);
  });

  it('every grid change shows in the state hash', () => {
    const s = field('~', 4, 4);
    const h0 = hashState(s);
    hit(s, 'storm', cellShape(3, 3));
    const h1 = hashState(s);
    expect(h1).not.toBe(h0);
    gridTicks(s, 1);
    expect(hashState(s)).not.toBe(h1);
  });

  it('walkability changes rebuild the AI flow field', () => {
    // A bramble wall splits the room; burning it opens the tiles to the flow field.
    const s = gridGame(['....*....', '....*....', '....*....']);
    s.cheats.noAI = false;
    spawnEnemy(s, 'tinderling', 30, 6);
    prepareEnemyAI(s);
    const t = 1 * 9 + 4; // tile (4, 1)
    expect(s.flow.walkable[t]).toBe(0);
    hit(s, 'fire', { kind: 'line', x0: 18, y0: 0, x1: 18, y1: 12, width: 4.1 });
    gridTicks(s, 21);
    expect(s.grid.ground[idx(s, 18, 6)]).toBe(MAT.ash);
    s.tick++;
    prepareEnemyAI(s);
    expect(s.flow.walkable[t]).toBe(1);
    expect(s.flow.walkVersion).toBe(s.grid.walkVersion);
    expect(s.flow.builtTick).toBe(s.tick);
  });

  it('wakeRegion re-activates busy cells written directly and resyncs the masks', () => {
    const s = field('.', 4, 4);
    const i = idx(s, 5, 5);
    s.grid.fire[i] = 128;
    s.grid.fuel[i] = 3;
    s.grid.ground[idx(s, 6, 6)] = MAT.wall;
    gridTicks(s, 5);
    expect(s.grid.fire[i]).toBe(128); // not active: untouched
    wakeRegion(s, 4, 4, 7, 7);
    expect(s.room.solid[idx(s, 6, 6)]).toBe(1);
    gridTicks(s, 3);
    expect(s.grid.fire[i]).toBe(0);
  });
});

describe('applyElement rasterization', () => {
  it('circle: cells whose centers are inside', () => {
    const s = field('.', 4, 4);
    expect(cellsOf(s, circle(5, 5, 1))).toEqual([
      [4, 4],
      [5, 4],
      [4, 5],
      [5, 5],
    ]);
    expect(cellsOf(s, circle(5.5, 5.5, 1)).length).toBe(5);
  });

  it('a footprint covering no cell center reaches the cell under its origin', () => {
    const s = field('.', 4, 4);
    expect(cellsOf(s, circle(5.9, 5.1, 0.2))).toEqual([[5, 5]]);
    expect(cellsOf(s, { kind: 'line', x0: 2.2, y0: 2.2, x1: 2.3, y1: 2.3, width: 0.1 })).toEqual([[2, 2]]);
  });

  it('line with width', () => {
    const s = field('.', 4, 4);
    const c = cellsOf(s, { kind: 'line', x0: 2, y0: 5.5, x1: 8, y1: 5.5, width: 1 });
    // A capsule: rounded ends reach width / 2 past the end points.
    expect(c).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((x) => [x, 5]));
    const d = cellsOf(s, { kind: 'line', x0: 0, y0: 0, x1: 8, y1: 8, width: 1 });
    for (let k = 0; k < 8; k++) expect(d).toContainEqual([k, k]);
    expect(d).not.toContainEqual([0, 7]);
  });

  it('strip: an oriented rectangle from its start', () => {
    const s = field('.', 4, 4);
    const c = cellsOf(s, { kind: 'strip', x: 2, y: 5, dirX: 1, dirY: 0, length: 4, width: 2 });
    expect(c).toEqual([
      [2, 4],
      [3, 4],
      [4, 4],
      [5, 4],
      [2, 5],
      [3, 5],
      [4, 5],
      [5, 5],
    ]);
    // Facing up (dirY −1) from (8, 10): cells above, none below.
    const up = cellsOf(s, { kind: 'strip', x: 8, y: 10, dirX: 0, dirY: -2, length: 3, width: 2 });
    expect(up).toHaveLength(6);
    for (const [, y] of up) expect(y).toBeLessThan(10);
  });

  it('arc: a sector facing its direction', () => {
    const s = field('.', 4, 4);
    // 90° sector (half angle 45°, cos ≈ 0.7071) facing +x from (8, 8), radius 3.
    const c = cellsOf(s, { kind: 'arc', x: 8, y: 8, dirX: 1, dirY: 0, r: 3, halfAngleCos: Math.SQRT1_2 });
    expect(c.length).toBeGreaterThan(4);
    for (const [x, y] of c) {
      const dx = x + 0.5 - 8;
      const dy = y + 0.5 - 8;
      expect(dx).toBeGreaterThan(0);
      expect(Math.abs(dy)).toBeLessThanOrEqual(dx);
    }
    expect(c).toContainEqual([10, 8]);
    expect(c).not.toContainEqual([6, 8]);
  });
});

describe('query hooks', () => {
  it('cellAt reports what is under a point', () => {
    const s = gridGame(['~o.']);
    hit(s, 'storm', cellShape(1, 1), { owner: OWNER.enemy });
    hit(s, 'fire', cellShape(5, 1));
    gridTicks(s, 1);
    const w = cellAt(s, 1.5, 1.2);
    expect(w).toMatchObject({
      cx: 1,
      cy: 1,
      charged: true,
      chargeFalloff: 1,
      chargeOwner: OWNER.enemy,
      burning: false,
    });
    expect(w.material.id).toBe('shallow_water');
    const o = cellAt(s, 5.5, 1.5);
    expect(o).toMatchObject({ burning: true, oil: true, oilBurning: true, fireIntensity: 255, smoke: true });
    expect(cellAt(s, -1, 0).material.id).toBe('wall');
    expect(s.grid.air[idx(s, 5, 1)]).toBe(AIR.smoke);
  });

  it('terrain-fire DPS is 10% of refLife(area level), doubled on oil', () => {
    expect(terrainFireDps(gridGame(['.']), false)).toBeCloseTo(5, 9);
    expect(terrainFireDps(gridGame(['.']), true)).toBeCloseTo(10, 9);
    expect(terrainFireDps(gridGame(['.'], 1, 3), false)).toBeCloseTo(5 * 1.12 * 1.12, 9);
  });

  it('hazards hurt the other team and world hazards hurt everyone', () => {
    expect(hazardHurts(OWNER.player, OWNER.player)).toBe(false);
    expect(hazardHurts(OWNER.player, OWNER.enemy)).toBe(true);
    expect(hazardHurts(OWNER.world, OWNER.player)).toBe(true);
  });
});
