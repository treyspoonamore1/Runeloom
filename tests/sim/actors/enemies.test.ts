import { describe, expect, it } from 'vitest';
import { createGame, spawnEnemy, step } from '../../../src/sim';
import { loadRoomText } from '../../../tools/lib/rooms';
import { addEnemy, arena, ticks } from '../combat/helpers';
import { OVERLAP_TOLERANCE, penetration } from './helpers';

describe('enemy bodies', () => {
  it('get stable increasing ids and default facing toward the player', () => {
    const state = arena();
    const a = spawnEnemy(state, 'tinderling', 100, 60);
    const b = spawnEnemy(state, 'tinderling', 80, 40);
    expect(b.id).toBe(a.id + 1);
    expect([a.facingX, a.facingY]).toEqual([-1, 0]);
    expect([b.facingX, b.facingY]).toEqual([0, 1]);
    expect(() => spawnEnemy(state, 'nope', 1, 1)).toThrow(/Unknown enemy/);
  });

  it('move by their AI velocity and slide along walls', () => {
    const state = arena();
    const e = addEnemy(state, 'tinderling', 150, 60);
    e.vx = 22;
    e.vy = 5;
    ticks(state, 60);
    expect(e.x).toBeCloseTo(156 - e.radius, 6);
    expect(e.y).toBeGreaterThan(64);
    expect(penetration(state.room, e.x, e.y, e.radius)).toBeLessThanOrEqual(OVERLAP_TOLERANCE);
  });

  it('separate softly when overlapping, deterministically', () => {
    const state = arena();
    const a = addEnemy(state, 'tinderling', 100, 60);
    const b = addEnemy(state, 'tinderling', 100, 60);
    const c = addEnemy(state, 'tinderling', 100.5, 60.2);
    ticks(state, 60);
    for (const [p, q] of [
      [a, b],
      [a, c],
      [b, c],
    ] as const) {
      expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(p.radius + q.radius - 0.05);
    }
  });

  it('are pushed out of the player; dummies are never moved', () => {
    const state = arena();
    const t = addEnemy(state, 'tinderling', 81, 60);
    const d = addEnemy(state, 'dummy', 80.5, 61);
    ticks(state, 60);
    expect(Math.hypot(t.x - 80, t.y - 60)).toBeGreaterThan(2.5 - 0.05);
    expect([d.x, d.y]).toEqual([80.5, 61]);
    expect([state.player.x, state.player.y]).toEqual([80, 60]);
  });
});

describe('room spawns', () => {
  it('test/arena spawns its @spawn entries at their markers', () => {
    const state = createGame({ seed: 1, roomText: loadRoomText('test/arena') });
    const kinds = state.enemies.map((e) => e.kind);
    expect(kinds.filter((k) => k === 'dummy')).toHaveLength(3);
    expect(kinds.filter((k) => k === 'tinderling')).toHaveLength(4);
    expect(kinds.filter((k) => k === 'shieldbearer')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'ember_archer')).toHaveLength(2);
    // Four on one marker go on a 2×2 grid around its center.
    const t = state.enemies.filter((e) => e.kind === 'tinderling');
    const cx = t.reduce((s, e) => s + e.x, 0) / t.length;
    expect(cx % 4).toBe(2);
    expect(new Set(state.enemies.map((e) => e.id)).size).toBe(state.enemies.length);
    expect(
      createGame({ seed: 1, roomText: loadRoomText('test/arena'), spawnRoomEnemies: false }).enemies,
    ).toEqual([]);
  });

  it('the arena player spawn is the central Loom Stone', () => {
    const state = createGame({ seed: 1, roomText: loadRoomText('test/arena') });
    expect([state.room.spawnX, state.room.spawnY]).toEqual([122, 70]);
    step(state, { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 });
    expect(state.events).toEqual([]);
  });
});
