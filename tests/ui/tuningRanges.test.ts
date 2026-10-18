import { describe, expect, it } from 'vitest';
import { assignDeep, rangeFor } from '../../src/ui/tuningRanges';

describe('rangeFor', () => {
  it('floats span 0 to 4x default', () => {
    const r = rangeFor(1.5);
    expect(r).toMatchObject({ min: 0, max: 6, integer: false });
  });
  it('integers stay integers', () => {
    expect(rangeFor(2)).toMatchObject({ min: 0, max: 8, step: 1, integer: true });
    expect(rangeFor(0)).toMatchObject({ min: 0, step: 1, integer: true });
  });
  it('step scales with magnitude', () => {
    expect(rangeFor(0.06).step).toBe(0.001);
    expect(rangeFor(0.15).step).toBe(0.001);
    expect(rangeFor(1.4).step).toBe(0.01);
    expect(rangeFor(26.5).step).toBe(0.1);
  });
  it('negative defaults get a symmetric range', () => {
    expect(rangeFor(-2.5)).toMatchObject({ min: -10, max: 10 });
  });
});

describe('assignDeep', () => {
  it('copies in place', () => {
    const inner = { a: 1, b: 2 };
    const dst = { s: inner, t: 3 };
    assignDeep(dst, { s: { a: 9, b: 2 }, t: 4 });
    expect(dst.s).toBe(inner);
    expect(dst).toEqual({ s: { a: 9, b: 2 }, t: 4 });
  });
});
