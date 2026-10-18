import { describe, expect, it } from 'vitest';
import { ArgError, parseArgs, parseViewport, requireInt } from '../../tools/lib/args';

const spec = {
  scenario: { kind: 'string', default: 'wander' },
  ticks: { kind: 'number', default: 10 },
  json: { kind: 'boolean' },
  every: { kind: 'number' },
} as const;

describe('parseArgs', () => {
  it('applies defaults', () => {
    expect(parseArgs([], spec)).toEqual({ scenario: 'wander', ticks: 10, json: false, every: undefined });
  });
  it('parses spaced, = and boolean forms', () => {
    const a = parseArgs(['--scenario', 'x', '--ticks=5', '--json'], spec);
    expect(a).toMatchObject({ scenario: 'x', ticks: 5, json: true });
  });
  it('rejects unknown options, bad numbers, missing values and positionals', () => {
    expect(() => parseArgs(['--nope'], spec)).toThrow(ArgError);
    expect(() => parseArgs(['--ticks', 'abc'], spec)).toThrow(/number/);
    expect(() => parseArgs(['--ticks'], spec)).toThrow(/needs a value/);
    expect(() => parseArgs(['--ticks', '--json'], spec)).toThrow(/needs a value/);
    expect(() => parseArgs(['stray'], spec)).toThrow(/Unexpected/);
  });
});

describe('requireInt / parseViewport', () => {
  it('validates integers', () => {
    expect(requireInt('n', 3, 0)).toBe(3);
    expect(() => requireInt('n', 1.5, 0)).toThrow(ArgError);
    expect(() => requireInt('n', -1, 0)).toThrow(ArgError);
  });
  it('parses viewports', () => {
    expect(parseViewport('390x844')).toEqual({ width: 390, height: 844 });
    expect(() => parseViewport('390')).toThrow(ArgError);
  });
});
