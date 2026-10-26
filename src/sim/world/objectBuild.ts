/**
 * Building a room's objects from its tiles, @link headers and RoomFlags (objects.ts). Runs on
 * every room entry, right after the grid is rebuilt from the file (so terrain is fresh), and
 * applies what the room remembers: open doors are floor again, looted chests stay open, taken
 * pickups stay gone, emptied rune shrines stay empty, activated Loom Stones stay lit, and the braziers and switches of an opened
 * door start lit or powered.
 */
import type { GameState } from '../state';
import { OBJECT_KIND_BY_CHAR, type ObjectKind, type WorldObject } from './objects';
import { conditionKinds, isSwitch, parseLinkCondition } from './objectLinks';
import { floorBeneath, forTileCells, setTileGround, tileChar } from './objectGround';
import { loomStoneId, roomFlags } from './worldState';

const DOORS: readonly ObjectKind[] = ['door', 'locked_door', 'big_key_door'];
const TAKEN: readonly ObjectKind[] = [
  'key_chest',
  'big_key_chest',
  'heart_seed',
  'loom_shard',
  'rune_shrine',
  'loot_chest',
];

/**
 * The door character a puzzle object of `kind` at (tx, ty) feeds through a @link, or ''. When
 * several door characters have a link watching the kind (M8: F8's two switch doors), the object
 * belongs to the nearest door tile among them (squared tile distance; ties to the first in file
 * order), so each door counts only its own switches.
 */
function linkFor(state: GameState, kind: ObjectKind, tx: number, ty: number): string {
  const doors: string[] = [];
  for (const l of state.room.header.links) {
    const c = parseLinkCondition(l.condition);
    if (c && conditionKinds(c).includes(kind) && !doors.includes(l.door)) doors.push(l.door);
  }
  if (doors.length <= 1) return doors[0] ?? '';
  const room = state.room;
  let best = doors[0]!;
  let bestD = Number.POSITIVE_INFINITY;
  for (const door of doors)
    for (let y = 0; y < room.tilesH; y++)
      for (let x = 0; x < room.tilesW; x++) {
        if (tileChar(room, x, y) !== door) continue;
        const d = (x - tx) * (x - tx) + (y - ty) * (y - ty);
        if (d < bestD) {
          bestD = d;
          best = door;
        }
      }
  return best;
}

export function buildRoomObjects(state: GameState): WorldObject[] {
  const room = state.room;
  const flags = roomFlags(state.world, room.id);
  const out: WorldObject[] = [];
  for (let ty = 0; ty < room.tilesH; ty++) {
    for (let tx = 0; tx < room.tilesW; tx++) {
      const ch = tileChar(room, tx, ty);
      const kind = OBJECT_KIND_BY_CHAR[ch];
      if (!kind) continue;
      const key = `${kind}@${tx},${ty}`;
      const link =
        kind === 'door' ? (room.header.links.some((l) => l.door === ch) ? ch : '') : linkFor(state, kind, tx, ty);
      const o: WorldObject = {
        key,
        kind,
        tx,
        ty,
        on: false,
        timer: 0,
        vx: 0,
        vy: 0,
        link,
        push: 0,
        pushDir: 0,
      };
      if (DOORS.includes(kind)) o.on = flags.opened.includes(key);
      else if (TAKEN.includes(kind)) o.on = flags.taken.includes(key);
      else if (kind === 'loom_stone') o.on = state.world.loomStones.includes(loomStoneId(room.id, key));
      out.push(o);
    }
  }
  // The group that opened a door stays done: its braziers lit, its switches powered, its vanes spun.
  for (const o of out) {
    if (o.link === '' || (o.kind !== 'brazier' && !isSwitch(o.kind) && o.kind !== 'wind_vane')) continue;
    if (flags.opened.some((k) => out.some((d) => d.key === k && d.kind === 'door' && d.link === o.link)))
      o.on = true;
  }
  for (const o of out) placeOnGrid(state, o);
  return out;
}

/** Writes an object's starting cells: open doors become floor; blocks remember the floor under them. */
function placeOnGrid(state: GameState, o: WorldObject): void {
  if (DOORS.includes(o.kind) && o.on) {
    const floor = floorBeneath(state.room, o.tx, o.ty);
    setTileGround(state, o.tx, o.ty, floor, floor);
  } else if (o.kind === 'push_block' || o.kind === 'ice_block') {
    const floor = floorBeneath(state.room, o.tx, o.ty);
    const g = state.grid;
    forTileCells(state, o.tx, o.ty, (i) => {
      g.under[i] = floor;
    });
  }
}
