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
  stepGrid,
  applyElement,
  activeCount,
  PLAYER_ID,
  NEUTRAL_INPUT,
  GRID_EVERY,
  applyBlasts,
  kiterInput,
  startArenaWave,
  createGrid,
  type GameState,
  type InputFrame,
} from '../src/sim';
import { MAT, OWNER } from '../data/materials';
import { parseArgs, requireInt, runCli } from './lib/args';
import { loadRoomText } from './lib/rooms';
import { adventureBench } from './lib/adventureBench';
import { riftBench } from './lib/riftBench';
import { fenFightSetup } from './lib/fenBench';
import { coilFightSetup } from './lib/fenBossBench';
import { gridWindBench } from './lib/gridWindBench';
import { summarize, type Summary } from './lib/stats';

export interface Bench {
  id: string;
  description: string;
  /** Budget in ms per tick (mean and p99 must both be under it), or null when not measurable yet. */
  budgetMs: number | null;
  /** Shown when budgetMs is null and the bench doesn't run. */
  pendingNote?: string;
  /** Runs and reports without a budget (worst cases). */
  reportOnly?: boolean;
  /** Extra line after the result (e.g. the mean active-cell share). */
  note?: () => string;
  /** Called once after warmup, before the measured ticks. */
  onMeasureStart?: () => void;
  /**
   * Builds the workload; returns a function that advances one tick. If it returns a number, that
   * is the tick's sample in ms (a bench that times only part of its tick); else the call is timed.
   */
  setup(): () => number | void;
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

/**
 * Entity benches time the entity step apart from the chemistry grid tick, which DESIGN §12
 * budgets on its own (2.0 ms): the grid never ticks inside `step` (its clock is parked), and
 * `splitStep` runs it (and its blasts) every GRID_EVERY non-hitstop ticks, timing it into
 * `gridMs`. The order of work is the same as in `step`.
 */
function splitStepper(state: GameState) {
  state.grid.clock = Number.NEGATIVE_INFINITY;
  let clock = 0;
  const gridMs: number[] = [];
  return {
    gridMs,
    step(input: InputFrame): number {
      const hitstop = state.hitstopLeft > 0;
      const t0 = performance.now();
      step(state, input);
      const t1 = performance.now();
      if (!hitstop && ++clock >= GRID_EVERY) {
        clock = 0;
        stepGrid(state);
        applyBlasts(state);
        gridMs.push(performance.now() - t1);
      }
      return t1 - t0;
    },
  };
}

/** The note line for a split bench: the grid tick's own numbers against its budget. */
function gridNote(ms: number[], extra = ''): string {
  const g = summarize(ms);
  const ok = g.mean <= GRID_BUDGET_MS && g.p99 <= GRID_BUDGET_MS ? 'OK' : 'OVER BUDGET';
  return `grid tick mean ${g.mean.toFixed(4)} ms p99 ${g.p99.toFixed(4)} ms, budget ${GRID_BUDGET_MS} ms ${ok}${extra}`;
}

const STRESS_ENEMIES = { tinderling: 180, ember_archer: 75, shieldbearer: 45 };
const STRESS_BOLTS = 2000;

/**
 * DESIGN §12 stress: 300 aggroed enemies with AI (60% Tinderlings, 25% archers, 15%
 * Shieldbearers) closing on a god-mode player, and 2,000 live player Bolt instances (the spell
 * runtime's `Cast > Bolt[Fire]`) flying in the arena. Bolts deal no damage and no knockback so
 * the load stays constant (as the M1 projectile version), and since M3 no terrain footprint
 * either (a burning arena would kill the crowd; the Wilds bench carries the terrain load); ended
 * bolts are replaced each tick from random open cells in random directions (a bench-only Rng, so
 * sim streams are untouched). The top-up is timed with the step.
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
      // Bench-only copy of the bolt spec without knockback (hits don't scatter the crowd) and
      // without a terrain footprint.
      const root = program.root;
      const spec = {
        ...root,
        knockback: 0,
        terrain: { ...root.terrain, footprint: { kind: 'none' as const } },
      };
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
 * M3: the kiter bot fighting arena waves in the Wilds (grass, water, oil, barrels, metal) with
 * fire, frost and storm weaves on all four slots (two cast, Pulse and On Dodge), god mode and
 * free mana so it never stops, while enemies and the player take terrain damage. Starts at wave
 * 30 (66 enemies, growing to 80); burnt meadows regrow every 10 s. Entity step budget; the grid
 * tick is timed apart (splitStepper).
 */
function wildsTerrainBench(): Bench {
  let split: ReturnType<typeof splitStepper> | null = null;
  let state: GameState | null = null;
  let enemies = 0;
  let active = 0;
  let samples = 0;
  return {
    id: 'entity:wilds_bot_terrain',
    description: 'Entity step, kiter bot vs Wilds arena waves with fire/frost/storm terrain',
    budgetMs: ENTITY_BUDGET_MS,
    note: () =>
      gridNote(
        split?.gridMs ?? [],
        `; mean ${(enemies / Math.max(1, samples)).toFixed(0)} enemies, ` +
          `${((100 * active) / Math.max(1, samples) / (state ? state.grid.ground.length : 1)).toFixed(1)}% cells active`,
      ),
    onMeasureStart() {
      split!.gridMs.length = 0;
      enemies = active = samples = 0;
    },
    setup() {
      const s = createGame({ seed: 1, roomText: loadRoomText('test/wilds'), mode: 'arena' });
      state = s;
      s.cheats.god = true;
      s.cheats.infiniteMana = true;
      applyLoadoutSpec(s, {
        spindleId: 'test_spindle',
        capacity: 99,
        notations: [
          'Cast > Bolt[Fire, Storm]',
          'Cast > Strike[Frost]',
          'Pulse > Lob[Storm, Saturate]',
          'OnDodge > Nova[Frost, Saturate]',
        ],
      });
      // Wave 30: 66 enemies at area level 11, so the crowd outlives the bot's damage.
      startArenaWave(s, 30);
      split = splitStepper(s);
      // The meadows regrow (ash back to grass, untimed) every 10 s, so fire keeps finding fuel.
      const pristine = createGrid(s.room);
      const g = s.grid;
      let t = 0;
      return () => {
        if (++t % 600 === 0)
          for (let i = 0; i < g.ground.length; i++)
            if (g.ground[i] === MAT.ash && pristine.ground[i] === MAT.grass && g.fire[i] === 0)
              g.ground[i] = MAT.grass;
        const ms = split!.step(kiterInput(s));
        enemies += s.enemies.length;
        active += activeCount(s.grid.active);
        samples++;
        return ms;
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
  scenarioBench('wilds_terrain'),
  scenarioBench('fen_packs'),
  {
    id: 'entity:fen_fight',
    description:
      'Entity step (grid included), the seven Fen packs kept alive around a god-mode bot, Storm in their water',
    budgetMs: ENTITY_BUDGET_MS,
    setup: fenFightSetup,
  },
  {
    id: 'entity:coil_fight',
    description: 'Entity step (grid included), the boss bot against the Glasswater Coil in phase 3, Tide strips and pulses',
    budgetMs: ENTITY_BUDGET_MS,
    setup: coilFightSetup,
  },
  stressBench(),
  wildsTerrainBench(),
  weave14Bench(),
  gridTypicalBench(),
  gridWindBench(GRID_BUDGET_MS),
  gridWorstBench(),
  adventureBench(ENTITY_BUDGET_MS),
  riftBench(ENTITY_BUDGET_MS),
];

const GRID_TILES = 64; // 256 × 256 cells
const GRASS_TILE_ROWS = 14;

/** A 256×256-cell room: grass on top, a water lake bottom left, a metal yard bottom right. */
function gridRoom(): string {
  const rows: string[] = [];
  for (let ty = 0; ty < GRID_TILES; ty++) {
    if (ty < GRASS_TILE_ROWS) rows.push('"'.repeat(GRID_TILES));
    else if (ty < 44) rows.push('.'.repeat(GRID_TILES));
    else rows.push('~'.repeat(28) + '.'.repeat(8) + 'm'.repeat(28));
  }
  return `@id bench/grid\n${rows.join('\n')}\n`;
}

/**
 * DESIGN §12 grid budget: 256×256 cells with ~20% active. A fire sweeps the grass (176 rows),
 * burnt rows regrow one row per grid tick so it never runs out, and Storm hits the lake and the
 * metal yard every second (charge on ~3,000 cells). Each sample is one grid tick, including the
 * hits and regrowth in it. The note reports the mean active share.
 */
function gridTypicalBench(): Bench {
  let activeSum = 0;
  let samples = 0;
  let cells = 1;
  return {
    id: 'grid:typical_20pct',
    description: 'Chemistry grid tick, 256×256 with ~20% active (fire, smoke, charge)',
    budgetMs: GRID_BUDGET_MS,
    note: () => `mean active ${((100 * activeSum) / Math.max(1, samples) / cells).toFixed(1)}% of cells`,
    setup() {
      const state = createGame({ seed: 1, roomText: gridRoom(), spawnRoomEnemies: false });
      const g = state.grid;
      cells = g.width * g.height;
      const grassRows = GRASS_TILE_ROWS * 4;
      const fire = (x: number, y: number) =>
        applyElement(state, { ...APP, element: 'fire', shape: { kind: 'circle', x, y, r: 2 } });
      const storm = (x: number, y: number) =>
        applyElement(state, { ...APP, element: 'storm', shape: { kind: 'circle', x, y, r: 2 } });
      let t = 0;
      return () => {
        // Regrow one burnt row (ash back to grass) per grid tick.
        const row = (t % grassRows) * g.width;
        for (let i = row; i < row + g.width; i++)
          if (g.ground[i] === MAT.ash && g.fire[i] === 0 && g.airTimer[i] === 0) g.ground[i] = MAT.grass;
        if (t % 40 === 0) for (let k = 0; k < 4; k++) fire(32 + 64 * k, 8 + ((t / 40) % 4) * 13);
        if (t % 20 === 0) {
          for (const [x, y] of [
            [20, 196],
            [60, 236],
            [100, 210],
            [20, 246],
          ])
            storm(x!, y!);
          storm(200, 220);
        }
        t++;
        stepGrid(state);
        activeSum += activeCount(g.active);
        samples++;
      };
    },
  };
}

/** Worst case: every cell of a 256×256 grass field burning (and smoking) on every tick. */
function gridWorstBench(): Bench {
  return {
    id: 'grid:worst_all_burning',
    description: 'Chemistry grid tick, all 65,536 cells of a grass field burning',
    budgetMs: null,
    reportOnly: true,
    setup() {
      const rows = Array.from({ length: GRID_TILES }, () => '"'.repeat(GRID_TILES));
      const state = createGame({
        seed: 1,
        roomText: `@id bench/grass\n${rows.join('\n')}\n`,
        spawnRoomEnemies: false,
      });
      // Lingering ×1000: 40,000 grid ticks of fuel, so the field burns for the whole run.
      applyElement(state, {
        ...APP,
        element: 'fire',
        shape: { kind: 'circle', x: 128, y: 128, r: 182 },
        durationMult: 1000,
      });
      return () => stepGrid(state);
    },
  };
}

const APP = { owner: OWNER.player, sourceId: PLAYER_ID, hitDamage: 10, durationMult: 1 } as const;

interface Result extends Summary {
  id: string;
  budgetMs: number | null;
  ok: boolean | null;
}

function runBench(b: Bench, ticks: number, warmup: number): Result {
  const tick = b.setup();
  for (let i = 0; i < warmup; i++) tick();
  b.onMeasureStart?.();
  const samples = new Float64Array(ticks);
  for (let i = 0; i < ticks; i++) {
    const t0 = performance.now();
    const own = tick();
    samples[i] = typeof own === 'number' ? own : performance.now() - t0;
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
    if (b.budgetMs === null && !b.reportOnly)
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
    else results.push({ ...runBench(b, ticks, warmup), note: b.note?.() });
  }

  if (a.json) console.log(JSON.stringify(results));
  else {
    for (const r of results) {
      if (r.n === 0) console.log(`${r.id.padEnd(26)} ${r.note ?? 'n/a'}`);
      else {
        const verdict =
          r.budgetMs === null ? 'no budget' : `budget ${r.budgetMs} ms  ${r.ok ? 'OK' : 'OVER BUDGET'}`;
        console.log(
          `${r.id.padEnd(26)} mean ${r.mean.toFixed(4)} ms  p99 ${r.p99.toFixed(4)} ms  max ${r.max.toFixed(3)} ms  ${verdict}${r.note ? `  (${r.note})` : ''}`,
        );
      }
    }
  }
  if (a.strict && results.some((r) => r.ok === false)) process.exitCode = 1;
});
