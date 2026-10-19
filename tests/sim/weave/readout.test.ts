import { describe, expect, it } from 'vitest';
import {
  compileWeave,
  referenceWeaves,
  runReadout,
  spindleContext,
  RUNTIME_SHIPS,
  type ReadoutInput,
} from '../../../src/sim';
import { spindles, testSpindle } from '../../../data/spindles';
import { parsed } from './helpers';

const base: ReadoutInput = {
  notation: 'Cast > Bolt[Fire]',
  spindleId: 'heartwood',
  scene: 'dummy_pack',
  seconds: 10,
  runs: 10,
  seed: 1,
};

function ok(input: ReadoutInput) {
  const r = runReadout(input);
  if (!r.ok) throw new Error(r.error);
  return r;
}

/** Capacity to run a reference weave with: Heartwood's if it fits, else a test spindle that fits. */
function capacityFor(notation: string): number | undefined {
  const fits = compileWeave(
    parsed(notation),
    spindleContext(spindles.heartwood, { allowShips: RUNTIME_SHIPS }),
  );
  if (fits.ok) return undefined;
  const t = compileWeave(parsed(notation), spindleContext(testSpindle(99), { allowShips: RUNTIME_SHIPS }));
  return t.ok ? t.program.complexity : undefined;
}

const HEAVY_TIMEOUT_MS = 300_000;

describe('DPS readout (DESIGN §5.5)', () => {
  it('reports every field for a simple weave, and is the same for the same input', () => {
    const a = ok(base);
    expect(a.perRunDps).toHaveLength(10);
    expect(a.dps).toBeCloseTo(a.hitDps + a.dotDps, 9);
    expect(a.dpsByType.fire).toBeCloseTo(a.dps, 9);
    expect(a.firesPerSecond).toBeCloseTo(2.2, 9); // a 0.45 s cast held for 10 s: 22 fires
    expect(a.manaSpentPerSecond).toBeCloseTo(2.2 * 6.6, 9);
    expect(a.manaRefundPerSecond).toBe(0);
    expect(a.instancesPerFire).toBe(1);
    expect(a.droppedPerFire).toBe(0);
    expect(a.hitsPerSecond).toBeCloseTo(2.2, 9);
    expect(a.notes).toEqual([]);
    expect(runReadout(base)).toEqual(a);
  });

  it('run i uses seed + i: fewer runs give the same first runs', () => {
    const ten = ok(base);
    const three = ok({ ...base, runs: 3 });
    expect(three.perRunDps).toEqual(ten.perRunDps.slice(0, 3));
    expect(ok({ ...base, runs: 2, seed: 2 }).perRunDps).toEqual(ten.perRunDps.slice(1, 3));
  });

  it('reports errors for weaves that do not parse or compile', () => {
    expect(runReadout({ ...base, notation: 'Cast > Bolt[' })).toMatchObject({ ok: false });
    expect(runReadout({ ...base, notation: 'Cast > Nova[Fire, Pierce]' })).toEqual({
      ok: false,
      error: "Nova can't take Pierce",
    });
    expect(runReadout({ ...base, notation: referenceWeaves[13]!.notation })).toEqual({
      ok: false,
      error: 'Needs 22 Capacity; this spindle has 13',
    });
    expect(runReadout({ ...base, runs: 0 }).ok).toBe(false);
  });

  it('notes Harvest and On Kill, the forced event triggers, and close-range placement', () => {
    expect(ok({ ...base, notation: 'Harvest > Nova[Fire]', runs: 1 })).toMatchObject({
      dps: 0,
      firesPerSecond: 0,
      notes: [
        "Harvest and On Kill can't fire against dummies, so their damage isn't included.",
        expect.stringMatching(/^Close range/),
      ],
    });
    const lance = ok({
      ...base,
      notation: 'Cast > Beam[Frost, Pierce] > OnKill > Nova[Frost, Wide]',
      runs: 1,
    });
    expect(lance.notes[0]).toMatch(/On Kill can't fire/);
    const dodge = ok({ ...base, notation: 'OnDodge > Nova[Frost, Saturate]', runs: 2 });
    expect(dodge.notes[0]).toBe('On Dodge assumes its event happens once per second, limited by its ICD.');
    expect(dodge.firesPerSecond).toBeCloseTo(1, 9);
    // On Crit's 0.3 s ICD never limits one event per second; On Hurt's 1 s ICD just allows it.
    expect(ok({ ...base, notation: 'OnHurt > Nova[Fire]', runs: 2 }).firesPerSecond).toBeCloseTo(1, 9);
    expect(ok({ ...base, notation: 'OnCrit > Nova[Fire]', runs: 2 }).firesPerSecond).toBeCloseTo(1, 9);
  });

  it('Strike and Nova show their mana refunds; close-range forms reach the dummies', () => {
    const strike = ok({ ...base, notation: 'Cast > Strike[]', runs: 2 });
    expect(strike.dps).toBeGreaterThan(0);
    expect(strike.manaRefundPerSecond).toBeGreaterThan(0);
    expect(strike.notes).toEqual(['Close range: measured with the dummies 3 cells away.']);
    expect(
      ok({ ...base, notation: 'Cast > Bolt[Fire]', scene: 'dummy_single', runs: 1 }).manaRefundPerSecond,
    ).toBe(0);
  });

  it(
    'for every reference weave, the 10-run mean is within 5% of the 50-run mean',
    () => {
      for (const w of referenceWeaves) {
        const capacity = capacityFor(w.notation);
        const r = ok({ ...base, notation: w.notation, capacity, runs: 50 });
        const ten = ok({ ...base, notation: w.notation, capacity, runs: 10 });
        expect(ten.perRunDps).toEqual(r.perRunDps.slice(0, 10));
        const mean10 = ten.dps;
        if (r.dps === 0) expect(mean10, w.name).toBe(0);
        else
          expect(Math.abs(mean10 - r.dps) / r.dps, `#${w.n} ${w.name}: ${mean10} vs ${r.dps}`).toBeLessThan(
            0.05,
          );
        if (w.n === 14) expect(r.droppedPerFire).toBeGreaterThan(0);
      }
    },
    HEAVY_TIMEOUT_MS,
  );
});
