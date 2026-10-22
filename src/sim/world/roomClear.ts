/**
 * Cleared rooms, bosses and repopulation (DESIGN §10, the M4 contract in worldState.ts).
 *
 * - A room is cleared the first moment all its enemies are dead; a room that spawns none is
 *   cleared on entry. A boss room (one whose @spawn names an enemy in data/progression.ts
 *   bossKinds) is cleared when its boss dies, whatever else is still alive, and the boss goes
 *   into WorldState.bossesDefeated (a rift boss: WorldState.rift.bossDead).
 * - The first clear pays the room's rewards once per save: `onRoomCleared` (hero/rewards.ts),
 *   then RoomFlags.rewardsPaid. A room with a rune shrine (`R`) pays them only when the player
 *   touches the shrine (objectTouch.ts), so neither its clear nor `@clear exit` pays them.
 * - A cleared room stays empty when re-entered until the player rests at a Loom Stone or dies;
 *   then every room repopulates except boss rooms whose boss is dead.
 */
import { bossKinds, riftBossKinds } from '../../../data/progression';
import { emit } from '../events';
import { onRoomCleared } from '../hero/rewards';
import { onBossDefeated, onRiftRoomCleared } from './rift/rewards';
import { isRiftRoomId } from './rift/types';
import type { GameState } from '../state';
import { parseRoom, type RoomHeader } from './room';
import { roomFlags, type WorldState } from './worldState';

/** The current room pays its guaranteed runes at a rune shrine (`R`), not on clear. */
export function paysAtShrine(state: GameState): boolean {
  return state.objects.some((o) => o.kind === 'rune_shrine');
}

/** Boss enemy kinds a room spawns (its @spawn enemy: entries in bossKinds), in file order. */
export function roomBossKinds(header: Pick<RoomHeader, 'spawns'>): string[] {
  const out: string[] = [];
  for (const s of header.spawns)
    if (s.kind === 'enemy' && bossKinds.includes(s.id) && !out.includes(s.id)) out.push(s.id);
  return out;
}

/** True once boss `kind` is dead: for good (region bosses), or in the open rift (rift bosses). */
export function bossDead(world: WorldState, kind: string): boolean {
  if (riftBossKinds.includes(kind)) return world.rift?.bossDead === true;
  return world.bossesDefeated.includes(kind);
}

/** A boss room whose bosses are all dead: it never repopulates. */
export function bossRoomDone(state: GameState, header: Pick<RoomHeader, 'spawns'>): boolean {
  const bosses = roomBossKinds(header);
  return bosses.length > 0 && bosses.every((k) => bossDead(state.world, k));
}

/**
 * Marks the current room cleared; the first time ever, pays its rewards (unless a rune shrine
 * holds them). `boss`: the boss whose death cleared it, where the reward moment happens.
 */
export function markRoomCleared(state: GameState, boss?: { x: number; y: number }): void {
  const id = state.room.id;
  const f = roomFlags(state.world, id);
  if (f.cleared) return;
  f.cleared = true;
  if (isRiftRoomId(id)) onRiftRoomCleared(state);
  const first = !f.rewardsPaid && !paysAtShrine(state);
  if (first) {
    onRoomCleared(state, id, boss ? { x: boss.x, y: boss.y, source: 'boss' } : undefined);
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
  if (f.rewardsPaid || paysAtShrine(state)) return;
  onRoomCleared(state, id);
  f.rewardsPaid = true;
}

/** Per tick: records boss deaths and clears the room when its enemies (or its boss) are dead. */
export function stepRoomClear(state: GameState): void {
  const w = state.world;
  let boss: { x: number; y: number } | undefined;
  for (const e of state.enemies) {
    if (!e.dead || !bossKinds.includes(e.kind) || bossDead(w, e.kind)) continue;
    if (riftBossKinds.includes(e.kind)) {
      if (!w.rift) continue; // A rift boss spawned outside a rift (dev console) is just an enemy.
      w.rift.bossDead = true;
    } else w.bossesDefeated.push(e.kind);
    boss = { x: e.x, y: e.y };
    emit(state, { type: 'bossDefeated', kind: e.kind, roomId: state.room.id, x: e.x, y: e.y });
    onBossDefeated(state, e.kind, e.x, e.y);
  }
  if (roomFlags(w, state.room.id).cleared) return;
  const header = state.room.header;
  if (roomBossKinds(header).length > 0) {
    if (bossRoomDone(state, header)) markRoomCleared(state, boss);
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
