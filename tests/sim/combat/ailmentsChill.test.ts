import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { enemies, type EnemyDef } from '../../../data/enemies';
import { actionSpeed, chillSlow, isFrozen, type GameState } from '../../../src/sim';
import { addEnemy, arena, hitWith, ofType, ticks, ticksFor } from './helpers';

/** DESIGN §6.4 Chill, Freeze and the boss chill rule. */

function dummy(state: GameState) {
  return addEnemy(state, 'dummy', 100, 60);
}

describe('Chill', () => {
  it('adds (frost damage ÷ max life) × 200 points', () => {
    const state = arena();
    const d = dummy(state);
    hitWith(state, d, 50, 'frost');
    expect(d.ailments.chill).toBeCloseTo(20, 12);
    expect(ofType(state.events, 'ailmentApplied')).toMatchObject([
      { ailment: 'chill', target: d.id, magnitude: 20, duration: 20 / 25 },
    ]);
    hitWith(state, d, 25, 'frost');
    expect(d.ailments.chill).toBeCloseTo(30, 12);
  });

  it('slows 0.3% per point, at most 30%', () => {
    const state = arena();
    const d = dummy(state);
    hitWith(state, d, 50, 'frost');
    expect(chillSlow(state, d)).toBeCloseTo(0.06, 12);
    expect(actionSpeed(state, d)).toBeCloseTo(0.94, 12);
    d.ailments.chill = 99;
    expect(chillSlow(state, d)).toBeCloseTo(0.297, 12);
    // A steeper slope hits the cap.
    state.tuning.ailments.chillSlowPerPoint = 0.01;
    d.ailments.chill = 50;
    expect(chillSlow(state, d)).toBe(0.3);
    expect(actionSpeed(state, d)).toBeCloseTo(0.7, 12);
  });

  it('decays 25 points per second and reports when it is gone', () => {
    const state = arena();
    const d = dummy(state);
    hitWith(state, d, 50, 'frost');
    ticks(state, 30);
    expect(d.ailments.chill).toBeCloseTo(7.5, 9);
    const ev = ticks(state, ticksFor(0.3));
    expect(d.ailments.chill).toBe(0);
    expect(ofType(ev, 'ailmentEnded')).toMatchObject([{ ailment: 'chill', target: d.id }]);
    expect(actionSpeed(state, d)).toBe(1);
  });
});

describe('Freeze', () => {
  it('freezes at 100 chill, consuming it', () => {
    const state = arena();
    const d = dummy(state);
    hitWith(state, d, 125, 'frost');
    expect(d.ailments.chill).toBeCloseTo(50, 12);
    expect(isFrozen(d)).toBe(false);
    hitWith(state, d, 125, 'frost');
    expect(isFrozen(d)).toBe(true);
    expect(d.ailments.chill).toBe(0);
    expect(ofType(state.events, 'freeze')).toEqual([
      { type: 'freeze', target: d.id, duration: 1.2, sourceId: 0, x: 100, y: 60 },
    ]);
    expect(actionSpeed(state, d)).toBe(0);
    // No chill builds while frozen.
    state.events.length = 0;
    hitWith(state, d, 125, 'frost');
    expect(d.ailments.chill).toBe(0);
    expect(ofType(state.events, 'ailmentApplied')).toHaveLength(0);
  });

  it('lasts 1.2 s, then thaws', () => {
    const state = arena();
    const d = dummy(state);
    hitWith(state, d, 250, 'frost');
    expect(ofType(ticks(state, ticksFor(1.2) - 1), 'thaw')).toHaveLength(0);
    expect(isFrozen(d)).toBe(true);
    expect(ofType(ticks(state, 1), 'thaw')).toEqual([{ type: 'thaw', target: d.id, x: 100, y: 60 }]);
    expect(isFrozen(d)).toBe(false);
    // Normal enemies get no freeze immunity: the next 100 chill freezes again.
    expect(d.ailments.freeze.immuneLeft).toBe(0);
    hitWith(state, d, 250, 'frost');
    expect(isFrozen(d)).toBe(true);
  });
});

describe('boss chill rule', () => {
  const BOSS = 'test_boss';
  const table = enemies as unknown as Record<string, EnemyDef>;
  beforeAll(() => {
    table[BOSS] = { ...enemies.dummy, name: 'Test Boss', life: 3500, immortal: false, isBoss: true };
  });
  afterAll(() => {
    delete table[BOSS];
  });

  it('adds a flat 12 chill per frost hit, whatever its damage', () => {
    const state = arena();
    const b = addEnemy(state, BOSS, 100, 60);
    hitWith(state, b, 1, 'frost');
    expect(b.ailments.chill).toBe(12);
    hitWith(state, b, 1000, 'frost');
    expect(b.ailments.chill).toBe(24);
    // Hits without frost add none.
    hitWith(state, b, 1000, 'fire');
    expect(b.ailments.chill).toBe(24);
  });

  it('decays 10 per second and slows at most 15%', () => {
    const state = arena();
    const b = addEnemy(state, BOSS, 100, 60);
    hitWith(state, b, 1, 'frost');
    ticks(state, 60);
    expect(b.ailments.chill).toBeCloseTo(2, 9);
    b.ailments.chill = 90;
    expect(chillSlow(state, b)).toBe(0.15);
    expect(actionSpeed(state, b)).toBeCloseTo(0.85, 12);
  });

  it('freezes for 0.8 s at 100, then is immune to freeze for 6 s', () => {
    const state = arena();
    const b = addEnemy(state, BOSS, 100, 60);
    for (let i = 0; i < 8; i++) hitWith(state, b, 1, 'frost');
    expect(isFrozen(b)).toBe(false);
    hitWith(state, b, 1, 'frost');
    expect(isFrozen(b)).toBe(true);
    expect(b.ailments.freeze.timeLeft).toBeCloseTo(0.8, 12);
    ticks(state, ticksFor(0.8));
    expect(isFrozen(b)).toBe(false);
    expect(b.ailments.freeze.immuneLeft).toBe(6);

    // Within the window chill still builds (and slows) but caps at 100 without freezing.
    for (let i = 0; i < 9; i++) hitWith(state, b, 1, 'frost');
    expect(b.ailments.chill).toBe(100);
    expect(isFrozen(b)).toBe(false);
    ticks(state, ticksFor(6));
    expect(b.ailments.freeze.immuneLeft).toBe(0);
    for (let i = 0; i < 9 && !isFrozen(b); i++) hitWith(state, b, 1, 'frost');
    expect(isFrozen(b)).toBe(true);
  });
});
