/**
 * `npm run sim -- --rifts [--count 1000] [--tier T] [--seed 1] [--json]` (M6 acceptance): generates
 * `count` rifts per tier with random modifiers, runs the solver on each and prints a table per tier.
 * Exit code 1 if any rift is not connected and completable.
 */
import { RIFT_TIERS, riftMods, type RiftModId } from '../../data/rift';
import { generateRift, solveRift } from '../../src/sim';
import { Rng } from '../../src/sim/core/rng';
import { loadAllRooms } from './rooms';

export interface RiftCliOptions {
  count: number;
  tier?: number;
  seed: number;
  json?: boolean;
}

interface TierRow {
  tier: number;
  rifts: number;
  solved: number;
  avgRooms: number;
  firstProblem: string | null;
}

const PREFIXES = (Object.keys(riftMods) as RiftModId[]).filter((id) => riftMods[id].kind === 'prefix');
const SUFFIXES = (Object.keys(riftMods) as RiftModId[]).filter((id) => riftMods[id].kind === 'suffix');

function pick(rng: Rng, list: readonly RiftModId[], n: number): RiftModId[] {
  const pool = [...list];
  const out: RiftModId[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) out.push(pool.splice(rng.int(pool.length), 1)[0]!);
  return out;
}

export function runRiftCli(o: RiftCliOptions): void {
  const templates = loadAllRooms();
  const rng = new Rng(o.seed >>> 0);
  const tiers = o.tier !== undefined ? [o.tier] : Array.from({ length: RIFT_TIERS }, (_, i) => i + 1);
  const rows: TierRow[] = [];
  const t0 = performance.now();
  for (const tier of tiers) {
    const row: TierRow = { tier, rifts: o.count, solved: 0, avgRooms: 0, firstProblem: null };
    for (let k = 0; k < o.count; k++) {
      const mods = [...pick(rng, PREFIXES, rng.int(3)), ...pick(rng, SUFFIXES, rng.int(3))];
      const spec = { index: k, seed: rng.nextU32(), tier, mods, home: { roomId: 'home', key: 'stone' } };
      const rift = generateRift(spec, templates);
      row.avgRooms += rift.plan.length / o.count;
      const res = solveRift(rift);
      if (res.ok) row.solved++;
      else row.firstProblem ??= `seed ${spec.seed} [${mods.join(' ')}]: ${res.problems[0]}`;
    }
    rows.push(row);
  }
  const ms = performance.now() - t0;
  const failed = rows.some((r) => r.solved < r.rifts);
  if (o.json) console.log(JSON.stringify({ rows, ms }));
  else {
    console.log('tier  rifts  solved  avg rooms (incl. boss)');
    for (const r of rows) {
      console.log(
        `${String(r.tier).padStart(4)}  ${String(r.rifts).padStart(5)}  ${String(r.solved).padStart(6)}  ${r.avgRooms.toFixed(2)}`,
      );
      if (r.firstProblem) console.log(`      first failure: ${r.firstProblem}`);
    }
    console.log(`${failed ? 'FAILED' : 'all solved'} in ${(ms / 1000).toFixed(1)} s`);
  }
  if (failed) process.exitCode = 1;
}
