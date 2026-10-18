/**
 * Performance benchmarks against DESIGN §12 (Node budgets).
 *   npm run bench [-- --ticks 20000] [--bench <id>] [--strict] [--json]
 * Add a bench by appending to `benches`.
 */
import { performance } from 'node:perf_hooks';
import {
  Rng,
  applyLoadoutSpec,
  createGame,
  createReferenceScene,
  createScenarioGame,
  findScenario,
  fireProgram,
  makePacket,
  openCast,
  referenceWeaves,
  spawnGroup,
  spawnSpell,
  step,
  NEUTRAL_INPUT,
  type GameState,
} from '../src/sim';
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
      const state = createScenarioGame(scenario, loadRoomText(scenario.roomId), { seed: 1 });
      return () => step(state, scenario.input(state.tick, state));
    },
  };
}

const STRESS_ENEMIES = { tinderling: 180, ember_archer: 75, shieldbearer: 45 };
const STRESS_BOLTS = 2000;

/**
 * DESIGN §12 stress: 300 aggroed enemies with AI (60% Tinderlings, 25% archers, 15%
 * Shieldbearers) closing on a god-mode player, and 2,000 live player Bolt instances (the spell
 * runtime's `Cast > Bolt[Fire]`) flying in the arena. Bolts deal no damage and no knockback so
 * the load stays constant (as the M1 projectile version); ended bolts are replaced each tick from random open cells in random directions (a
 * bench-only Rng, so sim streams are untouched). The top-up is timed with the step.
 */
function stressBench(): Bench {
  return {
    id: 'entity:stress_300_2000',
    description: 'Entity step, 300 enemies with AI + 2,000 bolt spell instances',
    budgetMs: ENTITY_BUDGET_MS,
    setup() {
      const state = createGame({ seed: 1, roomText: loadRoomText('test/arena'), spawnRoomEnemies: false });
      state.cheats.god = true;
      spawnGroup(state, STRESS_ENEMIES, state.room.level);
      const rng = new Rng(7);
      // One fire owns every bolt: a bench-only program copy without the per-cast cap.
      const program = { ...state.weaves.slots[0]!.program!, spawnCap: Infinity };
      const cast = openCast(state, -1, 'cast', program);
      // Bench-only copy of the bolt spec without knockback, so hits don't scatter the crowd.
      const spec = { ...program.root, knockback: 0 };
      const harmless = makePacket(0, { fire: 1 }, 0, state.tuning.combat.critMultiplier);
      const topUp = (s: GameState) => {
        for (let live = s.stats.spells; live < STRESS_BOLTS; live++) {
          let x: number;
          let y: number;
          do {
            x = rng.range(0, s.room.width);
            y = rng.range(0, s.room.height);
          } while (s.room.shotSolid[Math.floor(y) * s.room.width + Math.floor(x)] === 1);
          let dx: number;
          let dy: number;
          let l2: number;
          do {
            dx = rng.range(-1, 1);
            dy = rng.range(-1, 1);
            l2 = dx * dx + dy * dy;
          } while (l2 > 1 || l2 === 0);
          const l = Math.sqrt(l2);
          spawnSpell(s, cast, spec, {
            x,
            y,
            dirX: dx / l,
            dirY: dy / l,
            aimX: x,
            aimY: y,
            sourceId: -1,
            echo: false,
            damageMult: 1,
            fromPlayer: false,
          });
          s.spells[s.spells.length - 1]!.packet = harmless;
        }
      };
      return () => {
        topUp(state);
        step(state, { ...NEUTRAL_INPUT, aimX: state.player.x + 1, aimY: state.player.y });
      };
    },
  };
}

/**
 * BUILD_PLAN M2 acceptance: 4 copies of reference weave 14 (Recursion Stress) on a 22-Capacity
 * test spindle in dummy_grid, all four slots firing at the grid every 0.45 s (its cast time),
 * each fire hitting the 64-instance cap.
 */
function weave14Bench(): Bench {
  return {
    id: 'entity:weave14_x4',
    description: 'Entity step, 4 × reference weave 14 firing in dummy_grid (22-Capacity test spindle)',
    budgetMs: ENTITY_BUDGET_MS,
    setup() {
      const { state, centerX, centerY } = createReferenceScene('dummy_grid', { seed: 1 });
      const notation = referenceWeaves.find((w) => w.n === 14)!.notation;
      applyLoadoutSpec(state, {
        spindleId: 'test_spindle',
        capacity: 22,
        notations: [notation, notation, notation, notation],
      });
      state.cheats.infiniteMana = true;
      const p = state.player;
      const len = Math.hypot(centerX - p.x, centerY - p.y);
      const period = Math.round(state.weaves.slots[0]!.program!.castTime * 60);
      const frame = { ...NEUTRAL_INPUT, aimX: centerX, aimY: centerY };
      let t = 0;
      return () => {
        if (t++ % period === 0)
          for (let slot = 0; slot < 4; slot++)
            fireProgram(
              state,
              slot,
              state.weaves.slots[slot]!.program!,
              p.x,
              p.y,
              (centerX - p.x) / len,
              (centerY - p.y) / len,
              centerX,
              centerY,
              -1,
              true,
            );
        step(state, frame);
      };
    },
  };
}

export const benches: Bench[] = [
  scenarioBench('wander'),
  scenarioBench('wall_press'),
  scenarioBench('combat'),
  scenarioBench('arena_bot'),
  scenarioBench('weave_mix'),
  scenarioBench('weave_events'),
  stressBench(),
  weave14Bench(),
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
        console.log(`${r.id.padEnd(26)} ${r.note ?? 'n/a'}  (budget ${GRID_BUDGET_MS} ms)`);
      else
        console.log(
          `${r.id.padEnd(26)} mean ${r.mean.toFixed(4)} ms  p99 ${r.p99.toFixed(4)} ms  max ${r.max.toFixed(3)} ms  budget ${r.budgetMs} ms  ${r.ok ? 'OK' : 'OVER BUDGET'}`,
        );
    }
  }
  if (a.strict && results.some((r) => r.ok === false)) process.exitCode = 1;
});
