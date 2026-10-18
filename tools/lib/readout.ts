/** The `npm run sim -- --weave` mode: argument handling and printing around runReadout. */
import { runReadout, type ReadoutInput, type ReadoutResult } from '../../src/sim';
import { isSpindleId } from '../../data/spindles';
import { ArgError, requireInt } from './args';

const SCENES: readonly ReadoutInput['scene'][] = ['dummy_single', 'dummy_pack', 'dummy_grid'];

export interface ReadoutArgs {
  weave?: string;
  scene?: string;
  seconds?: number;
  runs?: number;
  seed?: number;
  spindle?: string;
  capacity?: number;
}

/** Validates CLI arguments into a ReadoutInput and runs it. */
export function readoutFromArgs(a: ReadoutArgs): { input: ReadoutInput; result: ReadoutResult } {
  const scene = a.scene ?? 'dummy_pack';
  if (!SCENES.includes(scene as ReadoutInput['scene']))
    throw new ArgError(`--scene must be one of ${SCENES.join(', ')}, got "${scene}"`);
  const spindle = a.spindle ?? 'heartwood';
  if (!isSpindleId(spindle)) throw new ArgError(`Unknown --spindle "${spindle}"`);
  const seconds = a.seconds ?? 10;
  if (!(seconds > 0)) throw new ArgError(`--seconds must be > 0, got ${seconds}`);
  const input: ReadoutInput = {
    notation: a.weave ?? '',
    spindleId: spindle,
    scene: scene as ReadoutInput['scene'],
    seconds,
    runs: requireInt('runs', a.runs ?? 50, 1),
    seed: requireInt('seed', a.seed ?? 1, 0),
  };
  if (a.capacity !== undefined) input.capacity = requireInt('capacity', a.capacity, 0);
  return { input, result: runReadout(input) };
}

const f = (n: number, d = 2): string => n.toFixed(d);

export function printReadout(input: ReadoutInput, r: ReadoutResult): void {
  console.log(
    `weave="${input.notation}" scene=${input.scene} spindle=${input.spindleId}` +
      `${input.capacity !== undefined ? ` capacity=${input.capacity}` : ''} seconds=${input.seconds} runs=${input.runs} seed=${input.seed}`,
  );
  if (!r.ok) {
    console.log(`error: ${r.error}`);
    return;
  }
  console.log(`DPS ${f(r.dps)} (hits ${f(r.hitDps)}, damage over time ${f(r.dotDps)})`);
  console.log(
    `by type: ${
      Object.entries(r.dpsByType)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k} ${f(v)}`)
        .join(', ') || 'none'
    }`,
  );
  console.log(`hits/s ${f(r.hitsPerSecond)}  fires/s ${f(r.firesPerSecond)}`);
  console.log(
    `mana/s spent ${f(r.manaSpentPerSecond)}  refunded ${f(r.manaRefundPerSecond)}  net ${f(r.manaSpentPerSecond - r.manaRefundPerSecond)}`,
  );
  console.log(`instances/fire ${f(r.instancesPerFire)}  dropped/fire ${f(r.droppedPerFire)}`);
  const min = Math.min(...r.perRunDps);
  const max = Math.max(...r.perRunDps);
  console.log(`per-run DPS ${f(min)} – ${f(max)}`);
  for (const n of r.notes) console.log(`note: ${n}`);
}
