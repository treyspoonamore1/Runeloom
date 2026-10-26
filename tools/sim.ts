/**
 * Headless runner.
 *   npm run sim -- --scenario wander --ticks 10000 --seed 1 [--every 1000] [--json]
 *   npm run sim -- --replay replays/foo.json
 *   npm run sim -- --weave "<notation>" [--scene dummy_pack] [--seconds 10] [--runs 50] [--seed 1]
 *                  [--spindle heartwood] [--capacity 22] [--json]
 *   npm run sim -- --adventure [--room test/world_a] [--ticks 3600] [--seed 1] [--god] [--every N] [--json]
 *       An adventure game (all rooms from data/rooms) driven by the tour bot (bots/tour.ts): walks
 *       out through exits and fires at enemies. Prints each room entered and the final hash.
 *   npm run sim -- --campaign [--seed 1] [--seeds 3] [--until k5] [--verbose] [--json] [--no-craft]
 *       The M4 balance campaign: a new game played E1…K10 by the kiter bot with the reference
 *       build (src/sim/bots/campaign.ts). A table per seed, then a summary across seeds.
 *   npm run sim -- --encounters [--room k10] [--seed 1] [--seeds 5] [--level 12] [--rune-level 10]
 *       Each room's encounter with the reference character at its expected level
 *       (src/sim/bots/campaignEncounter.ts); exit code 1 if the bot dies.
 *   npm run sim -- --fen [--seed 1] [--build save|reference] [--json]
 *       M8: the Fen campaign bot from the Fen start save, G1 to F10 (tools/lib/fenCli.ts).
 *   npm run sim -- --rifts [--count 1000] [--tier 5] [--seed 1] [--json]
 *       M6: generates `count` rifts per tier with random modifiers and solves each (tools/lib/riftCli.ts).
 *   npm run sim -- --rift-bot [--count 5] [--tier 4] [--builds fire,frost] [--seed 1] [--json]
 *       M6: the rift bot's clear rate per tier and reference build (tools/lib/riftCli.ts).
 *   npm run sim -- --rift-ladder [--seed 1] [--seeds 3] [--target 8] [--verbose] [--json]
 *       M6.5: a new game to the Warden, then the rift ladder with found gear (tools/lib/riftCli.ts).
 *   npm run sim -- --playtest-saves [--seed 1] [--tier 7] [--out dir]
 *       Writes data/playtest/after_warden.json, mid_climb.json and fen_start.json (tools/lib/playtestSaves.ts).
 *   npm run sim -- --progression [--seed 1] [--seeds 3] [--rekindles 1] [--variants play,offline,nohearth]
 *                  [--sessions 1.5,16] [--rekindle-stall 3] [--rekindle-after 9] [--max-hours 40] [--out dir] [--no-hearth] [--verbose] [--json]
 *       M7: a new game to the Warden, then rifts with a model player who uses the Hearth, through
 *       Rekindles (tools/lib/progressionCli.ts). Supersedes --rift-ladder for tiers past the cap.
 *   npm run sim -- --list
 */
import {
  createAdventure,
  findScenario,
  hashHex,
  hashState,
  createScenarioGame,
  step,
  scenarios,
  tourInput,
} from '../src/sim';
import { startRoom } from '../data/progression';
import { printReadout, readoutFromArgs } from './lib/readout';
import { parseArgs, requireInt, runCli } from './lib/args';
import { checkReplay, readReplay } from './lib/replay';
import { loadAllRooms, loadRoomText } from './lib/rooms';
import { runPlaytestSavesCli } from './lib/playtestSaves';
import { runCampaignCli, runEncountersCli } from './lib/campaign';
import { runRiftBotCli, runRiftCli, runRiftLadderCli } from './lib/riftCli';
import { riftBuilds, type RiftBuild } from '../src/sim/bots/riftBot';
import { RIFT_TIERS } from '../data/rift';
import { runFenCli } from './lib/fenCli';
import {
  parseSessions,
  PROGRESSION_VARIANTS,
  runProgressionCli,
  type ProgressionVariant,
} from './lib/progressionCli';

runCli(() => {
  const a = parseArgs(process.argv.slice(2), {
    scenario: { kind: 'string', default: 'wander' },
    ticks: { kind: 'number', default: 10000 },
    seed: { kind: 'number', default: 1 },
    replay: { kind: 'string' },
    every: { kind: 'number' },
    json: { kind: 'boolean' },
    list: { kind: 'boolean' },
    weave: { kind: 'string' },
    scene: { kind: 'string', default: 'dummy_pack' },
    seconds: { kind: 'number', default: 10 },
    runs: { kind: 'number', default: 50 },
    spindle: { kind: 'string', default: 'heartwood' },
    capacity: { kind: 'number' },
    adventure: { kind: 'boolean' },
    room: { kind: 'string' },
    god: { kind: 'boolean' },
    campaign: { kind: 'boolean' },
    'no-craft': { kind: 'boolean', help: '--campaign: the bot never spends crafting currency' },
    seeds: { kind: 'number', default: 1 },
    until: { kind: 'string' },
    verbose: { kind: 'boolean' },
    encounters: { kind: 'boolean' },
    level: { kind: 'number' },
    'rune-level': { kind: 'number' },
    rifts: { kind: 'boolean' },
    fen: { kind: 'boolean', help: 'M8: the Fen campaign bot from the Fen start save (--seed reseeds it)' },
    build: {
      kind: 'string',
      help: "--fen: 'save' (the save's character, default) or 'reference' (the boss bot's)",
    },
    'rift-bot': { kind: 'boolean' },
    'rift-ladder': { kind: 'boolean' },
    target: { kind: 'number', default: 8 },
    builds: { kind: 'string' },
    count: {
      kind: 'number',
      help: '--rifts: rifts per tier (default 1000); --rift-bot: runs per tier and build (default 5)',
    },
    tier: { kind: 'number' },
    progression: { kind: 'boolean' },
    'playtest-saves': {
      kind: 'boolean',
      help: 'write data/playtest/after_warden.json, mid_climb.json and fen_start.json (--seed, --tier (default 7), --out dir)',
    },
    rekindles: { kind: 'number', default: 1, help: '--progression: Rekindles to play through' },
    variants: { kind: 'string', help: '--progression: play,offline,nohearth (default play,offline)' },
    sessions: { kind: 'string', default: '1.5,16', help: '--progression: <play hours>,<break hours>' },
    'rekindle-stall': {
      kind: 'number',
      default: 3,
      help: '--progression: Rekindle once unlocked after this many failed rifts in a row (0: only at the cap)',
    },
    'rekindle-after': {
      kind: 'number',
      default: 9,
      help: '--progression: Rekindle once unlocked after this many rifts without a new best tier (0: never)',
    },
    'max-hours': { kind: 'number', default: 40, help: '--progression: stop after this many hours of play' },
    out: { kind: 'string', help: '--progression: folder for the CSV and JSON (default shots/progression)' },
    'no-hearth': { kind: 'boolean', help: '--progression: only the player who never uses the Hearth' },
  });

  if (a.fen) {
    const build = a.build ?? 'save';
    if (build !== 'reference' && build !== 'save') throw new Error('--build: reference or save');
    runFenCli({ seed: requireInt('seed', a.seed, 0), build, json: a.json });
    return;
  }

  if (a['playtest-saves']) {
    runPlaytestSavesCli({
      seed: requireInt('seed', a.seed, 0),
      tier: requireInt('tier', a.tier ?? 7, 1),
      outDir: a.out,
    });
    return;
  }

  if (a.progression) {
    const variants = (
      a['no-hearth'] ? ['nohearth'] : (a.variants?.split(',') ?? ['play', 'offline'])
    ) as ProgressionVariant[];
    const bad = variants.filter((v) => !(PROGRESSION_VARIANTS as readonly string[]).includes(v));
    if (bad.length)
      throw new Error(`Unknown --variants ${bad.join(', ')}. Available: ${PROGRESSION_VARIANTS.join(', ')}`);
    const stall = requireInt('rekindle-stall', a['rekindle-stall'], 0);
    runProgressionCli({
      seed: requireInt('seed', a.seed, 0),
      seeds: requireInt('seeds', a.seeds, 1),
      rekindles: requireInt('rekindles', a.rekindles, 0),
      variants,
      sessions: parseSessions(a.sessions!),
      stallFailures: stall === 0 ? null : stall,
      stallRifts: a['rekindle-after'] === 0 ? null : requireInt('rekindle-after', a['rekindle-after'], 1),
      maxHours: a['max-hours']!,
      outDir: a.out,
      verbose: a.verbose,
      json: a.json,
    });
    return;
  }

  if (a['rift-ladder']) {
    runRiftLadderCli({
      seed: requireInt('seed', a.seed, 0),
      seeds: requireInt('seeds', a.seeds, 1),
      target: requireInt('target', a.target, 1),
      verbose: a.verbose,
      json: a.json,
    });
    return;
  }

  if (a['rift-bot']) {
    const builds = (a.builds?.split(',') ?? [...riftBuilds]) as RiftBuild[];
    const bad = builds.filter((b) => !(riftBuilds as readonly string[]).includes(b));
    if (bad.length)
      throw new Error(`Unknown --builds ${bad.join(', ')}. Available: ${riftBuilds.join(', ')}`);
    runRiftBotCli({
      count: requireInt('count', a.count ?? 5, 1),
      tiers:
        a.tier === undefined
          ? Array.from({ length: RIFT_TIERS }, (_, i) => i + 1)
          : [requireInt('tier', a.tier, 1)],
      builds,
      seed: requireInt('seed', a.seed, 0),
      json: a.json,
    });
    return;
  }

  if (a.rifts) {
    runRiftCli({
      count: requireInt('count', a.count ?? 1000, 1),
      tier: a.tier === undefined ? undefined : requireInt('tier', a.tier, 1),
      seed: requireInt('seed', a.seed, 0),
      json: a.json,
    });
    return;
  }

  if (a.encounters) {
    runEncountersCli({
      seed: requireInt('seed', a.seed, 0),
      seeds: requireInt('seeds', a.seeds, 1),
      room: a.room,
      level: a.level,
      runeLevel: a['rune-level'],
      verbose: a.verbose,
      json: a.json,
    });
    return;
  }

  if (a.campaign) {
    runCampaignCli({
      seed: requireInt('seed', a.seed, 0),
      seeds: requireInt('seeds', a.seeds, 1),
      until: a.until,
      json: a.json,
      verbose: a.verbose,
      craft: !a['no-craft'],
    });
    return;
  }

  if (a.adventure) {
    runAdventure(a);
    return;
  }

  if (a.weave !== undefined) {
    const { input, result } = readoutFromArgs(a);
    if (a.json) console.log(JSON.stringify(result));
    else printReadout(input, result);
    if (!result.ok) process.exitCode = 1;
    return;
  }

  if (a.list) {
    if (a.json)
      console.log(
        JSON.stringify(scenarios.map(({ id, description, roomId }) => ({ id, description, roomId }))),
      );
    else for (const s of scenarios) console.log(`${s.id.padEnd(14)} ${s.roomId.padEnd(16)} ${s.description}`);
    return;
  }

  if (a.replay !== undefined) {
    const r = checkReplay(readReplay(a.replay));
    if (r.file.tuningEdited && !a.json)
      console.warn('warning: tuning was edited during this recording; it may not reproduce.');
    if (a.json) {
      console.log(
        JSON.stringify({
          mode: 'replay',
          match: r.match,
          ticks: r.ticks,
          hash: r.hash,
          expected: r.expected,
          tuningEdited: r.file.tuningEdited,
          roomId: r.file.roomId,
          seed: r.file.seed,
        }),
      );
    } else {
      console.log(`replay=${a.replay} room=${r.file.roomId} seed=${r.file.seed} ticks=${r.ticks}`);
      console.log(`${r.match ? 'MATCH' : 'MISMATCH'}: hash=${r.hash} recorded=${r.expected}`);
    }
    if (!r.match) process.exitCode = 1;
    return;
  }

  const id = a.scenario!;
  const scenario = findScenario(id);
  if (!scenario)
    throw new Error(`Unknown scenario "${id}". Available: ${scenarios.map((s) => s.id).join(', ')}`);
  const ticks = requireInt('ticks', a.ticks, 0);
  const seed = requireInt('seed', a.seed, 0);
  const every = a.every === undefined ? 0 : requireInt('every', a.every, 1);

  const state = createScenarioGame(scenario, loadRoomText(scenario.roomId), { seed });
  const checkpoints: { tick: number; hash: string }[] = [];
  for (let i = 0; i < ticks; i++) {
    step(state, scenario.input(state.tick, state));
    if (every && state.tick % every === 0) {
      const cp = { tick: state.tick, hash: hashHex(hashState(state)) };
      checkpoints.push(cp);
      if (!a.json) console.log(`tick=${cp.tick} hash=${cp.hash}`);
    }
  }
  const hash = hashHex(hashState(state));
  if (a.json) {
    console.log(
      JSON.stringify({
        mode: 'scenario',
        scenario: id,
        seed,
        ticks: state.tick,
        hash,
        player: { x: state.player.x, y: state.player.y },
        ...(every ? { checkpoints } : {}),
      }),
    );
  } else {
    console.log(`scenario=${id} seed=${seed} ticks=${state.tick} hash=${hash}`);
    console.log(`player at (${state.player.x.toFixed(3)}, ${state.player.y.toFixed(3)})`);
  }
});

/** `--adventure`: a tour of the rooms connected to the start room. */
function runAdventure(a: {
  room?: string;
  ticks?: number;
  seed?: number;
  every?: number;
  json: boolean;
  god: boolean;
}): void {
  const rooms = loadAllRooms();
  const roomId = a.room ?? (rooms[startRoom] !== undefined ? startRoom : 'test/world_a');
  const ticks = requireInt('ticks', a.ticks, 0);
  const seed = requireInt('seed', a.seed, 0);
  const every = a.every === undefined ? 0 : requireInt('every', a.every, 1);
  const state = createAdventure({ seed, rooms, startRoomId: roomId });
  state.cheats.god = a.god;
  const visits: { tick: number; room: string }[] = [{ tick: 0, room: state.room.id }];
  const checkpoints: { tick: number; hash: string }[] = [];
  if (!a.json) console.log(`tick=0 room=${state.room.id}`);
  for (let i = 0; i < ticks; i++) {
    step(state, tourInput(state));
    for (const e of state.events) {
      if (e.type !== 'roomEnter') continue;
      visits.push({ tick: state.tick, room: e.id });
      if (!a.json) console.log(`tick=${state.tick} room=${e.id} (${e.arrival})`);
    }
    if (every && state.tick % every === 0) {
      const cp = { tick: state.tick, hash: hashHex(hashState(state)) };
      checkpoints.push(cp);
      if (!a.json) console.log(`tick=${cp.tick} hash=${cp.hash}`);
    }
  }
  const hash = hashHex(hashState(state));
  if (a.json)
    console.log(
      JSON.stringify({
        mode: 'adventure',
        seed,
        ticks: state.tick,
        hash,
        visits,
        world: state.world,
        checkpoints,
      }),
    );
  else console.log(`adventure seed=${seed} ticks=${state.tick} hash=${hash} rooms visited=${visits.length}`);
}
