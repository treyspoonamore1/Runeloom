import {
  applyHit,
  Button,
  makePacket,
  PLAYER_ID,
  spawnEnemy,
  step,
  type Enemy,
  type GameState,
  type SimEvent,
} from '../../../src/sim';
import type { DamageType } from '../../../data/combatTypes';
import { openRoom, place } from '../actors/helpers';

export { place };

/**
 * Open 40×30-tile room (interior cells 4..156 × 4..116), player at (80, 60) aiming +x.
 * Enemy AI is frozen (cheats.noAI) unless `ai` is true, so tests can drive enemies by hand.
 */
export function arena(ai = false): GameState {
  const state = openRoom(40, 30);
  place(state, 80, 60);
  state.cheats.noAI = !ai;
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

/**
 * Hits `target` with `amount` of one damage type (no crit, no knockback unless given), from the
 * player by default. `ailmentDuration` sets DamagePacket.ailmentDuration (Lingering).
 */
export function hitWith(
  state: GameState,
  target: Enemy | GameState['player'],
  amount: number,
  type: DamageType,
  opts: { sourceId?: number; ailmentDuration?: number; knockback?: number } = {},
) {
  const packet = makePacket(amount, { [type]: 1 }, 0, 1.5);
  if (opts.ailmentDuration !== undefined) packet.ailmentDuration = opts.ailmentDuration;
  return applyHit(state, target, packet, {
    sourceId: opts.sourceId ?? PLAYER_ID,
    dirX: 1,
    dirY: 0,
    knockback: opts.knockback ?? 0,
  });
}

/** Ticks that a duration of `seconds` covers at 60 Hz. */
export const ticksFor = (seconds: number): number => Math.round(seconds * 60);
