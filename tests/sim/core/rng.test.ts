import { describe, expect, it } from 'vitest';
import { Rng } from '../../../src/sim';

describe('Rng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 1000; i++) expect(a.nextU32()).toBe(b.nextU32());
  });

  it('produces different sequences for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const same = Array.from({ length: 100 }, () => a.nextU32() === b.nextU32()).filter(Boolean).length;
    expect(same).toBeLessThan(3);
  });

  it('keeps float() in [0, 1) with a roughly uniform mean', () => {
    const r = new Rng(7);
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    // One assertion per bound, not per sample: 200k expect() calls timed out on a loaded machine.
    for (let i = 0; i < 100_000; i++) {
      const f = r.float();
      if (f < min) min = f;
      if (f > max) max = f;
      sum += f;
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThan(1);
    expect(sum / 100_000).toBeCloseTo(0.5, 2);
  });

  it('round-trips through getState/fromState', () => {
    const a = new Rng(99);
    a.nextU32();
    const b = Rng.fromState(a.getState());
    for (let i = 0; i < 100; i++) expect(b.nextU32()).toBe(a.nextU32());
  });

  it('gives forks with different labels different streams', () => {
    const base1 = new Rng(5);
    const base2 = new Rng(5);
    expect(base1.fork('ai').nextU32()).not.toBe(base2.fork('loot').nextU32());
  });

  it('int(n) stays in range', () => {
    const r = new Rng(3);
    for (let i = 0; i < 10_000; i++) {
      const v = r.int(6);
      expect(Number.isInteger(v) && v >= 0 && v < 6).toBe(true);
    }
  });
});
