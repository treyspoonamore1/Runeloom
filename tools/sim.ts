/**
 * Headless runner.
 *   npm run sim -- --scenario wander --ticks 10000 --seed 1 [--every 1000] [--json]
 *   npm run sim -- --replay replays/foo.json
 *   npm run sim -- --list
 */
import { findScenario, hashHex, hashState, createGame, step, scenarios } from '../src/sim';
import { parseArgs, requireInt, runCli } from './lib/args';
import { checkReplay, readReplay } from './lib/replay';
import { loadRoomText } from './lib/rooms';

runCli(() => {
  const a = parseArgs(process.argv.slice(2), {
    scenario: { kind: 'string', default: 'wander' },
    ticks: { kind: 'number', default: 10000 },
    seed: { kind: 'number', default: 1 },
    replay: { kind: 'string' },
    every: { kind: 'number' },
    json: { kind: 'boolean' },
    list: { kind: 'boolean' },
  });

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

  const state = createGame({ seed, roomText: loadRoomText(scenario.roomId) });
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
