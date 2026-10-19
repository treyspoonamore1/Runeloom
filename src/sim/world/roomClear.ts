/**
 * Cleared rooms, bosses and repopulation (DESIGN §10, the M4 contract in worldState.ts).
 *
 * - A room is cleared the first moment all its enemies are dead; a room that spawns none is
 *   cleared on entry. A boss room (one whose @spawn names an enemy in data/progression.ts
 *   bossKinds) is cleared when its boss dies, whatever else is still alive, and the boss goes
 *   into WorldState.bossesDefeated.
 * - The first clear pays the room's rewards once per save: `onRoomCleared` (hero/rewards.ts),
 *   then RoomFlags.rewardsPaid.
 * - A cleared room stays empty when re-entered until the player rests at a Loom Stone or dies;
 *   then every room repopulates except boss rooms whose boss is dead.
 */
import { bossKinds } from '../../../data/progression';
import { emit } from '../events';
import { onRoomCleared } from '../hero/rewards';
import type { GameState } from '../state';
import { parseRoom, type RoomHeader } from './room';
import { roomFlags } from './worldState';

/** Boss enemy kinds a room spawns (its @spawn enemy: entries in bossKinds), in file order. */
export function roomBossKinds(header: Pick<RoomHeader, 'spawns'>): string[] {
  const out: string[] = [];
  for (const s of header.spawns)
    if (s.kind === 'enemy' && bossKinds.includes(s.id) && !out.includes(s.id)) out.push(s.id);
  return out;
}

/** A boss room whose bosses are all dead: it never repopulates. */
export function bossRoomDone(state: GameState, header: Pick<RoomHeader, 'spawns'>): boolean {
  const bosses = roomBossKinds(header);
  return bosses.length > 0 && bosses.every((k) => state.world.bossesDefeated.includes(k));
}

/** Marks the current room cleared; the first time ever, pays its rewards. */
export function markRoomCleared(state: GameState): void {
  const id = state.room.id;
  const f = roomFlags(state.world, id);
  if (f.cleared) return;
  f.cleared = true;
  const first = !f.rewardsPaid;
  if (first) {
    onRoomCleared(state, id);
    f.rewardsPaid = true;
  }
  emit(state, { type: 'roomCleared', id, first });
}

/**
 * Leaving through the edge named by `@clear exit <edge>` pays the room's first-clear rewards if
 * they're still owed. The room isn't marked cleared: enemies left behind are there on re-entry.
 */
export function payRewardsOnExit(state: GameState, edge: string): void {
  if (state.room.header.clearOnExit !== edge) return;
  const id = state.room.id;
  const f = roomFlags(state.world, id);
  if (f.rewardsPaid) return;
  onRoomCleared(state, id);
  f.rewardsPaid = true;
}

/** Per tick: records boss deaths and clears the room when its enemies (or its boss) are dead. */
export function stepRoomClear(state: GameState): void {
  const w = state.world;
  for (const e of state.enemies) {
    if (!e.dead || !bossKinds.includes(e.kind) || w.bossesDefeated.includes(e.kind)) continue;
    w.bossesDefeated.push(e.kind);
    emit(state, { type: 'bossDefeated', kind: e.kind, roomId: state.room.id, x: e.x, y: e.y });
  }
  if (roomFlags(w, state.room.id).cleared) return;
  const header = state.room.header;
  if (roomBossKinds(header).length > 0) {
    if (bossRoomDone(state, header)) markRoomCleared(state);
    return;
  }
  for (const e of state.enemies) if (!e.dead) return;
  markRoomCleared(state);
}

/** Rest or death: every room's enemies come back, except in boss rooms whose boss is dead. */
export function repopulateRooms(state: GameState): void {
  for (const [id, f] of Object.entries(state.world.flags)) {
    if (!f.cleared) continue;
    const text = state.rooms[id];
    if (text !== undefined && bossRoomDone(state, parseRoom(text).header)) continue;
    f.cleared = false;
  }
}
