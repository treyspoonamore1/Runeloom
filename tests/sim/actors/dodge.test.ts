import { describe, expect, it } from 'vitest';
import { Button, DT, dodgeSpeed, isDodging, isInvulnerable, step } from '../../../src/sim';
import { aimRel, input, openRoom, place, run, SPEED } from './helpers';

const D = Button.Dodge;

function open(tuning?: Parameters<typeof openRoom>[2]) {
  const state = openRoom(40, 40, tuning);
  place(state, 80, 80);
  return state;
}

/** Steps with `frame` until the current dodge is over. Returns the ticks stepped. */
function finishDodge(state: ReturnType<typeof open>, frame = () => input(0, 0)): number {
  let n = 0;
  while (isDodging(state.player) && n < 600) {
    step(state, frame());
    n++;
  }
  return n;
}

describe('dodge', () => {
  it('covers dodgeDistance at constant speed in open space', () => {
    const state = open();
    const t = state.tuning.player;
    step(state, aimRel(state, 0, 0, 10, 0, D));
    const speeds: number[] = [];
    while (isDodging(state.player)) {
      speeds.push(SPEED(state));
      step(state, aimRel(state, 0, 0, 10, 0));
    }
    for (const s of speeds) expect(s).toBeCloseTo(dodgeSpeed(t), 9);
    // The ending tick spends the rest of its time walking, at most one tick of run speed.
    const atEnd = state.player.x - 80;
    expect(Math.abs(atEnd - t.dodgeDistance)).toBeLessThanOrEqual(t.moveSpeed * DT);
    run(state, 30, () => input(0, 0));
    const total = state.player.x - 80;
    expect(total).toBeGreaterThanOrEqual(t.dodgeDistance);
    expect(total).toBeLessThanOrEqual(t.dodgeDistance + t.moveSpeed * t.decelTime);
    expect(state.player.y).toBe(80);
  });

  it('lasts dodgeDuration', () => {
    const state = open();
    const t = state.tuning.player;
    step(state, input(1, 0, D));
    const ticks = 1 + finishDodge(state);
    expect(ticks).toBe(Math.ceil(t.dodgeDuration / DT));
  });

  it('gives dodgeIframes of invulnerability from the start', () => {
    const state = open();
    const t = state.tuning.player;
    expect(isInvulnerable(state.player)).toBe(false);
    let count = 0;
    run(
      state,
      60,
      (i) => input(1, 0, i === 0 ? D : 0),
      (i) => {
        if (i === 0) expect(isInvulnerable(state.player)).toBe(true);
        if (isInvulnerable(state.player)) count++;
      },
    );
    expect(count).toBe(Math.round(t.dodgeIframes / DT));
  });

  it('spends charges, refuses at zero, and regains them one at a time', () => {
    const state = open();
    const t = state.tuning.player;
    const rechargeTicks = Math.round(t.dodgeRecharge / DT);
    const charges: number[] = [];
    // Dodge on ticks 0, 20 and 40; the third has no charge left.
    run(
      state,
      2 * rechargeTicks + 10,
      (i) => input(1, 0, i === 0 || i === 20 || i === 40 ? D : 0),
      (i) => {
        charges.push(state.player.dodgeCharges);
        if (i === 40) expect(isDodging(state.player)).toBe(false);
      },
    );
    expect(charges[0]).toBe(t.dodgeCharges - 1);
    expect(charges[20]).toBe(t.dodgeCharges - 2);
    expect(charges[40]).toBe(0);
    // The first charge returns dodgeRecharge after the first dodge, the second a full recharge later.
    expect(charges[rechargeTicks - 1]).toBe(0);
    expect(charges[rechargeTicks]).toBe(1);
    expect(charges[2 * rechargeTicks - 1]).toBe(1);
    expect(charges[2 * rechargeTicks]).toBe(2);
    expect(state.player.dodgeRechargeLeft).toBe(0);
  });

  it('needs a fresh press: holding Dodge does not chain dodges', () => {
    const state = open();
    step(state, input(1, 0, D));
    finishDodge(state, () => input(1, 0, D));
    run(state, 30, () => input(1, 0, D));
    expect(state.player.dodgeCharges).toBe(state.tuning.player.dodgeCharges - 1);
  });

  it('ignores a press in the middle of a dodge', () => {
    const state = open();
    step(state, input(1, 0, D));
    step(state, input(0, 1, 0));
    step(state, input(0, 1, D));
    expect(state.player.dodgeCharges).toBe(state.tuning.player.dodgeCharges - 1);
    expect([state.player.dodgeDirX, state.player.dodgeDirY]).toEqual([1, 0]);
  });

  it('goes along the move input when there is one, else toward the aim', () => {
    const cases: [number, number, number, number][] = [
      [0, 1, 0, 1],
      [1, 1, Math.SQRT1_2, Math.SQRT1_2],
      [0.2, 0, 1, 0],
      [0, 0, -0.6, 0.8],
    ];
    for (const [mx, my, ex, ey] of cases) {
      const state = open();
      const t = state.tuning.player;
      step(state, aimRel(state, mx, my, -3, 4, D));
      expect(state.player.dodgeDirX).toBeCloseTo(ex, 12);
      expect(state.player.dodgeDirY).toBeCloseTo(ey, 12);
      finishDodge(state, () => input(mx, my));
      // Analog inputs still get the full dodge distance.
      const d = Math.hypot(state.player.x - 80, state.player.y - 80);
      expect(Math.abs(d - t.dodgeDistance)).toBeLessThanOrEqual(t.moveSpeed * DT);
    }
  });

  it('ignores movement input during the dodge', () => {
    const state = open();
    step(state, input(1, 0, D));
    finishDodge(state, () => input(0, -1));
    expect(state.player.prevY).toBe(80);
  });

  it('keeps running at move speed after the dodge when the input still points that way', () => {
    const state = open();
    const t = state.tuning.player;
    step(state, input(1, 0, D));
    finishDodge(state, () => input(1, 0));
    expect(SPEED(state)).toBeCloseTo(t.moveSpeed, 9);
    run(
      state,
      20,
      () => input(1, 0),
      () => expect(SPEED(state)).toBeCloseTo(t.moveSpeed, 9),
    );
  });

  it('comes to rest within decelTime after the dodge with no input', () => {
    const state = open();
    const t = state.tuning.player;
    step(state, input(1, 0, D));
    finishDodge(state);
    run(state, Math.ceil(t.decelTime / DT) + 1, () => input(0, 0));
    expect(SPEED(state)).toBe(0);
  });

  it('follows live tuning changes to the charge count', () => {
    const state = open();
    state.tuning.player.dodgeCharges = 1;
    step(state, input(0, 0));
    expect(state.player.dodgeCharges).toBe(1);
    state.tuning.player.dodgeCharges = 3;
    run(state, Math.round((2 * state.tuning.player.dodgeRecharge) / DT), () => input(0, 0));
    expect(state.player.dodgeCharges).toBe(3);
  });
});
