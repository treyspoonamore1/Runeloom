import { createScenarioGame, findScenario, step, type InputFrame } from '../../src/sim';
import { loadRoomText } from './rooms';

/**
 * Input frames a scenario produces over `ticks` ticks from `seed`. Scenario inputs may depend on state, so
 * this runs the sim; the browser's state is identical (determinism), so the same frames drive the page.
 */
export function scenarioFrames(scenarioId: string, seed: number, ticks: number): InputFrame[] {
  const sc = findScenario(scenarioId);
  if (!sc) throw new Error(`Unknown scenario "${scenarioId}"`);
  const state = createScenarioGame(sc, loadRoomText(sc.roomId), { seed });
  const frames: InputFrame[] = [];
  for (let i = 0; i < ticks; i++) {
    const f = sc.input(state.tick, state);
    frames.push(f);
    step(state, f);
  }
  return frames;
}
