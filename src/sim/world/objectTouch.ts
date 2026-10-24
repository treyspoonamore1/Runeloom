/**
 * What the player (and, for plates, enemies and blocks) touches: pressure plates, key chests,
 * locked and big-key doors, rune shrines, Heart Seeds, Loom Shards and Loom Stones.
 *
 * Touching: a solid object (chest, door, shrine) is touched when the player's body is within
 * tuning.world.touchSlack cells of its tile; a walk-over object (pickup, Loom Stone) when the
 * player's center is within tuning.world.pickupRadius of its tile center, so a Heart Seed out on
 * deep water needs an ice bridge to reach. A plate is pressed while a center is on its tile.
 */
import { addHeartSeed, addLoomShard } from '../hero/pickups';
import { onRoomCleared } from '../hero/rewards';
import { emit } from '../events';
import type { GameState } from '../state';
import { TILE_CELLS } from '../core/constants';
import { objectCenter, type WorldObject } from './objects';
import { distToTile, isBlock } from './objectBlocks';
import { openDoor, sendNote } from './objectGround';
import { dungeonOf, loomStoneId, roomFlags } from './worldState';
import { bossRoomDone, roomBossKinds } from './roomClear';
import { dropChestEmbers } from '../meta/embers';

function inTile(x: number, y: number, o: WorldObject): boolean {
  const x0 = o.tx * TILE_CELLS;
  const y0 = o.ty * TILE_CELLS;
  return x >= x0 && x < x0 + TILE_CELLS && y >= y0 && y < y0 + TILE_CELLS;
}

/** Plates: pressed while the living player's, a living enemy's or a block's center is on them. */
export function stepPlates(state: GameState): void {
  const p = state.player;
  for (const o of state.objects) {
    if (o.kind !== 'pressure_plate') continue;
    let pressed = !p.dead && inTile(p.x, p.y, o);
    if (!pressed) for (const e of state.enemies) if (!e.dead && inTile(e.x, e.y, o)) pressed = true;
    if (!pressed)
      for (const b of state.objects) if (isBlock(b) && b.tx === o.tx && b.ty === o.ty) pressed = true;
    if (pressed === o.on) continue;
    o.on = pressed;
    const c = objectCenter(o);
    emit(state, { type: 'plateChanged', key: o.key, pressed, x: c.x, y: c.y });
    if (pressed) sendNote(state, o);
  }
}

function take(state: GameState, o: WorldObject): void {
  o.on = true;
  const f = roomFlags(state.world, state.room.id);
  if (!f.taken.includes(o.key)) f.taken.push(o.key);
}

/** Activates the Loom Stone and makes it the respawn point. */
export function touchLoomStone(state: GameState, o: WorldObject): void {
  const w = state.world;
  const id = loomStoneId(state.room.id, o.key);
  const first = !w.loomStones.includes(id);
  const isRespawn = w.respawn?.roomId === state.room.id && w.respawn.key === o.key;
  if (!first && isRespawn) return;
  o.on = true;
  if (first) w.loomStones.push(id);
  w.respawn = { roomId: state.room.id, key: o.key };
  const c = objectCenter(o);
  emit(state, { type: 'loomStoneActivated', roomId: state.room.id, key: o.key, first, x: c.x, y: c.y });
  if (first) sendNote(state, o);
}

function touchChest(state: GameState, o: WorldObject): void {
  take(state, o);
  const w = state.world;
  const dungeon = dungeonOf(state.room.id);
  const big = o.kind === 'big_key_chest';
  if (big) {
    if (!w.bigKeys.includes(dungeon)) w.bigKeys.push(dungeon);
  } else w.keys[dungeon] = (w.keys[dungeon] ?? 0) + 1;
  const c = objectCenter(o);
  emit(state, {
    type: 'chestOpened',
    key: o.key,
    kind: o.kind,
    dungeon,
    big,
    count: w.keys[dungeon] ?? 0,
    x: c.x,
    y: c.y,
  });
  dropChestEmbers(state, c.x, c.y); // M7: Embers once the Hearth is lit.
  sendNote(state, o);
}

/**
 * A full rune shrine (`R`): pays the room's guaranteed runes (the dungeon item, CONTENT §9.1) and
 * stays empty for good. A room with a shrine pays nothing on entry or clear (roomClear.ts).
 */
export function touchShrine(state: GameState, o: WorldObject): void {
  if (o.on) return;
  take(state, o);
  const c = objectCenter(o);
  emit(state, { type: 'shrineTaken', key: o.key, x: c.x, y: c.y });
  onRoomCleared(state, state.room.id, { x: c.x, y: c.y, source: 'shrine' });
  sendNote(state, o);
}

function touchKeyDoor(state: GameState, o: WorldObject): void {
  const w = state.world;
  const dungeon = dungeonOf(state.room.id);
  const big = o.kind === 'big_key_door';
  const has = big ? w.bigKeys.includes(dungeon) : (w.keys[dungeon] ?? 0) > 0;
  const c = objectCenter(o);
  if (!has) {
    if (o.push === 0) emit(state, { type: 'doorLocked', key: o.key, kind: o.kind, x: c.x, y: c.y });
    o.push = 1;
    return;
  }
  if (!big) w.keys[dungeon] = w.keys[dungeon]! - 1;
  emit(state, { type: 'keyUsed', dungeon, big, left: w.keys[dungeon] ?? 0, x: c.x, y: c.y });
  o.push = 0;
  openDoor(state, o);
}

function touchPickup(state: GameState, o: WorldObject): void {
  take(state, o);
  const h = state.hero;
  const kind = o.kind === 'heart_seed' ? 'heart_seed' : 'loom_shard';
  if (kind === 'heart_seed') addHeartSeed(state);
  else addLoomShard(state);
  const total = kind === 'heart_seed' ? h.heartSeeds : h.loomShards;
  const c = objectCenter(o);
  emit(state, { type: 'pickup', key: o.key, kind, total, x: c.x, y: c.y });
  sendNote(state, o);
}

/** Chests, key doors, rune shrines, pickups and Loom Stones the living player touches this tick. */
export function stepTouches(state: GameState): void {
  const p = state.player;
  if (p.dead) return;
  const T = state.tuning;
  const reach = T.player.radius + T.world.touchSlack;
  const r2 = T.world.pickupRadius * T.world.pickupRadius;
  for (const o of state.objects) {
    switch (o.kind) {
      case 'key_chest':
      case 'big_key_chest':
        if (!o.on && distToTile(p.x, p.y, o.tx, o.ty) <= reach) touchChest(state, o);
        break;
      case 'rune_shrine':
        if (!o.on && distToTile(p.x, p.y, o.tx, o.ty) <= reach) touchShrine(state, o);
        break;
      case 'locked_door':
      case 'big_key_door':
        if (o.on) break;
        if (distToTile(p.x, p.y, o.tx, o.ty) <= reach) touchKeyDoor(state, o);
        else o.push = 0;
        break;
      case 'heart_seed':
      case 'loom_shard':
      case 'loom_stone': {
        const c = objectCenter(o);
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        if (dx * dx + dy * dy > r2) break;
        if (o.kind === 'loom_stone') {
          // A boss room's Loom Stone sleeps until its boss dies (roomClear.ts wakes it).
          if (!o.on && roomBossKinds(state.room.header).length > 0 && !bossRoomDone(state, state.room.header))
            break;
          touchLoomStone(state, o);
        } else if (!o.on) touchPickup(state, o);
        break;
      }
      default:
        break;
    }
  }
}
