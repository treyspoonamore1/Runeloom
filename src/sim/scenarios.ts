import { kiterInput } from './bots/kiter';
import { Button, type InputFrame } from './core/input';
import type { GameMode, GameState } from './state';

/**
 * Scripted input sources. Used by the headless runner, the determinism tests
 * (Node and browser) and benchmarks. Inputs must be a pure function of the tick
 * and the state, never of wall-clock time.
 */
export interface Scenario {
  id: string;
  description: string;
  roomId: string;
  /** Game mode to create the game in (default 'sandbox'). */
  mode?: GameMode;
  /** Runs once on the fresh game (weaves, cheats), before the first tick. */
  setup?(state: GameState): void;
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

/** Added to a dummy's squared distance so real enemies are targeted first. */
const DUMMY_PENALTY = 1e6;

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
  {
    id: 'combat',
    description:
      'Arena with dummies and enemies: strafes around the nearest one firing bolts, closes in to Strike, dodges.',
    roomId: 'test/arena',
    input(tick, state) {
      const p = state.player;
      const target = nearestEnemy(state);
      const tx = target ? target.x : p.x + 10;
      const ty = target ? target.y : p.y;
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / d;
      const uy = dy / d;
      // Phases of 90 ticks: two of bolts while strafing, one of closing in to Strike.
      const striking = Math.floor(tick / 90) % 3 === 2;
      const side = Math.floor(tick / 150) % 2 === 0 ? 1 : -1;
      const close = striking ? (d > 4 ? 1 : 0) : d < 15 ? -0.5 : 0.2;
      let buttons = striking ? Button.Cast2 : Button.Cast1;
      if (tick % 97 === 0) buttons |= Button.Dodge;
      return {
        moveX: ux * close - uy * side,
        moveY: uy * close + ux * side,
        aimX: tx,
        aimY: ty,
        buttons,
      };
    },
  },
  {
    id: 'arena_bot',
    description:
      'Arena waves against the kiter bot (bots/kiter.ts): kites, Strikes packs, dodges telegraphs.',
    roomId: 'test/arena',
    mode: 'arena',
    input: (_tick, state) => kiterInput(state),
  },
];

/** Nearest live enemy to the player, preferring non-dummies; undefined if none. Ties go to the earlier one. */
function nearestEnemy(state: GameState) {
  const p = state.player;
  let best;
  let bestD = Infinity;
  for (const e of state.enemies) {
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = dx * dx + dy * dy + (e.kind === 'dummy' ? DUMMY_PENALTY : 0);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

export function findScenario(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}
