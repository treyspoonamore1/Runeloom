/**
 * Room transitions (M4): exits, Loom Stone fast travel and respawn. Anything that wants to change
 * rooms sets `state.world.pending` during a step; `processTransition` applies it at the very end
 * of the step, after the grid, so a room never changes halfway through a tick.
 *
 * CONTRACT (M4), owned by the world/puzzles agent: `enterRoom` rebuilds the room-scoped state
 * (room, grid, flow, enemies, projectiles, spells, casts, objects, loot, lab, enemyHash) from
 * `state.rooms`, places the player per the Arrival, keeps hero, world, weaves and RNG streams,
 * and sends a 'roomEnter' event.
 *
 * What enterRoom does, in order: collects the loot left on the floor; cancels an unreleased
 * cast; rebuilds the room, grid (terrain resets), flow field, Chemistry Lab state and spatial
 * hash and empties enemies, projectiles, spells, casts, Echo repeats and the trigger queue;
 * marks the room visited; builds its objects from RoomFlags; places the player; spawns its
 * enemies unless it is cleared (or a boss room whose boss is dead); sends 'roomEnter'; and
 * clears a room that has no enemies at all. Player life, mana, ailments, Wet and Oiled carry
 * over; the rest of the player's terrain memory starts fresh with the new grid.
 */
import { collectRoomLoot } from '../items/loot';
import { SPATIAL_BUCKET_CELLS } from '../core/constants';
import { SpatialHash } from '../core/spatialHash';
import { createFlowField } from '../ai/flowField';
import { spawnRoomEnemies } from '../actors/enemies';
import { resetTerrainState } from '../actors/terrainState';
import { emit } from '../events';
import { createGrid } from '../grid/grid';
import type { GameState } from '../state';
import { cancelCast } from '../weave/runtime/castState';
import { createLabState } from './lab';
import { buildRoom, parseRoom } from './room';
import { buildObjects, objectCenter } from './objects';
import { arrivalPoint, OPPOSITE } from './exits';
import { bossRoomDone, markRoomCleared, repopulateRooms, payRewardsOnExit } from './roomClear';
import { startRoom } from '../../../data/progression';
import { roomFlags, type Arrival } from './worldState';

/** Applies a pending transition, if any: repopulates first for a respawn or rest. */
export function processTransition(state: GameState): void {
  const pending = state.world.pending;
  if (!pending) return;
  state.world.pending = null;
  const reason = pending.reason ?? 'exit';
  if (reason === 'exit' && pending.arrival.kind === 'edge') payRewardsOnExit(state, pending.arrival.from);
  if (reason === 'respawn' || reason === 'rest') repopulateRooms(state);
  enterRoom(state, pending.roomId, pending.arrival);
}

/** Rebuilds the world around the player in room `roomId` (see the file comment). */
export function enterRoom(state: GameState, roomId: string, arrival: Arrival): void {
  const text = state.rooms[roomId];
  if (text === undefined) throw new Error(`enterRoom: unknown room "${roomId}"`);
  // Loot still on the floor goes to the hero when the player leaves the room (M4 contract).
  collectRoomLoot(state);
  cancelCast(state);
  const p = state.player;
  const old = state.room;
  const alongX = old.width > 0 ? p.x / old.width : 0.5;
  const alongY = old.height > 0 ? p.y / old.height : 0.5;

  const room = buildRoom(parseRoom(text));
  state.room = room;
  state.grid = createGrid(room);
  state.flow = createFlowField(room);
  state.lab = createLabState();
  state.enemyHash = new SpatialHash(room.width, room.height, SPATIAL_BUCKET_CELLS);
  state.enemies = [];
  state.projectiles = [];
  state.spells = [];
  state.casts = [];
  state.pendingSpells = [];
  state.triggerQueue = [];
  state.arena.queue = [];
  state.hitstopLeft = 0;

  const w = state.world;
  w.roomId = room.id;
  const flags = roomFlags(w, room.id);
  const firstVisit = !flags.visited;
  flags.visited = true;
  state.objects = buildObjects(state);

  placePlayer(state, arrival, alongX, alongY);

  if (!flags.cleared && bossRoomDone(state, room.header)) flags.cleared = true;
  if (!flags.cleared) spawnRoomEnemies(state);
  state.enemyHash.rebuild(state.enemies);
  emit(state, {
    type: 'roomEnter',
    id: room.id,
    name: room.name,
    level: room.level,
    arrival: arrival.kind,
    firstVisit,
  });
  if (!flags.cleared && state.enemies.length === 0) markRoomCleared(state);
}

/** Puts the player where the Arrival says, at rest. */
function placePlayer(state: GameState, arrival: Arrival, alongX: number, alongY: number): void {
  const room = state.room;
  const p = state.player;
  const radius = state.tuning.player.radius;
  let x = room.spawnX;
  let y = room.spawnY;
  let faceX = p.faceX;
  let faceY = p.faceY;
  if (arrival.kind === 'edge') {
    const edge = OPPOSITE[arrival.from];
    const along = edge === 'w' || edge === 'e' ? alongY : alongX;
    const at = arrivalPoint(room, edge, along, radius);
    if (at) {
      x = at.x;
      y = at.y;
      // Facing into the room, away from the exit just used.
      faceX = edge === 'w' ? 1 : edge === 'e' ? -1 : 0;
      faceY = edge === 'n' ? 1 : edge === 's' ? -1 : 0;
    }
  } else if (arrival.kind === 'loomStone') {
    const stone = state.objects.find((o) => o.kind === 'loom_stone' && o.key === arrival.key);
    if (stone) ({ x, y } = objectCenter(stone));
  }
  p.x = p.prevX = x;
  p.y = p.prevY = y;
  p.vx = p.vy = 0;
  p.kbX = p.kbY = 0;
  p.dodgeLeft = 0;
  p.faceX = faceX;
  p.faceY = faceY;
  const wet = p.terrain.wetLeft;
  const oiled = p.terrain.oiledLeft;
  resetTerrainState(p.terrain, x, y);
  p.terrain.wetLeft = wet;
  p.terrain.oiledLeft = oiled;
}

/** Called on respawn in adventure mode: back to the respawn Loom Stone, rooms repopulated. */
export function requestRespawn(state: GameState): void {
  const r = state.world.respawn;
  state.world.pending =
    r && state.rooms[r.roomId] !== undefined
      ? { roomId: r.roomId, arrival: { kind: 'loomStone', key: r.key }, reason: 'respawn' }
      : { roomId: startRoomOf(state), arrival: { kind: 'default' }, reason: 'respawn' };
}

/** The start room, or the current room when the region's start room isn't loaded (test worlds). */
function startRoomOf(state: GameState): string {
  return state.rooms[startRoom] !== undefined ? startRoom : state.room.id;
}
