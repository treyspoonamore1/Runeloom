/**
 * Room transitions (M4): exits, Loom Stone fast travel and respawn. Anything that wants to change
 * rooms sets `state.world.pending` during a step; `processTransition` applies it at the very end
 * of the step, after the grid, so a room never changes halfway through a tick.
 *
 * CONTRACT (M4), owned by the world/puzzles agent: `enterRoom` rebuilds the room-scoped state
 * (room, grid, flow, enemies, projectiles, spells, casts, objects, loot, lab, enemyHash) from
 * `state.rooms`, places the player per the Arrival, keeps hero, world, weaves and RNG streams,
 * and sends a 'roomEnter' event.
 */
import type { GameState } from '../state';

/** Applies a pending transition, if any. Stub until the world agent lands. */
export function processTransition(state: GameState): void {
  if (state.world.pending) state.world.pending = null;
}
