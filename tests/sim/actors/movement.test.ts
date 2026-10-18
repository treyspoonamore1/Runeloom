import { describe, expect, it } from 'vitest';
import { DT, step } from '../../../src/sim';
import { aimRel, input, openRoom, place, run, SPEED } from './helpers';

/** A big open room with the player in the middle, far from walls. */
function open() {
  const state = openRoom(40, 40);
  place(state, 80, 80);
  return state;
}

/** Ticks until `done` first holds, stepping with `frame`. */
function ticksUntil(
  state: ReturnType<typeof open>,
  frame: () => ReturnType<typeof input>,
  done: () => boolean,
) {
  for (let i = 1; i <= 600; i++) {
    step(state, frame());
    if (done()) return i;
  }
  return -1;
}

describe('player movement', () => {
  it('reaches top speed in about accelTime', () => {
    const state = open();
    const { moveSpeed, accelTime } = state.tuning.player;
    const n = ticksUntil(
      state,
      () => input(1, 0),
      () => SPEED(state) >= moveSpeed,
    );
    expect(Math.abs(n * DT - accelTime)).toBeLessThanOrEqual(DT);
    expect(SPEED(state)).toBe(moveSpeed);
  });

  it('stops in about decelTime', () => {
    const state = open();
    const { decelTime } = state.tuning.player;
    run(state, 30, () => input(1, 0));
    const n = ticksUntil(
      state,
      () => input(0, 0),
      () => SPEED(state) === 0,
    );
    expect(Math.abs(n * DT - decelTime)).toBeLessThanOrEqual(DT);
    const x = state.player.x;
    run(state, 10, () => input(0, 0));
    expect(state.player.x).toBe(x);
  });

  it('moves diagonally at the same speed as straight', () => {
    const straight = open();
    const diagonal = open();
    const unnormalized = open();
    run(straight, 30, () => input(1, 0));
    run(diagonal, 30, () => input(1, 1));
    run(unnormalized, 30, () => input(3, -4));
    const ms = straight.tuning.player.moveSpeed;
    expect(SPEED(straight)).toBeCloseTo(ms, 9);
    expect(SPEED(diagonal)).toBeCloseTo(ms, 9);
    expect(SPEED(unnormalized)).toBeCloseTo(ms, 9);
    const dist = (s: typeof straight) => Math.hypot(s.player.x - 80, s.player.y - 80);
    expect(dist(diagonal)).toBeCloseTo(dist(straight), 9);
    expect(diagonal.player.vx).toBeCloseTo(diagonal.player.vy, 12);
  });

  it('respects analog magnitudes below 1', () => {
    for (const [mx, my, frac] of [
      [0.6, 0, 0.6],
      [0.3, 0.4, 0.5],
      [0, -0.25, 0.25],
    ]) {
      const state = open();
      run(state, 30, () => input(mx!, my!));
      expect(SPEED(state)).toBeCloseTo(state.tuning.player.moveSpeed * frac!, 9);
    }
  });

  it('faces the last non-zero move direction', () => {
    const state = open();
    run(state, 5, () => input(0, -1));
    expect([state.player.faceX, state.player.faceY]).toEqual([0, -1]);
    run(state, 5, () => input(-0.3, 0.3));
    expect(state.player.faceX).toBeCloseTo(-Math.SQRT1_2, 12);
    expect(state.player.faceY).toBeCloseTo(Math.SQRT1_2, 12);
    run(state, 5, () => input(0, 0));
    expect(state.player.faceX).toBeCloseTo(-Math.SQRT1_2, 12);
    expect(state.player.faceY).toBeCloseTo(Math.SQRT1_2, 12);
  });

  it('aims toward the aim point, and keeps the old aim when it is on the player', () => {
    const state = open();
    step(state, aimRel(state, 0, 0, 0, 10));
    expect([state.player.aimDirX, state.player.aimDirY]).toEqual([0, 1]);
    step(state, aimRel(state, 0, 0, -3, -4));
    expect(state.player.aimDirX).toBeCloseTo(-0.6, 12);
    expect(state.player.aimDirY).toBeCloseTo(-0.8, 12);
    step(state, aimRel(state, 0, 0, 0, 0));
    expect(state.player.aimDirX).toBeCloseTo(-0.6, 12);
    expect(state.player.aimDirY).toBeCloseTo(-0.8, 12);
  });

  it('records the start-of-tick position for interpolation', () => {
    const state = open();
    run(state, 10, () => input(1, 0));
    const x = state.player.x;
    step(state, input(1, 0));
    expect(state.player.prevX).toBe(x);
    expect(state.player.x).toBeGreaterThan(x);
  });
});
