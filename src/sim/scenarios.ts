import { Button, type InputFrame } from './core/input';
import type { GameState } from './state';

/**
 * Scripted input sources. Used by the headless runner, the determinism tests
 * (Node and browser) and benchmarks. Inputs must be a pure function of the tick
 * and the state, never of wall-clock time.
 */
export interface Scenario {
  id: string;
  description: string;
  roomId: string;
  input(tick: number, state: GameState): InputFrame;
}

// Eight compass directions; avoids trig so inputs are bit-identical everywhere.
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

export const scenarios: Scenario[] = [
  {
    id: 'wander',
    description: 'Walks in changing directions, dodges every 50 ticks, sweeps the aim point.',
    roomId: 'test/m0_room',
    input(tick, state) {
      const [dx, dy] = DIRS[Math.floor(tick / 90) % DIRS.length]!;
      const [ax, ay] = DIRS[Math.floor(tick / 7) % DIRS.length]!;
      return {
        moveX: dx,
        moveY: dy,
        aimX: state.player.x + ax * 20,
        aimY: state.player.y + ay * 20,
        buttons: tick % 50 < 2 ? Button.Dodge : 0,
      };
    },
  },
  {
    id: 'wall_press',
    description: 'Pushes diagonally into walls and corners while dodging, to stress collision.',
    roomId: 'test/m0_room',
    input(tick, state) {
      const [dx, dy] = DIRS[(Math.floor(tick / 240) * 3) % DIRS.length]!;
      return {
        moveX: dx,
        moveY: dy,
        aimX: state.player.x + dx,
        aimY: state.player.y + dy,
        buttons: tick % 23 === 0 ? Button.Dodge : 0,
      };
    },
  },
];

export function findScenario(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}
