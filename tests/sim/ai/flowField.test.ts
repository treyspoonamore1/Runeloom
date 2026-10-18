import { describe, expect, it } from 'vitest';
import { aggro, hasLineOfSight, hashState, spawnEnemy, step } from '../../../src/sim';
import {
  UNREACHABLE,
  buildFlowField,
  createFlowField,
  flowStep,
  tileAt,
} from '../../../src/sim/ai/flowField';
import { gameFromRows, place } from '../actors/helpers';

// A wall at tile column 6, from tile row 3 down to the bottom border: the only way between the
// two halves is over its top (tile rows 1–2).
// prettier-ignore
const ROWS = [
  '############',
  '#..........#',
  '#..........#',
  '#.....#....#',
  '#.....#....#',
  '#.....#....#',
  '#.....#....#',
  '#.....#....#',
  '############',
];
const PLAYER: [number, number] = [14, 26];
const ENEMY: [number, number] = [38, 26];

describe('flow field', () => {
  it('costs grow around the wall and the first step heads for the gap', () => {
    const state = gameFromRows(ROWS);
    const f = createFlowField(state.room);
    const goal = tileAt(f, ...PLAYER);
    buildFlowField(f, goal, 0);
    expect(f.cost[goal]).toBe(0);
    // Straight across is 6 tiles; around the wall top it is much longer.
    const far = tileAt(f, ...ENEMY);
    expect(f.cost[far]).toBeGreaterThan(6 * 2 + 4);
    expect(f.cost[far]).toBeLessThan(UNREACHABLE);
    expect(f.cost[tileAt(f, 25, 26)]).toBe(UNREACHABLE); // inside the wall
    const out = { x: 0, y: 0 };
    expect(flowStep(f, ...ENEMY, out)).toBe(true);
    expect(out.y).toBeLessThan(ENEMY[1]); // up toward the gap, not into the wall
    expect(flowStep(f, ...PLAYER, out)).toBe(false); // at the goal
  });

  it('is rebuilt deterministically and only goalTile/builtTick are hashed', () => {
    const a = gameFromRows(ROWS);
    const b = gameFromRows(ROWS);
    for (const s of [a, b]) {
      place(s, ...PLAYER);
      spawnEnemy(s, 'tinderling', ...ENEMY);
    }
    for (let i = 0; i < 30; i++) {
      step(a, { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 });
      step(b, { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 });
    }
    expect(Array.from(a.flow.cost)).toEqual(Array.from(b.flow.cost));
    expect(hashState(a)).toBe(hashState(b));
    a.flow.goalTile++;
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('leads an enemy without line of sight around the wall to the player', () => {
    const state = gameFromRows(ROWS);
    state.cheats.god = true;
    place(state, ...PLAYER);
    const e = spawnEnemy(state, 'tinderling', ...ENEMY);
    expect(hasLineOfSight(state.room, e.x, e.y, ...PLAYER)).toBe(false);
    aggro(state, e);
    let reached = -1;
    let minY = e.y;
    for (let i = 0; i < 6 * 60 && reached < 0; i++) {
      step(state, { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 });
      minY = Math.min(minY, e.y);
      if (Math.hypot(e.x - PLAYER[0], e.y - PLAYER[1]) < 5) reached = i;
    }
    expect(reached).toBeGreaterThan(0);
    // It went over the wall's top (tile rows 1–2 are cells 4–12).
    expect(minY).toBeLessThan(12);
  });
});
