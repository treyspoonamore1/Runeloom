import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ElementApplication } from '../../../src/sim/grid/paint';

// Record every applyElement call with the tick it happened on; the rules engine is a different
// agent's job, so these tests check WHEN and WHERE the lab applies elements, not what they do.
const calls: Array<{ tick: number; app: ElementApplication }> = [];
let tickSource: () => number = () => -1;
vi.mock('../../../src/sim/grid/paint', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/sim/grid/paint')>()),
  applyElement: (_state: unknown, app: ElementApplication) => void calls.push({ tick: tickSource(), app }),
}));

import { labFrontTiles, labStations, type LabStation } from '../../../data/lab';
import { MAT, OWNER } from '../../../data/materials';
import {
  createGame,
  hashState,
  NEUTRAL_INPUT,
  nearestStation,
  runAllStations,
  runStation,
  step,
  stationArea,
  TILE_CELLS,
  type GameState,
} from '../../../src/sim';
import { createGrid } from '../../../src/sim/grid/grid';
import { loadRoomText } from '../../../tools/lib/rooms';

const labText = loadRoomText('test/lab');

function lab(seed = 1): GameState {
  const state = createGame({ seed, roomText: labText });
  tickSource = () => state.tick;
  return state;
}

function run(state: GameState, ticks: number): void {
  for (let i = 0; i < ticks; i++) step(state, NEUTRAL_INPUT);
}

/** A tiny station at the first bay for scheduling tests. */
const mini: LabStation[] = [
  {
    rule: 0,
    label: 'mini',
    rect: { tx: 4, ty: 1, w: 6, h: 6 },
    script: [
      { at: 0, element: 'frost', shape: { kind: 'circle', x: 2, y: 3, r: 1 } },
      {
        at: 0.5,
        element: 'fire',
        shape: { kind: 'circle', x: 12, y: 8, r: 2 },
        owner: 'world',
        hitDamage: 7,
      },
      {
        at: 1,
        element: 'storm',
        shape: { kind: 'line', x0: 1, y0: 1, x1: 5, y1: 1, width: 2 },
      },
    ],
    spawns: [{ kind: 'dummy', x: 6, y: 6 }],
  },
  {
    rule: 0,
    label: 'second',
    rect: { tx: 11, ty: 1, w: 6, h: 6 },
    script: [{ at: 0.25, element: 'fire', shape: { kind: 'circle', x: 3, y: 3, r: 1 } }],
  },
];

beforeEach(() => {
  calls.length = 0;
});

describe('lab data', () => {
  const state = lab();
  const ruleNumbers = new Set(labStations.map((s) => s.rule));

  it('has a station for every rule M3 implements, and (M8) for rules 21, 24 and 27–32', () => {
    for (let r = 1; r <= 32; r++) expect(ruleNumbers.has(r), `rule ${r}`).toBe(true);
    expect(labStations.filter((s) => s.rule === 0).length).toBeGreaterThanOrEqual(3);
  });

  it('labels start with the rule number, and stations are in rule order within the M3 and M8 rows', () => {
    const M8_FIRST = 32; // bays of rows 4 and 5
    for (const part of [labStations.slice(0, M8_FIRST), labStations.slice(M8_FIRST)]) {
      let last = 0;
      for (const s of part) {
        if (s.rule === 0) continue;
        expect(s.label.startsWith(String(s.rule).padStart(2, '0') + ' · '), s.label).toBe(true);
        expect(s.rule).toBeGreaterThanOrEqual(last);
        last = s.rule;
      }
    }
  });

  it('puts every bay inside the room, without overlaps, with its script and spawns inside', () => {
    const room = state.room;
    const seen = new Set<number>();
    for (const s of labStations) {
      const a = stationArea(s);
      expect(a.x0 >= 0 && a.y0 >= 0 && a.x1 <= room.width && a.y1 <= room.height, s.label).toBe(true);
      for (let cy = a.y0; cy < a.y1; cy++)
        for (let cx = a.x0; cx < a.x1; cx++) {
          const i = cy * room.width + cx;
          expect(seen.has(i), `${s.label} overlaps another bay`).toBe(false);
          seen.add(i);
        }
      const w = a.x1 - a.x0;
      const h = a.y1 - a.y0;
      const within = (x: number, y: number): boolean => x >= 0 && y >= 0 && x <= w && y <= h;
      for (const st of s.script) {
        expect(st.at, s.label).toBeGreaterThanOrEqual(0);
        expect(st.at, `${s.label} runs longer than 3 s`).toBeLessThanOrEqual(3);
        const sh = st.shape;
        if (sh.kind === 'circle') expect(within(sh.x, sh.y), s.label).toBe(true);
        if (sh.kind === 'line') {
          expect(within(sh.x0, sh.y0), s.label).toBe(true);
          expect(within(sh.x1, sh.y1), s.label).toBe(true);
        }
      }
      for (const sp of s.spawns ?? []) expect(within(sp.x, sp.y), `${s.label} spawn`).toBe(true);
    }
  });

  it('opens every bay onto the walkway: the strip south of it is floor you can walk to from the start', () => {
    const room = state.room;
    const start = { tx: Math.floor(room.spawnX / TILE_CELLS), ty: Math.floor(room.spawnY / TILE_CELLS) };
    const walk = (tx: number, ty: number): boolean =>
      tx >= 0 &&
      ty >= 0 &&
      tx < room.tilesW &&
      ty < room.tilesH &&
      room.solid[ty * 4 * room.width + tx * 4] === 0;
    const reach = new Set<number>([start.ty * room.tilesW + start.tx]);
    const todo = [start];
    while (todo.length > 0) {
      const { tx, ty } = todo.pop()!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (walk(nx, ny) && !reach.has(ny * room.tilesW + nx)) {
          reach.add(ny * room.tilesW + nx);
          todo.push({ tx: nx, ty: ny });
        }
      }
    }
    for (const s of labStations)
      for (let k = 0; k < labFrontTiles; k++)
        for (let x = 0; x < s.rect.w; x++)
          expect(reach.has((s.rect.ty + s.rect.h + k) * room.tilesW + s.rect.tx + x), s.label).toBe(true);
  });

  it('runs all stations without trouble (every spawned enemy kind exists)', () => {
    const state2 = lab();
    expect(runAllStations(state2)).toBe(labStations.length);
    expect(state2.lab.runs).toBe(labStations.length);
  });
});

describe('runStation: restoring', () => {
  it('reverts every change inside the station and leaves the rest alone', () => {
    const state = lab();
    const pristine = createGrid(state.room);
    const idx = 6; // 05 · Fire melts ice
    const a = stationArea(labStations[idx]!);
    const inside = (a.y0 + 5) * state.grid.width + a.x0 + 5;
    const outside = (a.y0 + 5) * state.grid.width + a.x1 + 1; // the wall right of the bay
    const other = labStations[idx + 1]!;
    const o = stationArea(other);
    const inOther = (o.y0 + 5) * state.grid.width + o.x0 + 5;
    for (const i of [inside, outside, inOther]) {
      state.grid.ground[i] = MAT.ash;
      state.grid.fire[i] = 200;
      state.grid.charge[i] = 9;
      state.grid.surface[i] = 1;
      state.grid.owner[i] = OWNER.enemy;
    }
    const version = state.grid.version;
    runStation(state, idx);
    expect(state.grid.ground[inside]).toBe(pristine.ground[inside]);
    expect(state.grid.fire[inside]).toBe(0);
    expect(state.grid.charge[inside]).toBe(0);
    expect(state.grid.surface[inside]).toBe(pristine.surface[inside]);
    expect(state.grid.owner[inside]).toBe(pristine.owner[inside]);
    expect(state.grid.ground[outside]).toBe(MAT.ash);
    expect(state.grid.ground[inOther]).toBe(MAT.ash);
    expect(state.grid.version).toBeGreaterThan(version);
  });

  it('restores the whole area, field by field, after it was scribbled over', () => {
    const state = lab();
    const pristine = createGrid(state.room);
    const idx = 14;
    const a = stationArea(labStations[idx]!);
    for (let cy = a.y0; cy < a.y1; cy++)
      for (let cx = a.x0; cx < a.x1; cx++) {
        const i = cy * state.grid.width + cx;
        state.grid.ground[i] = MAT.pit;
        state.grid.timer[i] = 77;
        state.grid.wet[i] = 5;
        state.grid.air[i] = 1;
        state.grid.fuel[i] = 300;
      }
    runStation(state, idx);
    for (let cy = a.y0; cy < a.y1; cy++)
      for (let cx = a.x0; cx < a.x1; cx++) {
        const i = cy * state.grid.width + cx;
        expect(state.grid.ground[i]).toBe(pristine.ground[i]);
        expect(state.grid.timer[i]).toBe(0);
        expect(state.grid.wet[i]).toBe(0);
        expect(state.grid.air[i]).toBe(0);
        expect(state.grid.fuel[i]).toBe(0);
      }
  });

  it('throws on a station that does not exist', () => {
    expect(() => runStation(lab(), 999)).toThrow(RangeError);
  });
});

describe('runStation: scheduling', () => {
  it('applies the steps at second 0 at once, and the rest on their ticks, in room cells', () => {
    const state = lab();
    run(state, 10);
    const start = state.tick;
    runStation(state, 0, mini);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.tick).toBe(start);
    expect(calls[0]!.app.element).toBe('frost');
    // Bay 0 starts at tile (4, 1) = cell (16, 4).
    expect(calls[0]!.app.shape).toMatchObject({ kind: 'circle', x: 18, y: 7, r: 1 });
    expect(calls[0]!.app.owner).toBe(OWNER.player);

    run(state, 61);
    expect(calls).toHaveLength(3);
    expect(calls[1]!.tick).toBe(start + 30);
    expect(calls[1]!.app).toMatchObject({
      element: 'fire',
      owner: OWNER.world,
      hitDamage: 7,
      durationMult: 1,
    });
    expect(calls[1]!.app.shape).toMatchObject({ kind: 'circle', x: 28, y: 12 });
    expect(calls[2]!.tick).toBe(start + 60);
    expect(calls[2]!.app.shape).toMatchObject({ kind: 'line', x0: 17, y0: 5, x1: 21, y1: 5, width: 2 });
    expect(state.lab.tasks).toHaveLength(0);
  });

  it('keeps stations running at the same time in tick order', () => {
    const state = lab();
    runStation(state, 0, mini);
    runStation(state, 1, mini);
    calls.length = 0;
    run(state, 61);
    expect(calls.map((c) => c.tick)).toEqual([15, 30, 60]);
  });

  it('running a station again replaces its pending steps instead of doubling them', () => {
    const state = lab();
    runStation(state, 0, mini);
    run(state, 10);
    runStation(state, 0, mini);
    expect(state.lab.tasks).toHaveLength(2);
    calls.length = 0;
    run(state, 61);
    expect(calls).toHaveLength(2);
  });

  it('does not fire a step before its tick', () => {
    const state = lab();
    runStation(state, 0, mini);
    calls.length = 0;
    run(state, 29);
    expect(calls).toHaveLength(0);
    run(state, 1);
    expect(calls).toHaveLength(1);
  });

  it('runAllStations runs every station', () => {
    const state = lab();
    expect(runAllStations(state, mini)).toBe(2);
    expect(state.lab.runs).toBe(2);
    expect(state.lab.tasks).toHaveLength(3);
  });
});

describe('runStation: entities', () => {
  it('spawns the station entities at their cells and clears old ones inside the area only', () => {
    const state = lab();
    runStation(state, 0, mini);
    expect(state.enemies).toHaveLength(1);
    expect(state.enemies[0]).toMatchObject({ kind: 'dummy', x: 22, y: 10 });
    // A stray enemy inside the bay and one in the next bay.
    const a = stationArea(mini[0]!);
    const b = stationArea(mini[1]!);
    const stray = state.enemies[0]!;
    stray.x = a.x0 + 3;
    stray.y = a.y0 + 3;
    state.enemies.push({ ...stray, id: 99, x: b.x0 + 3, y: b.y0 + 3 });
    runStation(state, 0, mini);
    expect(state.enemies.map((e) => e.id).includes(99)).toBe(true);
    expect(state.enemies.filter((e) => e.id !== 99)).toHaveLength(1);
    expect(state.enemies.find((e) => e.id !== 99)!.x).toBe(22);
    expect(state.enemies.find((e) => e.id !== 99)!.id).not.toBe(stray.id);
  });

  it("places the bays' real entities: the rule 19 bay has five dummies, rule 22 an aggroed Tinderling", () => {
    const state = lab();
    const i19 = labStations.findIndex((s) => s.rule === 19);
    const i22 = labStations.findIndex((s) => s.rule === 22);
    runStation(state, i19);
    expect(state.enemies.filter((e) => e.kind === 'dummy')).toHaveLength(5);
    runStation(state, i22);
    const t = state.enemies.find((e) => e.kind === 'tinderling')!;
    expect(t.ai.mode).not.toBe('idle');
  });

  it('rule 20: freezes the Shieldbearer, then kills it, and it shatters', () => {
    const state = lab();
    const i = labStations.findIndex((s) => s.rule === 20);
    runStation(state, i);
    const sb = state.enemies.find((e) => e.kind === 'shieldbearer')!;
    run(state, 30);
    expect(sb.ailments.freeze.timeLeft).toBeGreaterThan(0);
    const deaths: boolean[] = [];
    for (let t = 0; t < 60; t++) {
      step(state, NEUTRAL_INPUT);
      for (const e of state.events) if (e.type === 'death') deaths.push(e.shattered);
    }
    expect(deaths).toEqual([true]);
    expect(state.enemies.some((e) => e.kind === 'shieldbearer')).toBe(false);
  });
});

describe('nearestStation', () => {
  it('picks the bay you stand in, or in front of, and otherwise the closest', () => {
    const state = lab();
    const c = 5; // bay 5: row 0, column 5
    const a = stationArea(labStations[c]!);
    state.player.x = a.x0 + 10;
    state.player.y = a.y0 + 10;
    expect(nearestStation(state)).toBe(c);
    state.player.y = a.y1 + 2; // the walkway just below
    expect(nearestStation(state)).toBe(c);
    state.player.y = a.y1 + labFrontTiles * TILE_CELLS - 1; // still its walkway, next to the bay row below
    expect(nearestStation(state)).toBe(c);
    state.player.x = 2 * TILE_CELLS; // the west spine, level with row 1
    state.player.y = labStations[8]!.rect.ty * TILE_CELLS + 8;
    expect(nearestStation(state)).toBe(8);
  });

  it('is -1 with no stations', () => {
    expect(nearestStation(lab(), [])).toBe(-1);
  });
});

describe('determinism', () => {
  const play = (seed: number): number[] => {
    const state = lab(seed);
    runStation(
      state,
      labStations.findIndex((s) => s.rule === 11),
    );
    const hashes: number[] = [];
    for (let i = 0; i < 6; i++) {
      run(state, 30);
      hashes.push(hashState(state));
    }
    return hashes;
  };

  it('gives the same hashes on every run', () => {
    expect(play(3)).toEqual(play(3));
  });

  it('hashes the pending steps: a lab run changes the hash, and a different station differs', () => {
    const a = lab();
    const b = lab();
    expect(hashState(a)).toBe(hashState(b));
    runStation(a, 3);
    expect(hashState(a)).not.toBe(hashState(b));
    runStation(b, 4);
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('hashes a pending step even when two states differ only in when it fires', () => {
    const a = lab();
    const b = lab();
    runStation(a, 0, mini);
    runStation(b, 0, mini);
    expect(hashState(a)).toBe(hashState(b));
    b.lab.tasks[0]!.tick += 1;
    expect(hashState(a)).not.toBe(hashState(b));
  });
});
