/**
 * The Loom's DPS readout and the `npm run sim -- --weave` CLI (DESIGN §5.5, BUILD_PLAN M2 tasks
 * 7–8). Runs the real sim headlessly against a reference dummy scene; there is no separate damage
 * formula, so the numbers can't drift from the game.
 *
 * CONTRACT (M2): the Loom's Web Worker and tools/sim.ts call only `runReadout`.
 *
 * Each run builds the scene in memory (runtime/scenes.ts), puts the weave alone in slot 0 with
 * unlimited mana (cheats.infiniteMana), and holds Cast (LMB) aimed at the dummies' center for
 * `seconds`. Pulse runs naturally. On Dodge, On Hurt and On Crit are forced once per second,
 * limited by their ICD (GameState.triggerForcing). Harvest and On Kill can't fire: dummies never
 * die. Close-range roots (Strike, Nova, Swath, Orb) are measured with the dummies moved closer
 * (data/readout.ts closeRangeFraction); the notes say so. Damage comes only from the sim's
 * 'hit' and 'dot' events, so there is no separate formula.
 *
 * Determinism: run i uses seed `seed + i`. The same input always gives the same result, in the
 * worker and in Node, so the readout and the CLI agree exactly for equal seeds and run counts.
 */
import type { DamageAmounts } from '../../../data/combatTypes';
import { isSpindleId, type SpindleId } from '../../../data/spindles';
import { defaultTuning, type Tuning } from '../../../data/tuning';
import { previewFor } from './runtime/loadout';
import { measureRun, standoff, summarize, type RunTotals } from './runtime/measure';

/** DESIGN §5.5 reference scenes. dummy_grid is for stress tests, not the readout. */
export type ReadoutScene = 'dummy_single' | 'dummy_pack';

export interface ReadoutInput {
  /** The weave to measure, in notation. Cast weaves are held down continuously, aimed at the scene's center. */
  notation: string;
  spindleId: SpindleId;
  /** Overrides the spindle's Capacity (dev test_spindle). */
  capacity?: number;
  /** The Loom uses dummy_pack; dummy_grid (100 dummies) is for stress tests. */
  scene: ReadoutScene | 'dummy_grid';
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

/** Runs the weave headlessly in the reference scene (see the file comment). Pure and deterministic. */
export function runReadout(input: ReadoutInput): ReadoutResult {
  const tuning = input.tuning ?? defaultTuning;
  if (!isSpindleId(input.spindleId)) return { ok: false, error: `Unknown spindle "${input.spindleId}"` };
  if (!(input.seconds > 0) || !Number.isInteger(input.runs) || input.runs < 1)
    return { ok: false, error: 'The readout needs seconds > 0 and a whole number of runs ≥ 1' };
  const capacity = input.capacity ?? null;
  const preview = previewFor(input.spindleId, capacity, tuning, input.notation);
  if (preview.parseError) return { ok: false, error: preview.parseError.message };
  const compiled = preview.compiled!;
  if (!compiled.ok) return { ok: false, error: compiled.error.message };
  const program = compiled.program;
  const distance = standoff(input.scene, program.root);

  const runs: RunTotals[] = [];
  for (let i = 0; i < input.runs; i++)
    runs.push(measureRun(input, tuning, capacity, program, distance, (input.seed + i) >>> 0));
  return summarize(input, program, distance, runs);
}
