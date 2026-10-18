/**
 * Performance benchmarks against DESIGN §12.
 * SCAFFOLD: times the player-only sim. The M0 tooling task expands this.
 */
import { performance } from 'node:perf_hooks';
import { findScenario, createGame, step } from '../src/sim';
import { loadRoomText } from './lib/rooms';

const scenario = findScenario('wander')!;
const state = createGame({ seed: 1, roomText: loadRoomText(scenario.roomId) });
const ticks = 20000;
const t0 = performance.now();
for (let i = 0; i < ticks; i++) step(state, scenario.input(state.tick, state));
const ms = (performance.now() - t0) / ticks;
console.log(`entity step: ${ms.toFixed(4)} ms/tick (budget 2.7 ms)`);
