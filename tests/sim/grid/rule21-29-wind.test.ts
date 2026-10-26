/**
 * Wind on the grid (M8, DESIGN §6.6): rule 21 (spread factor and drift), rule 29 (fog), the gust
 * records and their per-team cap.
 */
import { describe, expect, it } from 'vitest';
import { AIR } from '../../../data/materials';
import { defaultTuning } from '../../../data/tuning';
import { createGame, NEUTRAL_INPUT, spawnEnemy, step, type GameState } from '../../../src/sim';
import { setAir } from '../../../src/sim/grid/cells';
import { windAt, windFactor, windFactors, writeGust } from '../../../src/sim/grid/wind';
import { MAT, OWNER, cellShape, circle, gridTicks, hit, idx, ofType } from './helpers';

function windRoom(rows: string[], header = '', seed = 1): GameState {
  return createGame({
    seed,
    roomText: `@id test/wind\n${header}${rows.join('\n')}\n`,
    spawnRoomEnemies: false,
  });
}

const E = 1;
const NE = 2;
const N = 3;
const S = 7;
const SE = 8;

describe('rule 21: the wind factor table', () => {
  it('rule 21: ×2 downwind, ×0.25 upwind, ×1 across; a diagonal wind has two of each; no wind is ×1', () => {
    const s = windRoom(['...']);
    const t = windFactors(s);
    // Neighbor order +x, −x, +y (south), −y (north).
    expect([...t.subarray(0, 4)]).toEqual([1, 1, 1, 1]);
    expect([...t.subarray(E * 4, E * 4 + 4)]).toEqual([2, 0.25, 1, 1]);
    expect([...t.subarray(N * 4, N * 4 + 4)]).toEqual([1, 1, 0.25, 2]);
    expect([...t.subarray(S * 4, S * 4 + 4)]).toEqual([1, 1, 2, 0.25]);
    expect([...t.subarray(NE * 4, NE * 4 + 4)]).toEqual([2, 0.25, 0.25, 2]);
    expect([...t.subarray(SE * 4, SE * 4 + 4)]).toEqual([2, 0.25, 2, 0.25]);
    for (let d = 1; d <= 8; d++) {
      const row = [...t.subarray(d * 4, d * 4 + 4)];
      expect(row.filter((v) => v === 2).length + row.filter((v) => v === 0.25).length).toBe(
        d % 2 === 1 ? 2 : 4,
      );
    }
  });

  it("rule 21: a cell's wind is its gust while it runs, else the room wind", () => {
    const s = windRoom(['.....', '.....'], '@wind w\n');
    const i = idx(s, 8, 4);
    expect(windAt(s, i)).toBe(5);
    writeGust(s, { x: 8, y: 2.5, dirX: 0, dirY: 1, radius: 6, angleDeg: 60, seconds: 1, team: 'player' });
    expect(windAt(s, i)).toBe(S);
    expect(windFactor(s, i, i + s.grid.width)).toBe(2);
    gridTicks(s, 20);
    expect(windAt(s, i)).toBe(5);
    expect(s.grid.gustDir[i]).toBe(0);
    expect(s.grid.gusts).toHaveLength(0);
  });
});

/** Cells east (x > x0) and west (x < x0) of an ignition line that burnt or burn after 2 s of grid ticks, summed over seeds. */
function spread(header: string, gust = false): { east: number; west: number } {
  let east = 0;
  let west = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const s = windRoom(
      Array.from({ length: 4 }, () => '"'.repeat(30)),
      header,
      seed,
    );
    const x0 = 60;
    hit(s, 'fire', { kind: 'line', x0: x0 + 0.5, y0: 0, x1: x0 + 0.5, y1: 16, width: 0.5 });
    for (let t = 0; t < 40; t++) {
      if (gust && t % 20 === 0)
        writeGust(s, { x: 0, y: 8, dirX: 1, dirY: 0, radius: 200, angleDeg: 60, seconds: 1, team: 'player' });
      gridTicks(s, 1);
    }
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 120; x++) {
        const i = idx(s, x, y);
        if (s.grid.fire[i] === 0 && s.grid.ground[i] !== MAT.ash) continue;
        if (x > x0) east++;
        else if (x < x0) west++;
      }
  }
  return { east, west };
}

describe('rule 21: fire spread under wind (seeded, 2 s)', () => {
  const calm = spread('');

  it('rule 21: room wind: downwind spread at least 1.6× and upwind at most 0.4× the windless count', () => {
    const windy = spread('@wind e\n');
    expect(calm.east).toBeGreaterThan(200);
    expect(windy.east).toBeGreaterThanOrEqual(1.6 * calm.east);
    expect(windy.west).toBeLessThanOrEqual(0.4 * calm.west);
  });

  it('rule 21: a gust does the same while it runs', () => {
    const gusty = spread('', true);
    expect(gusty.east).toBeGreaterThanOrEqual(1.6 * calm.east);
    expect(gusty.west).toBeLessThanOrEqual(0.4 * calm.west);
  });

  it('rule 21: wind has no owner: spread fire keeps its own', () => {
    const s = windRoom(['""""'], '@wind e\n');
    hit(s, 'fire', cellShape(1, 1), { owner: OWNER.enemy });
    gridTicks(s, 40);
    for (let i = 0; i < s.grid.fire.length; i++)
      if (s.grid.fire[i]! > 0) expect(s.grid.owner[i]).toBe(OWNER.enemy);
  });
});

describe('rule 21: smoke and steam drift', () => {
  const smokeRow = (s: GameState, x0: number, x1: number, y: number, ticks = 200) => {
    for (let x = x0; x <= x1; x++) setAir(s.grid, idx(s, x, y), AIR.smoke, ticks);
  };
  const smokeAt = (s: GameState, y: number) => {
    const xs: number[] = [];
    for (let x = 0; x < s.grid.width; x++) if (s.grid.air[idx(s, x, y)] === AIR.smoke) xs.push(x);
    return xs;
  };

  it('rule 21: room wind moves smoke one cell downwind every 8 grid ticks (2.5 cells/s), as a whole', () => {
    const s = windRoom(['..........'], '@wind e\n');
    smokeRow(s, 10, 12, 2);
    gridTicks(s, 7);
    expect(smokeAt(s, 2)).toEqual([10, 11, 12]);
    gridTicks(s, 1);
    expect(smokeAt(s, 2)).toEqual([11, 12, 13]);
    gridTicks(s, 32);
    expect(smokeAt(s, 2)).toEqual([15, 16, 17]); // 5 cells in 2 s
  });

  it('rule 21: a gust moves it every 4 grid ticks (5 cells/s); steam drifts too', () => {
    const s = windRoom(['..........']);
    smokeRow(s, 10, 10, 2);
    setAir(s.grid, idx(s, 10, 1), AIR.steam, 200);
    writeGust(s, { x: 4, y: 2, dirX: 1, dirY: 0, radius: 40, angleDeg: 60, seconds: 2, team: 'player' });
    gridTicks(s, 20);
    expect(smokeAt(s, 2)).toEqual([15]);
    expect(s.grid.air[idx(s, 15, 1)]).toBe(AIR.steam);
  });

  it('rule 21: a diagonal wind alternates x and y steps; shot-blocking cells stop drift', () => {
    const s = windRoom(['......', '......', '......'], '@wind ne\n');
    setAir(s.grid, idx(s, 4, 8), AIR.smoke, 250);
    gridTicks(s, 32); // 4 moves
    const at = [] as number[];
    for (let i = 0; i < s.grid.air.length; i++) if (s.grid.air[i] === AIR.smoke) at.push(i);
    expect(at).toEqual([idx(s, 6, 6)]);
    const w = windRoom(['...#'], '@wind e\n');
    setAir(w.grid, idx(w, 10, 1), AIR.smoke, 200);
    gridTicks(w, 64);
    expect(w.grid.air[idx(w, 11, 1)]).toBe(AIR.smoke); // piled against the wall
  });

  it('rule 21: burning ground smoke drifts downwind and carries its Blind', () => {
    const s = windRoom(['"...'], '@wind e\n');
    hit(s, 'fire', circle(2, 2, 2));
    gridTicks(s, 20);
    let far = 0;
    for (let y = 0; y < 4; y++)
      for (let x = 5; x < 16; x++) if (s.grid.air[idx(s, x, y)] === AIR.smoke) far++;
    expect(far).toBeGreaterThan(0);
  });
});

describe('rule 29: fog', () => {
  const FOG = '@fog 0 0 3 0\n';

  it('rule 29: a gust clears fog for 10 s, then it rolls back in; Lingering does not lengthen it', () => {
    const s = windRoom(['....'], FOG);
    const i = idx(s, 6, 2);
    expect(s.grid.air[i]).toBe(AIR.fog);
    const ev = (() => {
      s.events.length = 0;
      writeGust(s, { x: 2, y: 2, dirX: 1, dirY: 0, radius: 8, angleDeg: 60, seconds: 6, team: 'player' });
      return [...s.events];
    })();
    expect(ofType(ev, 'fogCleared').length).toBe(1);
    expect(s.grid.air[i]).toBe(AIR.none);
    gridTicks(s, 199);
    expect(s.grid.air[i]).toBe(AIR.none);
    gridTicks(s, 1);
    expect(s.grid.air[i]).toBe(AIR.fog);
  });

  it('rule 29: Fire clears fog for 8 s (a Lingering fire too); placed fire on fogged stone keeps it clear while burning', () => {
    const s = windRoom(['....'], FOG);
    const i = idx(s, 6, 2);
    hit(s, 'fire', cellShape(6, 2), { durationMult: 1.5 });
    expect(s.grid.air[i]).toBe(AIR.none);
    gridTicks(s, 159);
    expect(s.grid.air[i]).toBe(AIR.none);
    gridTicks(s, 1);
    expect(s.grid.air[i]).toBe(AIR.fog);
  });

  it('rule 29: room wind does not move fog, and fog never drifts; smoke drifting through leaves fog behind', () => {
    const s = windRoom(['....'], `${FOG}@wind e\n`);
    const before = [...s.grid.air];
    gridTicks(s, 200);
    expect([...s.grid.air]).toEqual(before);
    setAir(s.grid, idx(s, 2, 2), AIR.smoke, 100);
    gridTicks(s, 8);
    expect(s.grid.air[idx(s, 3, 2)]).toBe(AIR.smoke);
    expect(s.grid.air[idx(s, 2, 2)]).toBe(AIR.fog);
  });

  it('rule 29: fog never Blinds enemies (only smoke and steam do)', () => {
    const s = windRoom(['......'], '@fog 0 0 5 0\n');
    const d = spawnEnemy(s, 'dummy', 10, 2);
    s.cheats.noAI = true;
    for (let k = 0; k < 3; k++) step(s, NEUTRAL_INPUT);
    expect(s.grid.air[idx(s, 10, 2)]).toBe(AIR.fog);
    expect(d.terrain.blind).toBe(false);
    setAir(s.grid, idx(s, 10, 2), AIR.smoke, 40);
    step(s, NEUTRAL_INPUT);
    expect(d.terrain.blind).toBe(true);
  });
});

describe('gust records', () => {
  it('each team keeps at most wind.maxGusts gusts: one more ends its oldest early; enemy gusts are separate', () => {
    const s = windRoom(['................']);
    const max = defaultTuning.wind.maxGusts;
    const gust = (x: number, team: 'player' | 'enemy') =>
      writeGust(s, { x, y: 2, dirX: 0, dirY: 1, radius: 1.5, angleDeg: 60, seconds: 2, team });
    for (let k = 0; k < max; k++) gust(2 + 4 * k, 'player');
    gust(60, 'enemy');
    expect(s.grid.gusts).toHaveLength(max + 1);
    expect(s.grid.gustTimer[idx(s, 2, 2)]).toBeGreaterThan(0);
    gust(2 + 4 * max, 'player');
    expect(s.grid.gusts.filter((g) => g.team === 0)).toHaveLength(max);
    expect(s.grid.gustTimer[idx(s, 2, 2)]).toBe(0); // the oldest ended
    expect(s.grid.gustTimer[idx(s, 6, 2)]).toBeGreaterThan(0);
    expect(s.grid.gustTimer[idx(s, 60, 2)]).toBeGreaterThan(0); // the enemy's stays
  });

  it('a newer gust overwrites an older one cell by cell, and ending the older leaves the newer', () => {
    const s = windRoom(['........', '........']);
    writeGust(s, { x: 2, y: 2, dirX: 1, dirY: 0, radius: 10, angleDeg: 60, seconds: 2, team: 'player' });
    gridTicks(s, 5);
    writeGust(s, { x: 6, y: 2, dirX: 0, dirY: 1, radius: 4, angleDeg: 60, seconds: 2, team: 'player' });
    const i = idx(s, 6, 4);
    expect(s.grid.gustDir[i]).toBe(S);
    s.tuning.wind.maxGusts = 2;
    writeGust(s, { x: 30, y: 2, dirX: 1, dirY: 0, radius: 1, angleDeg: 60, seconds: 2, team: 'player' });
    expect(s.grid.gustTimer[idx(s, 8, 2)]).toBe(0); // the first gust ended early
    expect(s.grid.gustDir[i]).toBe(S); // the cell the second one took keeps its gust
    expect(s.grid.gustTimer[i]).toBeGreaterThan(0);
  });
});
