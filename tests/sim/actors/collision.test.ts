import { describe, expect, it } from 'vitest';
import {
  createGame,
  DT,
  dodgeSpeed,
  findScenario,
  moveCircle,
  step,
  TILE_CELLS,
  type GameState,
} from '../../../src/sim';
import { loadRoomText } from '../../../tools/lib/rooms';
import {
  gameFromRows,
  input,
  mashDodge,
  openRoom,
  OVERLAP_TOLERANCE,
  penetration,
  place,
  run,
  SPEED,
} from './helpers';

const DIRS8: [number, number][] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

/** Lots of quick charges so tests can dodge back to back. */
const MANY_DODGES = { dodgeCharges: 1000, dodgeRecharge: 0.05 };

/** Open room `w`×`h` tiles with wall tiles at the given tile coordinates. */
function roomWithBlocks(w: number, h: number, blocks: [number, number][]): GameState {
  const rows = Array.from({ length: h }, (_, ty) =>
    Array.from({ length: w }, (_, tx) =>
      tx === 0 ||
      ty === 0 ||
      tx === w - 1 ||
      ty === h - 1 ||
      blocks.some(([bx, by]) => bx === tx && by === ty)
        ? '#'
        : '.',
    ).join(''),
  );
  return gameFromRows(rows, MANY_DODGES);
}

/** Makes the one-cell column `cx` solid for the full room height. */
function addCellColumn(state: GameState, cx: number): void {
  for (let cy = 0; cy < state.room.height; cy++) state.room.solid[cy * state.room.width + cx] = 1;
}

function expectClear(state: GameState): void {
  const p = state.player;
  expect(penetration(state.room, p.x, p.y, state.tuning.player.radius)).toBeLessThan(OVERLAP_TOLERANCE);
}

describe('walls stop the player', () => {
  for (const dodge of [false, true]) {
    for (const [dx, dy] of DIRS8) {
      it(`moving (${dx}, ${dy}) ${dodge ? 'while dodging' : 'at walk speed'} ends flush with the wall`, () => {
        const state = openRoom(12, 12, MANY_DODGES);
        const r = state.tuning.player.radius;
        place(state, 24, 24);
        run(
          state,
          240,
          (i) => input(dx, dy, dodge ? mashDodge(i) : 0),
          () => expectClear(state),
        );
        const lo = TILE_CELLS + r;
        const hi = 11 * TILE_CELLS - r;
        const want = (d: number): number => (d > 0 ? hi : d < 0 ? lo : 24);
        expect(state.player.x).toBeCloseTo(want(dx), 9);
        expect(state.player.y).toBeCloseTo(want(dy), 9);
      });
    }
  }

  for (const [label, dodgeDistance] of [
    ['default dodge', undefined],
    ['5x dodge speed, over 5 cells per tick', 60],
  ] as const) {
    it(`does not tunnel through a one-cell-thick wall when dodging into it from many angles (${label})`, () => {
      const state = openRoom(16, 12, { ...MANY_DODGES, ...(dodgeDistance ? { dodgeDistance } : {}) });
      const r = state.tuning.player.radius;
      const wallX = 32;
      addCellColumn(state, wallX);
      const maxStep = dodgeSpeed(state.tuning.player) * DT + 1e-9;
      for (let k = -8; k <= 8; k++) {
        place(state, wallX - 4, 24);
        run(
          state,
          60,
          (i) => input(1, k / 4, mashDodge(i)),
          () => {
            const p = state.player;
            expect(p.x).toBeLessThanOrEqual(wallX - r + OVERLAP_TOLERANCE);
            expect(Math.hypot(p.x - p.prevX, p.y - p.prevY)).toBeLessThanOrEqual(maxStep);
            expectClear(state);
          },
        );
      }
    });
  }

  it('moveCircle stops any large single move at a one-cell wall, for any start offset and radius', () => {
    const state = openRoom(16, 12);
    const wallX = 32;
    addCellColumn(state, wallX);
    for (const r of [0.25, 0.5, 1.5, 3]) {
      for (let off = 0; off < 1; off += 0.0625) {
        for (const dist of [0.5, 1.7, 3.3, 50]) {
          const body = { x: wallX - r - 2 + off, y: 24, vx: 3000, vy: 0 };
          moveCircle(state.room, body, r, dist, dist / 7);
          expect(body.x).toBeLessThanOrEqual(wallX - r + OVERLAP_TOLERANCE);
          expect(penetration(state.room, body.x, body.y, r)).toBeLessThan(OVERLAP_TOLERANCE);
        }
      }
    }
    const body = { x: 28, y: 24, vx: 3000, vy: 0 };
    expect(moveCircle(state.room, body, 1.5, 50, 0)).toBe(true);
    expect(body.x).toBeCloseTo(wallX - 1.5, 9);
    expect(body.vx).toBe(0);
  });

  it('never leaves the room bounds, even with no border walls', () => {
    const rows = Array.from({ length: 6 }, () => '.'.repeat(8));
    for (const [dx, dy] of DIRS8) {
      const state = gameFromRows(rows, MANY_DODGES);
      const r = state.tuning.player.radius;
      run(
        state,
        200,
        (i) => input(dx, dy, mashDodge(i)),
        () => {
          const p = state.player;
          expect(p.x).toBeGreaterThanOrEqual(r - OVERLAP_TOLERANCE);
          expect(p.y).toBeGreaterThanOrEqual(r - OVERLAP_TOLERANCE);
          expect(p.x).toBeLessThanOrEqual(state.room.width - r + OVERLAP_TOLERANCE);
          expect(p.y).toBeLessThanOrEqual(state.room.height - r + OVERLAP_TOLERANCE);
        },
      );
    }
  });
});

describe('sliding', () => {
  const FLOOR_Y = 7 * TILE_CELLS; // top face of the bottom wall in an openRoom(20, 8)

  it('slides along a flat wall at the tangential input speed without snagging on seams', () => {
    const state = openRoom(20, 8);
    const { radius: r, moveSpeed } = state.tuning.player;
    place(state, 8, FLOOR_Y - r);
    const steps: number[] = [];
    run(
      state,
      90,
      () => input(1, 1),
      (i) => {
        const p = state.player;
        expect(p.y).toBeCloseTo(FLOOR_Y - r, 9);
        if (i >= 10) steps.push(p.x - p.prevX);
      },
    );
    const tangential = moveSpeed / Math.SQRT2;
    expect(state.player.vx).toBeGreaterThan(tangential * 0.97);
    for (const s of steps) expect(s).toBeCloseTo(tangential * DT, 9);
    expect(state.player.vy).toBeLessThan(moveSpeed / 3);
  });

  it('runs along a wall it is touching at full speed', () => {
    const state = openRoom(20, 8);
    const { radius: r, moveSpeed } = state.tuning.player;
    place(state, 8, FLOOR_Y - r);
    run(state, 60, () => input(1, 0));
    expect(state.player.vx).toBeCloseTo(moveSpeed, 9);
    expect(state.player.y).toBeCloseTo(FLOOR_Y - r, 9);
    expect(state.player.x - state.player.prevX).toBeCloseTo(moveSpeed * DT, 9);
  });

  it('a dodge into a wall slides along it', () => {
    const state = openRoom(20, 8);
    const t = state.tuning.player;
    place(state, 8, FLOOR_Y - t.radius);
    step(state, input(1, 1, mashDodge(0)));
    run(
      state,
      30,
      () => input(0, 0),
      () => expect(state.player.y).toBeCloseTo(FLOOR_Y - t.radius, 9),
    );
    // The along-wall part of a diagonal dodge, plus a short deceleration tail.
    const along = state.player.x - 8;
    expect(along).toBeGreaterThan(t.dodgeDistance / Math.SQRT2);
    expect(along).toBeLessThan(t.dodgeDistance / Math.SQRT2 + t.moveSpeed * t.decelTime);
  });

  for (const [label, sx, sy, passed] of [
    ['down past the left face', 24, 25, (x: number, y: number) => y > 40 + 1.5 && x > 32],
    ['right past the top face', 25, 24, (x: number, y: number) => x > 40 + 1.5 && y > 32],
  ] as const) {
    it(`a diagonal push into a convex corner slides around it (${label})`, () => {
      // Block covers cells [32, 40]²; its top-left corner is at (32, 32).
      const state = roomWithBlocks(16, 16, [
        [8, 8],
        [9, 8],
        [8, 9],
        [9, 9],
      ]);
      const ms = state.tuning.player.moveSpeed;
      place(state, sx, sy);
      let passedAt = -1;
      run(
        state,
        150,
        () => input(1, 1),
        (i) => {
          expectClear(state);
          const p = state.player;
          if (passedAt < 0 && passed(p.x, p.y)) passedAt = i;
          if (passedAt < 0 && i > 10) expect(SPEED(state)).toBeGreaterThan(0.3 * ms);
        },
      );
      expect(passedAt).toBeGreaterThan(0);
    });
  }

  for (const [label, blocks, start, dir, rest] of [
    ['room corner', [], [10, 10], [-1, -1], [5.5, 5.5]],
    ['room corner, shallow push', [], [10, 10], [-1, -0.5], [5.5, 5.5]],
    ['room corner, steep push', [], [10, 10], [-0.5, -1], [5.5, 5.5]],
    [
      'corner between blocks',
      [
        [5, 5],
        [6, 5],
        [5, 6],
      ],
      [30, 30],
      [-1, -1],
      [25.5, 25.5],
    ],
  ] as [string, [number, number][], [number, number], [number, number], [number, number]][]) {
    it(`an inside corner holds the player still (${label})`, () => {
      const state = roomWithBlocks(12, 12, blocks);
      place(state, start[0], start[1]);
      run(state, 60, () => input(dir[0], dir[1]));
      const x0 = state.player.x;
      const y0 = state.player.y;
      expect(x0).toBeCloseTo(rest[0], 9);
      expect(y0).toBeCloseTo(rest[1], 9);
      run(
        state,
        60,
        () => input(dir[0], dir[1]),
        () => {
          expect(Math.abs(state.player.x - x0)).toBeLessThan(1e-9);
          expect(Math.abs(state.player.y - y0)).toBeLessThan(1e-9);
        },
      );
    });
  }
});

describe('test room corridor', () => {
  // Tile row 16 (cells y 64..68) between wall rows 15 and 17, tiles x 36..46.
  const room = loadRoomText('test/m0_room');
  const cases: [string, number, number, number, boolean][] = [
    ['centered, walking right', 136, 66, 1, false],
    ['high entry, walking right', 136, 65, 1, false],
    ['low entry, walking right', 136, 67.2, 1, false],
    ['centered, walking left', 196, 66, -1, false],
    ['centered, dodging right', 136, 66, 1, true],
  ];
  for (const [label, x, y, dir, dodge] of cases) {
    it(`is passable for the default radius (${label})`, () => {
      const state = createGame({ seed: 1, roomText: room });
      state.tuning.player.dodgeCharges = 1000;
      state.tuning.player.dodgeRecharge = 0.05;
      expect(state.tuning.player.radius).toBe(1.5);
      place(state, x, y);
      const throughX = dir > 0 ? 47 * TILE_CELLS : 35 * TILE_CELLS;
      let through = false;
      run(
        state,
        150,
        (i) => input(dir, 0, dodge ? mashDodge(i) : 0),
        () => {
          expectClear(state);
          const p = state.player;
          if (dir > 0 ? p.x > throughX : p.x < throughX) through = true;
        },
      );
      expect(through).toBe(true);
    });
  }
});

describe('scripted scenarios never overlap a wall', () => {
  for (const id of ['wall_press', 'wander']) {
    it(`${id}: 20k ticks without ending a tick inside a solid cell`, () => {
      const sc = findScenario(id)!;
      const state = createGame({ seed: 1, roomText: loadRoomText(sc.roomId) });
      const r = state.tuning.player.radius;
      let worst = 0;
      for (let i = 0; i < 20_000; i++) {
        step(state, sc.input(state.tick, state));
        const p = state.player;
        worst = Math.max(worst, penetration(state.room, p.x, p.y, r));
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
      expect(worst).toBeLessThan(OVERLAP_TOLERANCE);
    });
  }
});
