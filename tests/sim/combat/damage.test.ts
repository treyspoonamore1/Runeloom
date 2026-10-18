import { describe, expect, it } from 'vitest';
import {
  enemyAttackPacket,
  makePacket,
  resolveHit,
  Rng,
  scaleByLevel,
  type DamageTarget,
} from '../../../src/sim';
import { enemies } from '../../../data/enemies';
import { addEnemy, arena } from './helpers';

const target = (resist: Partial<DamageTarget['resist']> = {}, shock = 0): DamageTarget => ({
  resist: { physical: 0, fire: 0, frost: 0, storm: 0, ...resist },
  shock,
});

describe('resolveHit (DESIGN §7)', () => {
  it('splits base damage by element share and sums the types', () => {
    const packet = makePacket(20, { fire: 0.75, storm: 0.25 }, 0, 1.5);
    const r = resolveHit(packet, target({ fire: 0.5 }), new Rng(1));
    expect(r.byType.fire).toBeCloseTo(15 * 0.5, 12);
    expect(r.byType.storm).toBeCloseTo(5, 12);
    expect(r.byType.physical).toBe(0);
    expect(r.total).toBeCloseTo(12.5, 12);
    expect(r.mainType).toBe('fire');
  });

  it('applies increased additively and more multiplicatively', () => {
    const packet = { ...makePacket(10, { physical: 1 }, 0, 1.5), increased: 0.2 + 0.3, more: [0.3, -0.25] };
    const r = resolveHit(packet, target(), new Rng(1));
    expect(r.total).toBeCloseTo(10 * 1.5 * 1.3 * 0.75, 12);
  });

  it('applies resistances, including negative ones, and shock', () => {
    const packet = makePacket(10, { frost: 1 }, 0, 1.5);
    expect(resolveHit(packet, target({ frost: 0.75 }), new Rng(1)).total).toBeCloseTo(2.5, 12);
    expect(resolveHit(packet, target({ frost: -0.25 }), new Rng(1)).total).toBeCloseTo(12.5, 12);
    expect(resolveHit(packet, target({ frost: -0.5 }, 0.2), new Rng(1)).total).toBeCloseTo(18, 12);
    // Resistance to another type does nothing.
    expect(resolveHit(packet, target({ fire: 0.75 }), new Rng(1)).total).toBe(10);
  });

  it('crits multiply by the crit multiplier', () => {
    const packet = makePacket(10, { physical: 1 }, 1, 1.5);
    const r = resolveHit(packet, target(), new Rng(1));
    expect(r.crit).toBe(true);
    expect(r.total).toBeCloseTo(15, 12);
  });

  it('crits at the crit chance over 10k hits with a seeded RNG', () => {
    const packet = makePacket(12, { fire: 1 }, 0.06, 1.5);
    const rng = new Rng(42);
    let crits = 0;
    const N = 10_000;
    for (let i = 0; i < N; i++) if (resolveHit(packet, target(), rng).crit) crits++;
    // 4 standard deviations: sqrt(0.06 × 0.94 / 10000) ≈ 0.0024.
    expect(Math.abs(crits / N - 0.06)).toBeLessThan(0.0095);
  });

  it('crit sequences reproduce exactly from the same seed', () => {
    const packet = makePacket(12, { fire: 1 }, 0.3, 1.5);
    const seq = (seed: number) => {
      const rng = new Rng(seed);
      return Array.from({ length: 500 }, () => resolveHit(packet, target(), rng).crit);
    };
    expect(seq(7)).toEqual(seq(7));
    expect(seq(7)).not.toEqual(seq(8));
  });

  it("doesn't roll (or advance the RNG) when crit chance is 0", () => {
    const rng = new Rng(3);
    const before = rng.getState();
    resolveHit(makePacket(5, { physical: 1 }, 0, 1.5), target(), rng);
    expect(rng.getState()).toEqual(before);
  });

  it('crit stream is separate from the general RNG', () => {
    const a = arena();
    const b = arena();
    for (let i = 0; i < 50; i++) b.rng.nextU32();
    expect(a.combatRng.getState()).toEqual(b.combatRng.getState());
  });
});

describe('enemy level scaling', () => {
  it('scaleByLevel multiplies growth^(level − 1)', () => {
    expect(scaleByLevel(10, 1.12, 1)).toBe(10);
    expect(scaleByLevel(10, 1.12, 5)).toBeCloseTo(10 * 1.12 ** 4, 10);
  });

  it('life scales by 1.12^(L − 1) and attack damage by 1.09^(L − 1)', () => {
    const state = arena();
    const e1 = addEnemy(state, 'tinderling', 100, 60, [-1, 0], 1);
    const e5 = addEnemy(state, 'tinderling', 110, 60, [-1, 0], 5);
    const base = enemies.tinderling.life;
    expect(e1.maxLife).toBe(base);
    expect(e5.maxLife).toBeCloseTo(base * 1.12 ** 4, 10);
    expect(e5.life).toBe(e5.maxLife);
    const atk = enemies.tinderling.attack;
    expect(enemyAttackPacket(state, e1, atk).base.physical).toBe(4);
    expect(enemyAttackPacket(state, e5, atk).base.physical).toBeCloseTo(4 * 1.09 ** 4, 10);
  });

  it('area level defaults to the room level', () => {
    const state = arena();
    expect(addEnemy(state, 'dummy', 100, 60).areaLevel).toBe(state.room.level);
  });
});
