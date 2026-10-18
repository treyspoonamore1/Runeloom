import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { referenceWeaves, runReadout } from '../../src/sim';
import { readoutFromArgs } from '../../tools/lib/readout';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

function cli(args: string[]): unknown {
  const out = execFileSync('npx', ['tsx', 'tools/sim.ts', ...args, '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return JSON.parse(out);
}

describe('npm run sim -- --weave', () => {
  it('prints exactly what runReadout returns for the same seeds and runs', () => {
    const notation = referenceWeaves.find((w) => w.n === 13)!.notation;
    const printed = cli([
      '--weave',
      notation,
      '--runs',
      '4',
      '--seed',
      '7',
      '--seconds',
      '5',
      '--scene',
      'dummy_single',
    ]);
    const direct = runReadout({
      notation,
      spindleId: 'heartwood',
      scene: 'dummy_single',
      seconds: 5,
      runs: 4,
      seed: 7,
    });
    expect(direct.ok).toBe(true);
    expect(printed).toEqual(direct);
  }, 60_000);

  it('passes Capacity and spindle through, and reports compile errors', () => {
    const notation = referenceWeaves.find((w) => w.n === 14)!.notation;
    const printed = cli([
      '--weave',
      notation,
      '--runs',
      '1',
      '--spindle',
      'test_spindle',
      '--capacity',
      '22',
    ]);
    expect(printed).toEqual(
      runReadout({
        notation,
        spindleId: 'test_spindle',
        capacity: 22,
        scene: 'dummy_pack',
        seconds: 10,
        runs: 1,
        seed: 1,
      }),
    );
    expect(readoutFromArgs({ weave: notation }).result).toEqual({
      ok: false,
      error: 'Needs 22 Capacity; this spindle has 13',
    });
    expect(() => readoutFromArgs({ weave: notation, scene: 'arena' })).toThrow(/--scene/);
  }, 60_000);
});
