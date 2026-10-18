/**
 * Performance benchmarks against DESIGN §12 (Node budgets).
 *   npm run bench [-- --ticks 20000] [--bench <id>] [--strict] [--json]
 * Add a bench by appending to `benches` (M1: "300 enemies + 2000 projectiles").
 */
import { performance } from 'node:perf_hooks';
import { createGame, findScenario, step } from '../src/sim';
import { parseArgs, requireInt, runCli } from './lib/args';
import { loadRoomText } from './lib/rooms';
import { summarize, type Summary } from './lib/stats';

export interface Bench {
  id: string;
  description: string;
  /** Budget in ms per tick (mean and p99 must both be under it), or null when not measurable yet. */
  budgetMs: number | null;
  /** Shown when budgetMs is null. */
  pendingNote?: string;
  /** Builds the workload; returns a function that advances one tick. */
  setup(): () => void;
}

const ENTITY_BUDGET_MS = 2.7;
const GRID_BUDGET_MS = 2.0;

function scenarioBench(scenarioId: string): Bench {
  const scenario = findScenario(scenarioId)!;
  return {
    id: `entity:${scenarioId}`,
    description: `Entity step, scenario ${scenarioId}`,
    budgetMs: ENTITY_BUDGET_MS,
    setup() {
      const state = createGame({ seed: 1, roomText: loadRoomText(scenario.roomId) });
      return () => step(state, scenario.input(state.tick, state));
    },
  };
}

export const benches: Bench[] = [
  scenarioBench('wander'),
  scenarioBench('wall_press'),
  {
    id: 'grid',
    description: 'Chemistry grid tick (20 Hz)',
    budgetMs: null,
    pendingNote: 'n/a until M3',
    setup: () => () => {},
  },
];

interface Result extends Summary {
  id: string;
  budgetMs: number | null;
  ok: boolean | null;
}

function runBench(b: Bench, ticks: number, warmup: number): Result {
  const tick = b.setup();
  for (let i = 0; i < warmup; i++) tick();
  const samples = new Float64Array(ticks);
  for (let i = 0; i < ticks; i++) {
    const t0 = performance.now();
    tick();
    samples[i] = performance.now() - t0;
  }
  const s = summarize(samples);
  return {
    id: b.id,
    ...s,
    budgetMs: b.budgetMs,
    ok: b.budgetMs === null ? null : s.mean <= b.budgetMs && s.p99 <= b.budgetMs,
  };
}

runCli(() => {
  const a = parseArgs(process.argv.slice(2), {
    ticks: { kind: 'number', default: 20000 },
    warmup: { kind: 'number', default: 2000 },
    bench: { kind: 'string' },
    strict: { kind: 'boolean' },
    json: { kind: 'boolean' },
  });
  const ticks = requireInt('ticks', a.ticks, 10000);
  const warmup = requireInt('warmup', a.warmup, 0);
  const selected = benches.filter(
    (b) => a.bench === undefined || b.id === a.bench || b.id.startsWith(`${a.bench}:`),
  );
  if (selected.length === 0)
    throw new Error(`No bench "${a.bench}". Available: ${benches.map((b) => b.id).join(', ')}`);

  const results: (Result & { note?: string })[] = [];
  for (const b of selected) {
    if (b.budgetMs === null)
      results.push({
        id: b.id,
        n: 0,
        mean: 0,
        p99: 0,
        max: 0,
        budgetMs: null,
        ok: null,
        note: b.pendingNote,
      });
    else results.push(runBench(b, ticks, warmup));
  }

  if (a.json) console.log(JSON.stringify(results));
  else {
    for (const r of results) {
      if (r.budgetMs === null)
        console.log(`${r.id.padEnd(20)} ${r.note ?? 'n/a'}  (budget ${GRID_BUDGET_MS} ms)`);
      else
        console.log(
          `${r.id.padEnd(20)} mean ${r.mean.toFixed(4)} ms  p99 ${r.p99.toFixed(4)} ms  max ${r.max.toFixed(3)} ms  budget ${r.budgetMs} ms  ${r.ok ? 'OK' : 'OVER BUDGET'}`,
        );
    }
  }
  if (a.strict && results.some((r) => r.ok === false)) process.exitCode = 1;
});
