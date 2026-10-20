/**
 * Puzzle objects and pickups in the current room (CONTENT §6.1, DESIGN §10.2): braziers, push and
 * ice blocks, conduit switches, pressure plates, doors, locked and big-key doors, key chests,
 * Heart Seeds, Loom Shards and Loom Stones. Lives in `GameState.objects`, hashed, rebuilt on room
 * entry from the room file plus RoomFlags.
 *
 * CONTRACT (M4), owned by the world/puzzles agent. The renderer and UI read objects; only
 * stepObjects (and the room loader) write them. Crates, barricades, oil barrels and burnable
 * bramble stay grid materials (M3), not objects. The Brood Kiln is an enemy (CONTENT §5).
 *
 * Objects exist only in 'adventure' mode: sandbox, arena and lab games get none, so their rooms
 * play exactly as in M3.
 *
 * How each kind works (see the files named):
 * - brazier (`B`, objectHits.ts): a metal grid cell (conducts Storm, M3) that Fire lights. In a
 *   `timer:N:braziers:all` room each one goes out N s after it was lit unless the group finished.
 * - push_block (`P`) / ice_block (`I`) (objectBlocks.ts): walking into one for tuning.world.pushTime
 *   pushes it one tile if the tile beyond is free; an ice block keeps sliding while it is on ice.
 *   Fire melts an ice block into shallow water (`on` = melted).
 * - conduit_switch (`S`, objectHits.ts, objectLinks.ts): powered (and latched) by a Storm hit on
 *   it, or by charge on any cell touching its tile (charged metal or water next to it).
 * - pressure_plate (`T`): pressed while the player's, an enemy's or a block's center is on it.
 * - door (`D`, objectLinks.ts): opens for good when its `@link` conditions all hold.
 * - locked_door (`K`) / big_key_door (`G`) (objectTouch.ts): open on touch with a small key (used
 *   up) or the big key of the room's dungeon.
 * - key_chest (`k`) / big_key_chest (`g`): open on touch; give a small key or the big key.
 * - heart_seed (`H`) / loom_shard (`L`): taken on touch; +1 hero.heartSeeds / loomShards.
 * - loom_stone (`x`): activates on touch and becomes the respawn point.
 * - rune_shrine (`R`, objectTouch.ts): an altar holding the room's dungeon item. Touching it pays
 *   the room's guaranteed runes (data/progression.ts) instead of the first clear doing it; it
 *   pays once (RoomFlags.taken and rewardsPaid) and is empty afterwards (`on` = taken).
 * Blocking kinds (blocks, closed doors, chests, shrines, braziers, switches) are solid grid cells
 * (material `object` or `brazier`); opening a door or moving a block rewrites its cells with
 * setGround, which keeps room.solid in sync and bumps grid.walkVersion for the flow field.
 */
import type { Hasher } from '../core/hash';
import type { InputFrame } from '../core/input';
import { TILE_CELLS } from '../core/constants';
import type { GameState } from '../state';
import { buildRoomObjects } from './objectBuild';
import { stepObjectSystems } from './objectStep';

export type ObjectKind =
  | 'brazier'
  | 'push_block'
  | 'ice_block'
  | 'conduit_switch'
  | 'pressure_plate'
  | 'door'
  | 'locked_door'
  | 'big_key_door'
  | 'key_chest'
  | 'big_key_chest'
  | 'heart_seed'
  | 'loom_shard'
  | 'loom_stone'
  | 'rune_shrine';

export interface WorldObject {
  /** Stable within a room file: `${kind}@${tx},${ty}` of its tile in the file. RoomFlags use it. */
  key: string;
  kind: ObjectKind;
  /**
   * Current tile (push and ice blocks move; everything else stays at its file tile). A moving
   * block already occupies its new tile; draw it at (tx − vx × timer, ty − vy × timer).
   */
  tx: number;
  ty: number;
  /**
   * Generic on/off: a brazier is lit, a plate is pressed, a switch is powered, a door is open, a
   * chest is opened, a pickup is taken, a shrine is emptied, a Loom Stone is active, an ice block
   * has melted.
   */
  on: boolean;
  /**
   * Seconds left on a timed state: a lit brazier in a timed group, or a block still travelling
   * to its tile (vx, vy say from where). Else 0.
   */
  timer: number;
  /** Motion for sliding and pushed blocks, tiles per second; 0 when still. */
  vx: number;
  vy: number;
  /** The `@link` door character this object belongs to, '' when none. */
  link: string;
  /**
   * Blocks: seconds the player has been pushing it along `pushDir`. Locked and big-key doors: 1
   * while the player touches it without the key (so 'doorLocked' is sent once per touch). Else 0.
   */
  push: number;
  /** Blocks: direction being pushed or slid, 0 none, 1 +x, 2 −x, 3 +y, 4 −y. */
  pushDir: number;
}

/** Object kind of each room legend character. */
export const OBJECT_KIND_BY_CHAR: Readonly<Record<string, ObjectKind>> = {
  B: 'brazier',
  P: 'push_block',
  I: 'ice_block',
  S: 'conduit_switch',
  T: 'pressure_plate',
  D: 'door',
  K: 'locked_door',
  G: 'big_key_door',
  k: 'key_chest',
  g: 'big_key_chest',
  H: 'heart_seed',
  L: 'loom_shard',
  x: 'loom_stone',
  R: 'rune_shrine',
};

/** The legend character of an object kind (the inverse of OBJECT_KIND_BY_CHAR). */
export const OBJECT_CHAR = Object.fromEntries(
  Object.entries(OBJECT_KIND_BY_CHAR).map(([c, k]) => [k, c]),
) as Readonly<Record<ObjectKind, string>>;

/** Builds the room's objects from its file and flags (adventure mode only; [] otherwise). */
export function buildObjects(state: GameState): WorldObject[] {
  if (state.mode !== 'adventure') return [];
  return buildRoomObjects(state);
}

/**
 * Advances objects one tick: room cleared and boss checks, Storm on switches, brazier timers,
 * plates, block pushes and slides, touches (chests, keys, pickups, Loom Stones), door links and
 * edge exits. Adventure mode only. `input` is this tick's input (block pushing reads the move).
 */
export function stepObjects(state: GameState, input?: InputFrame): void {
  if (state.mode !== 'adventure') return;
  stepObjectSystems(state, input);
}

/** The object on tile (tx, ty), skipping melted ice blocks, or undefined. */
export function objectAt(state: GameState, tx: number, ty: number): WorldObject | undefined {
  for (const o of state.objects)
    if (o.tx === tx && o.ty === ty && !(o.kind === 'ice_block' && o.on)) return o;
  return undefined;
}

/** Tile center of an object, in cells. */
export function objectCenter(o: WorldObject): { x: number; y: number } {
  return { x: (o.tx + 0.5) * TILE_CELLS, y: (o.ty + 0.5) * TILE_CELLS };
}

export function hashObjects(h: Hasher, objects: readonly WorldObject[]): void {
  h.u32(objects.length);
  for (const o of objects) {
    h.string(o.key).byte(0).u32(o.tx).u32(o.ty).bool(o.on).num(o.timer).num(o.vx).num(o.vy);
    h.string(o.link).byte(0).num(o.push).u32(o.pushDir);
  }
}
