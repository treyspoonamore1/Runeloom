/**
 * `npm run sim -- --fen [--seed N] [--json]` (BUILD_PLAN M8 phase 1 acceptance "Campaign bot"):
 * loads the "Fen start" playtest save (data/playtest/fen_start.json: level 31, tier 8 done, at
 * K10's Loom Stone with the storm door open) and plays G1 to F10 with the Fen campaign bot
 * (src/sim/bots/fenRun.ts). Prints time per room, deaths, levels gained, both boss kill times,
 * the human pacing estimate (src/sim/bots/pacing.ts) and the no-Tide Coil comparison: the same
 * character as it walked into F10, fighting the Coil in F10 with Floodline and without
 * (src/sim/bots/fenBossBot.ts). `--seed N` (default 1) reseeds the save's RNG streams.
 * Exit code 1 if the bot died, a puzzle step failed or the Coil lives.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fenRooms } from '../../data/progression';
import { runFenBossFight, type FenBossFightLog } from '../../src/sim/bots/fenBossBot';
import { syncWeaveSpindle } from '../../src/sim/hero/equip';
import { refreshHero } from '../../src/sim/hero/hero';
import { fenReferenceCharacter, runFen, type FenRunResult } from '../../src/sim/bots/fenRun';
import { fenPacingMinutes } from '../../src/sim/bots/pacing';
import { Rng } from '../../src/sim/core/rng';
import type { HeroState } from '../../src/sim/hero/types';
import { SAVED_RNGS, type SaveData } from '../../src/sim/save';
import { createAdventure, loadSave, parseSave, type GameState } from '../../src/sim';
import { loadAllRooms } from './rooms';

const FEN_START = fileURLToPath(new URL('../../data/playtest/fen_start.json', import.meta.url));

/**
 * Who plays: 'save' (default) is the save's own character, the progression sim's at tier 8 with
 * the gear it found, under the bots' reference build (bots/campaignPlan.ts); 'reference' is the
 * Fen boss bot's tier 8 character (bots/fenRun.ts fenReferenceCharacter: the rift bot's tier 8
 * Rares at level 30, runes at 20, the rune copies the puzzles need) in the save's world.
 */
export type FenBuild = 'reference' | 'save';

export interface FenCliOptions {
  /** Reseed the save's RNG streams with this seed (undefined: as saved). */
  seed?: number;
  build?: FenBuild;
  json?: boolean;
}

/** The Fen start save as a live game; `seed` reseeds its RNG streams. */
export function loadFenStart(
  rooms: Record<string, string>,
  seed?: number,
  build: FenBuild = 'save',
): GameState {
  const save = parseSave(readFileSync(FEN_START, 'utf8'));
  const state =
    build === 'save'
      ? loadSave(save, (init) =>
          createAdventure({ seed: init.seed, rooms, hero: init.hero, world: init.world }),
        )
      : referenceInWorld(rooms, structuredClone(save.world), save.seed);
  if (seed !== undefined) {
    const base = new Rng(seed >>> 0);
    for (const k of SAVED_RNGS) state[k] = base.fork(k);
  }
  return state;
}

/** The tier 8 reference character standing where the save stands (K10's Loom Stone). */
function referenceInWorld(rooms: Record<string, string>, world: SaveData['world'], seed: number): GameState {
  const state = createAdventure({ seed, rooms, hero: fenReferenceCharacter(), world });
  syncWeaveSpindle(state);
  refreshHero(state);
  const p = state.player;
  p.life = p.maxLife;
  p.mana = p.maxMana;
  return state;
}

export interface FenCliResult {
  build: FenBuild;
  run: FenRunResult;
  pacingMinutes: number;
  coilTide: FenBossFightLog | null;
  coilNoTide: FenBossFightLog | null;
}

/** Plays the Fen from the save and the two isolated Coil fights from F10's door. */
export function fenReport(o: FenCliOptions): FenCliResult {
  const rooms = loadAllRooms();
  const build = o.build ?? 'save';
  const state = loadFenStart(rooms, o.seed, build);
  let hero: HeroState | null = null;
  let start = { x: 0, y: 0 };
  const run = runFen(state, {
    beforeCoil: (s) => {
      hero = structuredClone(s.hero);
      start = { x: s.player.x, y: s.player.y };
    },
  });
  const coil = (tide: 'tide' | 'none', maxSeconds: number): FenBossFightLog | null =>
    hero === null
      ? null
      : runFenBossFight({ rooms, roomId: fenRooms.f10, seed: o.seed ?? 1, tide, start, hero, maxSeconds });
  const coilTide = coil('tide', 600);
  const coilNoTide = coil('none', 900);
  return { build, run, pacingMinutes: fenPacingMinutes(run), coilTide, coilNoTide };
}

const f1 = (n: number) => n.toFixed(1);

export function runFenCli(o: FenCliOptions): void {
  const t0 = performance.now();
  const r = fenReport(o);
  const { run } = r;
  if (o.json) console.log(JSON.stringify(r));
  else {
    console.log(
      `character: ${r.build === 'reference' ? 'the Fen boss bot tier 8 character (fenReferenceCharacter)' : "the save's own (level 31, tier 8)"}, reference build`,
    );
    console.log('room        area  lvl    fight  puzzle   boss  deaths  damage  kills  steps');
    for (const v of run.visits)
      console.log(
        `${v.label.padEnd(10)}  ${String(v.areaLevel).padStart(4)}  ${`${v.entryLevel}-${v.exitLevel}`.padStart(5)}  ` +
          `${f1(v.fightSeconds).padStart(7)}  ${f1(v.puzzleSeconds).padStart(6)}  ${v.bossSeconds === undefined ? '     -' : f1(v.bossSeconds).padStart(6)}` +
          `  ${String(v.deaths).padStart(6)}  ${v.damageTaken.toFixed(0).padStart(6)}  ${String(v.kills).padStart(5)}  ` +
          `${v.steps.map((s) => (s.ok ? s.name : `${s.name} FAILED (${s.error})`)).join(', ')}` +
          `${v.rested ? '  [rested]' : ''}${v.stuck ? `  [${v.stuck} stuck]` : ''}${v.left.length ? `  [left ${v.left.join(' ')}]` : ''}` +
          `${v.deathCauses.length ? `  deaths: ${v.deathCauses.join(' | ')}` : ''}`,
      );
    console.log(
      `total: fights ${f1(run.fightSeconds / 60)} min, puzzles and walking ${f1(run.puzzleSeconds / 60)} min; ` +
        `deaths ${run.deaths}; level ${run.startLevel} -> ${run.endLevel} (+${run.endLevel - run.startLevel}); ` +
        `Coil ${run.coilDead ? 'dead' : 'ALIVE'}`,
    );
    console.log(`human pacing (bots/pacing.ts): ${f1(r.pacingMinutes)} min (target 50-70)`);
    console.log(
      `Bellwether: ${run.bellwetherSeconds === null ? '-' : f1(run.bellwetherSeconds)} s (target 60-100); ` +
        `Coil: ${run.coilSeconds === null ? '-' : f1(run.coilSeconds)} s (target 120-180, Tide strands)`,
    );
    const b = (l: FenBossFightLog | null) =>
      l === null
        ? '-'
        : `${l.killed ? '' : 'not dead after '}${f1(l.seconds)} s, ${l.strands} strands, ${l.overloads} Overloads${l.died ? ', DIED' : ''}`;
    console.log(
      `Coil from F10's door, same character: Floodline ${b(r.coilTide)}; no Tide ${b(r.coilNoTide)}`,
    );
    if (run.failedSteps.length) console.log(`failed steps: ${run.failedSteps.join('; ')}`);
    console.log(`(${f1((performance.now() - t0) / 1000)} s)`);
  }
  if (run.deaths > 0 || run.failedSteps.length > 0 || !run.coilDead) process.exitCode = 1;
}
