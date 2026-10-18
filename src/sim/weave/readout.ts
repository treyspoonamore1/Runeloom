/**
 * The Loom's DPS readout and the `npm run sim -- --weave` CLI (DESIGN §5.5, BUILD_PLAN M2 tasks
 * 7–8). Runs the real sim headlessly against a reference dummy scene; there is no separate damage
 * formula, so the numbers can't drift from the game.
 *
 * CONTRACT (M2): the Loom's Web Worker and tools/sim.ts call only `runReadout`. The runtime agent
 * implements it; until then this is a STUB that validates the weave and returns zeros.
 *
 * Determinism: run i uses seed `seed + i`. The same input always gives the same result, in the
 * worker and in Node, so the readout and the CLI agree exactly for equal seeds and run counts.
 */
import type { DamageAmounts } from '../../../data/combatTypes';
import type { SpindleId } from '../../../data/spindles';
import type { Tuning } from '../../../data/tuning';

/** DESIGN §5.5 reference scenes. dummy_grid is for stress tests, not the readout. */
export type ReadoutScene = 'dummy_single' | 'dummy_pack';

export interface ReadoutInput {
  /** The weave to measure, in notation. Cast weaves are held down continuously, aimed at the scene's center. */
  notation: string;
  spindleId: SpindleId;
  /** Overrides the spindle's Capacity (dev test_spindle). */
  capacity?: number;
  scene: ReadoutScene;
  /** Simulated seconds per run (the Loom uses 10). */
  seconds: number;
  /** Runs to average (the Loom uses 10, the CLI defaults to 50). */
  runs: number;
  /** Base seed; run i uses seed + i. */
  seed: number;
  /** Tuning to run with (defaults to data/tuning.ts). */
  tuning?: Tuning;
}

export type ReadoutResult =
  | {
      ok: true;
      /** Mean damage per second over all runs: hits plus damage over time. */
      dps: number;
      hitDps: number;
      dotDps: number;
      dpsByType: DamageAmounts;
      hitsPerSecond: number;
      /** Times the weave's root fired per second (casts or trigger fires). */
      firesPerSecond: number;
      /** Mana spent per second (mana is unlimited during the readout, so this shows the true cost). */
      manaSpentPerSecond: number;
      /** Mana restored per second by "Closer pays more" refunds. */
      manaRefundPerSecond: number;
      /** Spell instances created per fire, and spawns dropped by the per-cast cap, per fire. */
      instancesPerFire: number;
      droppedPerFire: number;
      /** DPS of each run, in run order (tests and variance display). */
      perRunDps: number[];
      /** Assumptions to show under the numbers, e.g. "On Kill and Harvest can't fire against dummies". */
      notes: string[];
    }
  | { ok: false; error: string };

/** STUB: replaced by the runtime agent. */
export function runReadout(_input: ReadoutInput): ReadoutResult {
  return { ok: false, error: 'The DPS readout arrives with the spell runtime.' };
}
