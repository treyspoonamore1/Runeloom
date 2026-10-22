/**
 * A rift's rooms in `state.rooms` (M6): added when it opens or a save inside it loads, dropped
 * with its room flags when it closes. Kept apart from run.ts so room transitions can close a rift
 * without importing the code that opens one.
 */
import { emit } from '../../events';
import type { GameState } from '../../state';
import type { RoomSource } from '../worldState';
import { generateRift } from './generate';
import { riftRoomPrefix, type RiftSpec } from './types';

/** `rooms` with the rift's generated rooms added (templates come from `rooms` itself). */
export function withRiftRooms(rooms: RoomSource, spec: RiftSpec): RoomSource {
  return { ...rooms, ...generateRift(spec, rooms).rooms };
}

/** Adds the open rift's rooms to state.rooms (no-op without a rift). */
export function installRiftRooms(state: GameState): void {
  const r = state.world.rift;
  if (r) state.rooms = withRiftRooms(state.rooms, r.spec);
}

/** Ends the open rift (when it ends: world/rift/run.ts). `died`: the player died in it. */
export function closeRift(state: GameState, died: boolean): void {
  const w = state.world;
  const r = w.rift;
  if (!r) return;
  w.rift = null;
  const prefix = riftRoomPrefix(r.spec.index);
  const rooms: Record<string, string> = {};
  for (const [id, text] of Object.entries(state.rooms)) if (!id.startsWith(prefix)) rooms[id] = text;
  state.rooms = rooms;
  for (const id of Object.keys(w.flags)) if (id.startsWith(prefix)) delete w.flags[id];
  emit(state, {
    type: 'riftClosed',
    tier: r.spec.tier,
    completed: r.bossDead,
    reason: r.bossDead ? 'completed' : died ? 'died' : 'left',
  });
}
