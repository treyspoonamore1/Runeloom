/**
 * Adventure mode (M4): a new game or a loaded save in the region's rooms, death and respawn at a
 * Loom Stone, resting and fast travel.
 *
 * - createAdventure: the game starts in WorldState.roomId (a save) or data/progression.ts
 *   startRoom (a new game), at the respawn Loom Stone when the save has one there, else at the
 *   room's first Loom Stone (else its center). A save made in a boss room whose boss lives
 *   (K5, K10: no Loom Stone) loads at the respawn Loom Stone instead.
 * - Death: respawnPlayer (actors/playerVitals.ts) restores life and mana and calls
 *   requestRespawn, which sends the player to WorldState.respawn (or the start room) at the end
 *   of the step and repopulates every room.
 * - Rest (HeroEdit 'rest'): at a Loom Stone, full life and mana; every room repopulates and the
 *   current room is entered again at that stone (its enemies come back, terrain resets).
 * - Travel (HeroEdit 'travel'): from a Loom Stone to any activated one; rooms keep their state.
 */
import { newGame, startRoom } from '../../../data/progression';
import type { Tuning } from '../../../data/tuning';
import { resetPlayerVitals } from '../actors/playerVitals';
import { emit } from '../events';
import { newGameHero, setupNewGameWeaves } from '../hero/newGame';
import type { HeroState } from '../hero/types';
import { createGame, type GameState } from '../state';
import type { LoadoutSpec } from '../weave/runtime/loadout';
import { objectCenter, type WorldObject } from './objects';
import { bossDead, repopulateRooms, roomBossKinds } from './roomClear';
import { withRiftRooms } from './rift/rooms';
import { isRiftRoomId, riftRoomPrefix } from './rift/types';
import { parseRoom } from './room';
import { enterRoom } from './transition';
export { requestRespawn } from './transition';
import { createWorldState, loomStoneId, type Arrival, type RoomSource, type WorldState } from './worldState';

export interface AdventureOptions {
  seed: number;
  /** Every room text by id (the app: Vite ?raw; tools: tools/lib/rooms.ts loadAllRooms). */
  rooms: RoomSource;
  /** The character from a save; default the new-game hero (hero/newGame.ts). */
  hero?: HeroState;
  /** Region progress from a save; default a fresh world in the start room. */
  world?: WorldState;
  tuning?: Tuning;
  /** Start here instead of data/progression.ts startRoom (dev scenes and tests). Ignored with `world`. */
  startRoomId?: string;
  /** Starting weaves and spindle; default the new-game weaves for a new hero, none for a saved one. */
  loadout?: LoadoutSpec;
}

/**
 * A new game (no `hero`): the hero agent's newGameHero with its weaves (setupNewGameWeaves),
 * unless `loadout` is given. A save (`hero`, `world`; through save.ts loadSave): the weaves start
 * empty and restoreSave applies the saved ones.
 */
export function createAdventure(opts: AdventureOptions): GameState {
  const world = opts.world ?? createWorldState(opts.startRoomId ?? startRoom);
  const r = world.respawn;
  // A save made in a rift (M6) rebuilds its rooms; one that names a rift room without an open
  // rift (or the other way round) loads at the respawn Loom Stone, out of any rift.
  let rooms = opts.rooms;
  if (world.rift && isRiftRoomId(world.roomId)) rooms = withRiftRooms(rooms, world.rift.spec);
  else {
    world.rift = null;
    if (isRiftRoomId(world.roomId) && r) world.roomId = r.roomId;
  }
  // A save made in a boss room whose boss still lives (autosave on entering K5 or K10, which
  // have no Loom Stone) loads at the respawn Loom Stone instead of beside the boss; in a rift's
  // boss arena, at the rift's entry.
  const saved = rooms[world.roomId];
  if (opts.world && saved !== undefined && r && rooms[r.roomId] !== undefined) {
    const header = parseRoom(saved).header;
    if (roomBossKinds(header).some((k) => !bossDead(world, k)))
      world.roomId = world.rift ? `${riftRoomPrefix(world.rift.spec.index)}entry` : r.roomId;
  }
  const roomId = world.roomId;
  if (rooms[roomId] === undefined) throw new Error(`createAdventure: no room "${roomId}"`);
  const fresh = opts.hero === undefined;
  const state = createGame({
    seed: opts.seed,
    rooms,
    roomId,
    hero: opts.hero ?? newGameHero(),
    world,
    tuning: opts.tuning,
    mode: 'adventure',
    spawnRoomEnemies: false,
    loadout: opts.loadout ?? { spindleId: newGame.spindle, notations: [] },
  });
  if (fresh && !opts.loadout) setupNewGameWeaves(state);
  const arrival: Arrival = r && r.roomId === roomId ? { kind: 'loomStone', key: r.key } : { kind: 'default' };
  enterRoom(state, roomId, arrival);
  return state;
}

/** The activated Loom Stone the living player stands at (within tuning.world.loomStoneRange), or null. */
export function loomStoneHere(state: GameState): WorldObject | null {
  const p = state.player;
  if (state.mode !== 'adventure' || p.dead) return null;
  const r = state.tuning.world.loomStoneRange;
  for (const o of state.objects) {
    if (o.kind !== 'loom_stone' || !o.on) continue;
    const c = objectCenter(o);
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    if (dx * dx + dy * dy <= r * r) return o;
  }
  return null;
}

/** HeroEdit 'rest'. Returns why it can't, or null when done. */
export function restAtLoomStone(state: GameState): string | null {
  const stone = loomStoneHere(state);
  if (!stone) return 'rest: not at an activated Loom Stone';
  resetPlayerVitals(state.player, state.tuning, state.heroMods);
  repopulateRooms(state);
  state.world.respawn = { roomId: state.room.id, key: stone.key };
  enterRoom(state, state.room.id, { kind: 'loomStone', key: stone.key });
  emit(state, { type: 'rested', roomId: state.room.id, key: stone.key });
  return null;
}

/** HeroEdit 'travel' to the activated Loom Stone `key` in `roomId`. Returns why it can't, or null. */
export function travelToLoomStone(state: GameState, roomId: string, key: string): string | null {
  if (!loomStoneHere(state)) return 'travel: not at an activated Loom Stone';
  if (!state.world.loomStones.includes(loomStoneId(roomId, key)))
    return `travel: ${loomStoneId(roomId, key)} is not an activated Loom Stone`;
  if (state.rooms[roomId] === undefined) return `travel: unknown room "${roomId}"`;
  state.world.respawn = { roomId, key };
  enterRoom(state, roomId, { kind: 'loomStone', key });
  return null;
}
