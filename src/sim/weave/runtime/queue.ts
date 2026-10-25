/**
 * Hooks other systems call when something happens that an event trigger may fire on (CONTENT
 * §1.1). Entries wait in `state.triggerQueue` (hashed) until the next trigger phase
 * (triggers.ts), so the order of systems inside a step never changes what fires.
 */
import type { TriggerEvent } from '../../../../data/runes';
import type { GameState } from '../../state';
import { listensFor } from './loadout';

function push(
  state: GameState,
  event: TriggerEvent,
  targetId: number,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  amount: number,
): void {
  if (!listensFor(state, event)) return;
  state.triggerQueue.push({ event, targetId, x, y, dirX, dirY, amount });
}

/** The player started a dodge at (x, y) along unit (dirX, dirY). */
export function noteDodge(state: GameState, x: number, y: number, dirX: number, dirY: number): void {
  push(state, 'dodge_start', -1, x, y, dirX, dirY, 0);
}

/** The player's damage (a hit or their Ignite) killed enemy `id` at (x, y). */
export function noteKill(state: GameState, id: number, x: number, y: number): void {
  push(state, 'kill', id, x, y, 0, 0, 0);
}

/**
 * The player shattered enemy `id` at (x, y): their damage (a hit or their Ignite) killed it while
 * it was Frozen (rule 20). Credited exactly like noteKill; the Shatter trigger listens for it.
 */
export function noteShatter(state: GameState, id: number, x: number, y: number): void {
  push(state, 'shatter', id, x, y, 0, 0, 0);
}

/** A player hit crit enemy `id` at (x, y), travelling along unit (dirX, dirY). */
export function noteCrit(
  state: GameState,
  id: number,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
): void {
  push(state, 'crit', id, x, y, dirX, dirY, 0);
}

/** One hit dealt `fraction` of the player's max life. */
export function noteHurt(state: GameState, fraction: number): void {
  const p = state.player;
  push(state, 'hurt', -1, p.x, p.y, 0, 0, fraction);
}
