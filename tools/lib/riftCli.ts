/**
 * `npm run sim -- --rifts [--count 1000] [--tier T] [--seed 1] [--json]` (M6 acceptance): generates
 * `count` rifts per tier with random modifiers, runs the solver on each and prints a table per tier.
 * Exit code 1 if any rift is not connected and completable.
 */
import { RIFT_TIERS, riftMods, type RiftModId } from '../../data/rift';
import { generateRift, solveRift } from '../../src/sim';
import { Rng } from '../../src/sim/core/rng';
import { loadAllRooms } from './rooms';
import {
  riftCharacter,
  runRiftBot,
  summarizeRiftRuns,
  type RiftBuild,
  type RiftRunLog,
} from '../../src/sim/bots/riftBot';
import { rollSigilMods } from '../../src/sim/items/sigils';
import { runRiftLadder, type LadderResult } from '../../src/sim/bots/riftLadder';

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

export interface RiftBotCliOptions {
  count: number;
  tiers: number[];
  builds: RiftBuild[];
  seed: number;
  json?: boolean;
}

/**
 * `npm run sim -- --rift-bot [--count 5] [--tier 4] [--builds fire,frost] [--seed 1] [--json]`
 * (M6 acceptance: a clear-rate report per tier for each reference build): the rift bot
 * (src/sim/bots/riftBot.ts) runs `count` rifts per tier and build, each with modifiers rolled
 * like a dropped sigil's.
 */
export function runRiftBotCli(o: RiftBotCliOptions): void {
  const rooms = loadAllRooms();
  const t0 = performance.now();
  const rows: {
    build: RiftBuild;
    tier: number;
    summary: ReturnType<typeof summarizeRiftRuns>;
    logs: RiftRunLog[];
  }[] = [];
  for (const build of o.builds)
    for (const tier of o.tiers) {
      const rng = new Rng((o.seed * 7919 + tier) >>> 0);
      const hero = riftCharacter(tier);
      const logs: RiftRunLog[] = [];
      for (let k = 0; k < o.count; k++)
        logs.push(
          runRiftBot({ rooms, seed: o.seed * 1000 + k, tier, mods: rollSigilMods(rng, tier), build, hero }),
        );
      rows.push({ build, tier, summary: summarizeRiftRuns(logs), logs });
      if (!o.json) {
        const s = summarizeRiftRuns(logs);
        const pct = Math.round((100 * s.completed) / s.runs);
        const why = logs
          .filter((l) => !l.completed)
          .map(
            (l) =>
              `${l.died ? 'died' : 'timeout'} ${l.endedIn?.replace(/^rift\/\d+\//, '')}[${l.mods.join(' ')}]${l.deathCause ? `: ${l.deathCause}` : ''}`,
          )
          .slice(0, 3)
          .join('; ');
        console.log(
          `${build.padEnd(5)} T${String(tier).padStart(2)} L${String(logs[0]?.level ?? 0).padStart(2)}  ` +
            `${String(s.completed).padStart(2)}/${s.runs} (${String(pct).padStart(3)}%)  deaths ${s.deaths}  timeouts ${s.timeouts}  ` +
            `clear ${s.avgSeconds.toFixed(0)} s  boss ${s.avgBossSeconds?.toFixed(0) ?? '-'} s  stuck ${s.stuck}` +
            (why ? `\n      ${why}` : ''),
        );
      }
    }
  if (o.json)
    console.log(
      JSON.stringify({
        rows: rows.map(({ build, tier, summary }) => ({ build, tier, ...summary })),
        ms: performance.now() - t0,
      }),
    );
  else console.log(`${rows.length} tier rows in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
}

/**
 * `npm run sim -- --rift-ladder [--seed 1] [--seeds 3] [--target 8] [--verbose] [--json]` (M6.5):
 * a new game played to the Warden, then the same character climbs the rift ladder with what it
 * finds (src/sim/bots/riftLadder.ts). Prints hours to each tier's first clear and every rift.
 * M7: it never Rekindles, so it stops at the tier cap (10); `--progression` supersedes it.
 */
export function runRiftLadderCli(o: {
  seed: number;
  seeds: number;
  target: number;
  verbose?: boolean;
  json?: boolean;
}): void {
  const rooms = loadAllRooms();
  const results: LadderResult[] = [];
  for (let k = 0; k < o.seeds; k++) {
    const r = runRiftLadder({ seed: o.seed + k, rooms, targetTier: o.target });
    results.push(r);
    if (o.json) continue;
    const fails = r.rifts.filter((x) => !x.completed);
    console.log(
      `seed ${r.seed}: campaign ${r.campaignHours.toFixed(2)} h; ${r.rifts.length} rifts, ${fails.length} failed ` +
        `(${fails.filter((x) => x.died).length} deaths); ` +
        `${r.reachedTarget ? `tier ${o.target} at ${r.firstClear[o.target]!.toFixed(2)} h` : `tier ${o.target} not reached`}; level ${r.finalLevel}`,
    );
    console.log(
      '  first clears (h): ' +
        Object.entries(r.firstClear)
          .map(([t, h]) => `T${t} ${h.toFixed(2)}`)
          .join(', '),
    );
    if (o.verbose)
      for (const x of r.rifts)
        console.log(
          `  T${x.tier} L${x.level} life ${Math.round(x.maxLife)} gear ${x.gearScore.toFixed(0)} ` +
            `${x.completed ? 'cleared' : x.died ? 'DIED' : 'timeout'} ${x.seconds.toFixed(0)} s [${x.mods.join(' ')}]` +
            (x.deathCause ? ` ${x.deathCause}` : ''),
        );
  }
  if (o.json) console.log(JSON.stringify(results.map((r) => ({ ...r, rifts: r.rifts.length }))));
}
