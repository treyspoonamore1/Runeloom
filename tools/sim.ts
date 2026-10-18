/**
 * Headless runner.
 *   npm run sim -- --scenario wander --ticks 10000 --seed 1
 * SCAFFOLD: scenario mode only. The M0 tooling task adds --replay and more output.
 */
import { findScenario, hashHex, runScenario, scenarios } from '../src/sim';
import { loadRoomText } from './lib/rooms';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const id = arg('scenario', 'wander')!;
const scenario = findScenario(id);
if (!scenario) {
  console.error(`Unknown scenario "${id}". Available: ${scenarios.map((s) => s.id).join(', ')}`);
  process.exit(1);
}
const ticks = Number(arg('ticks', '10000'));
const seed = Number(arg('seed', '1'));
const { state, hash } = runScenario(scenario, loadRoomText(scenario.roomId), { seed, ticks });
console.log(`scenario=${id} seed=${seed} ticks=${state.tick} hash=${hashHex(hash)}`);
console.log(`player at (${state.player.x.toFixed(3)}, ${state.player.y.toFixed(3)})`);
