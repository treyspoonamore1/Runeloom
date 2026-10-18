import { describe, expect, it } from 'vitest';
import { parseRoom } from '../../src/sim';
import { defaultTuning } from '../../data/tuning';
import { checkPositiveNumbers, missingRefs, spawnMarkerDiffs } from '../../tools/lib/checks';
import { summarize } from '../../tools/lib/stats';

describe('checkPositiveNumbers', () => {
  it('accepts the default tuning', () => expect(checkPositiveNumbers(defaultTuning)).toEqual([]));
  it('reports non-positive, non-finite and non-number leaves with paths', () => {
    const bad = checkPositiveNumbers({ a: { b: 0, c: NaN, d: -1, e: 'x' }, f: 2 });
    expect(bad).toHaveLength(4);
    expect(bad[0]).toContain('a.b');
  });
});

describe('spawnMarkerDiffs', () => {
  const room = (spawn: string, cell: string) =>
    parseRoom(`@id t\n@name T\n@level 1\n${spawn}\n#####\n#${cell}..#\n#####`);
  it('matches', () =>
    expect(spawnMarkerDiffs(room('@spawn 1 enemy:a', '1'))).toEqual({
      usedNotDeclared: [],
      declaredNotUsed: [],
    }));
  it('finds both directions', () => {
    expect(spawnMarkerDiffs(room('@spawn 2 enemy:a', '1'))).toEqual({
      usedNotDeclared: ['1'],
      declaredNotUsed: ['2'],
    });
  });
});

describe('missingRefs / summarize', () => {
  it('lists missing rooms', () => {
    expect(
      missingRefs(
        [
          { from: 's', id: 'a' },
          { from: 's', id: 'b' },
        ],
        new Set(['a']),
      ),
    ).toEqual(['s: room "b" does not exist']);
  });
  it('computes mean, p99, max', () => {
    const s = summarize(Array.from({ length: 100 }, (_, i) => i + 1));
    expect(s).toMatchObject({ n: 100, mean: 50.5, p99: 99, max: 100 });
  });
});
