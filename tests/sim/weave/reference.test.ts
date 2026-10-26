import { describe, expect, it } from 'vitest';
import { spindles } from '../../../data/spindles';
import {
  capacityMessage,
  compileWeave,
  mustFailWeaves,
  parseWeave,
  printWeave,
  referenceWeaves,
  spindleContext,
} from '../../../src/sim';
import { compileError, compiled, parsed, testCtx } from './helpers';

describe('CONTENT §2 reference weaves', () => {
  it('has all 18 (15–18: M8)', () => {
    expect(referenceWeaves.map((w) => w.n)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });

  for (const w of referenceWeaves) {
    describe(`#${w.n} ${w.name}`, () => {
      it('parses and round-trips through the printer', () => {
        const tree = parsed(w.notation);
        expect(printWeave(tree)).toBe(w.notation);
        const again = parseWeave(printWeave(tree));
        expect(again.ok && again.tree).toEqual(tree);
      });

      it(`compiles with exactly ${w.cx} complexity on a ${w.cx}-Capacity test_spindle`, () => {
        const { program, costs } = compiled(w.notation, testCtx(w.cx));
        expect(costs.complexity).toBe(w.cx);
        expect(program.complexity).toBe(w.cx);
        expect(program.notation).toBe(w.notation);
      });

      it('fails on one Capacity less with the CONTENT message', () => {
        expect(compileError(w.notation, testCtx(w.cx - 1))).toEqual({
          message: capacityMessage(w.cx, w.cx - 1),
          path: [],
        });
      });

      it('fits exactly the spindle bases CONTENT lists', () => {
        const fits = Object.values(spindles)
          .filter((s) => !s.devOnly)
          .filter((s) => compileWeave(parsed(w.notation), spindleContext(s, { allowShips: 'all' })).ok)
          .map((s) => s.id);
        expect(fits.sort()).toEqual([...w.fits].sort());
      });
    });
  }

  it('#14 fails on the biggest spindle with "Needs 22 Capacity; this spindle has 15"', () => {
    const w = referenceWeaves[13]!;
    const r = compileWeave(parsed(w.notation), spindleContext(spindles.loomsteel, { allowShips: 'all' }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message).toBe('Needs 22 Capacity; this spindle has 15');
      expect(r.costs?.complexity).toBe(22);
    }
    expect(compileError(w.notation, testCtx(10)).message).toBe('Needs 22 Capacity; this spindle has 10');
  });
});

describe('CONTENT §2 must-fail weaves', () => {
  for (const f of mustFailWeaves) {
    it(`${f.notation} → "${f.message}"`, () => {
      const tree = parsed(f.notation);
      expect(printWeave(tree)).toBe(f.notation);
      expect(compileError(f.notation).message).toBe(f.message);
    });
  }

  it('the depth-4 case reports depth even on a spindle too small for it', () => {
    const deep = mustFailWeaves[4]!;
    expect(compileError(deep.notation, testCtx(10))).toEqual({
      message: 'Branches can nest at most 3 deep',
      path: ['root', 'b0', 'b0', 'b0', 'b0', 'branch'],
    });
  });

  it('errors point at the offending node', () => {
    expect(compileError('Cast > Nova[Fire, Pierce]').path).toEqual(['root', 'i1']);
    expect(compileError('Cast > Sigil[Fire]').path).toEqual(['root', 'form']);
    expect(compileError('Cast > Bolt[]').path).toEqual(['root', 'form']);
    expect(compileError('Cast > Bolt[Fire, Split, Split]').path).toEqual(['root', 'i2']);
  });
});
