import { Button, spawnEnemy, step, type Enemy, type GameState, type SimEvent } from '../../../src/sim';
import { openRoom, place } from '../actors/helpers';

export { place };

/** Open 40×30-tile room (interior cells 4..156 × 4..116), player at (80, 60) aiming +x. */
export function arena(): GameState {
  const state = openRoom(40, 30);
  place(state, 80, 60);
  return state;
}

/** Spawns an enemy that faces `facing` (default -x, toward a player on its left). */
export function addEnemy(
  state: GameState,
  kind: string,
  x: number,
  y: number,
  facing: [number, number] = [-1, 0],
  areaLevel?: number,
): Enemy {
  return spawnEnemy(state, kind, x, y, { facingX: facing[0], facingY: facing[1], areaLevel });
}

/** One step with the player standing still, aiming at (ax, ay), holding `buttons`. */
export function tick(state: GameState, buttons = 0, aim?: [number, number], move: [number, number] = [0, 0]) {
  const p = state.player;
  step(state, {
    moveX: move[0],
    moveY: move[1],
    aimX: aim?.[0] ?? p.x + 10,
    aimY: aim?.[1] ?? p.y,
    buttons,
  });
  return state.events;
}

/** Steps `n` ticks and returns every event emitted, in order. */
export function ticks(
  state: GameState,
  n: number,
  buttons = 0,
  aim?: [number, number],
  move: [number, number] = [0, 0],
): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < n; i++) all.push(...tick(state, buttons, aim, move));
  return all;
}

export function ofType<T extends SimEvent['type']>(events: SimEvent[], type: T) {
  return events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
}

export const BOLT = Button.Cast1;
export const STRIKE = Button.Cast2;
