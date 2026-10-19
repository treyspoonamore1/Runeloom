/**
 * Puzzle objects and pickups in the current room (CONTENT §6.1, DESIGN §10.2): braziers, push and
 * ice blocks, conduit switches, pressure plates, doors, locked and big-key doors, key chests,
 * Heart Seeds, Loom Shards and Loom Stones. Lives in `GameState.objects`, hashed, rebuilt on room
 * entry from the room file plus RoomFlags.
 *
 * CONTRACT (M4), owned by the world/puzzles agent. The renderer and UI read objects; only
 * stepObjects (and the room loader) write them. Crates, barricades, oil barrels and burnable
 * bramble stay grid materials (M3), not objects. The Brood Kiln is an enemy (CONTENT §5).
 */
import type { Hasher } from '../core/hash';
import type { GameState } from '../state';

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
  | 'loom_stone';

export interface WorldObject {
  /** Stable within a room file: `${kind}@${tx},${ty}` of its tile in the file. RoomFlags use it. */
  key: string;
  kind: ObjectKind;
  /** Current tile (push and ice blocks move; everything else stays at its file tile). */
  tx: number;
  ty: number;
  /**
   * Generic on/off: a brazier is lit, a plate is pressed, a switch is powered, a door is open, a
   * chest is opened, a pickup is taken, a Loom Stone is active.
   */
  on: boolean;
  /** Seconds left on a timed state (a timed brazier group, a block mid-slide), else 0. */
  timer: number;
  /** Motion for sliding and pushed blocks, tiles per second; 0 when still. */
  vx: number;
  vy: number;
  /** The `@link` door character this object belongs to, '' when none. */
  link: string;
}

/** Builds the room's objects from its file and flags. Stub until the world agent lands. */
export function buildObjects(state: GameState): WorldObject[] {
  void state;
  return [];
}

/** Advances objects one tick: conditions, doors, pushes, pickups, Loom Stones. Stub. */
export function stepObjects(state: GameState): void {
  void state;
}

export function hashObjects(h: Hasher, objects: readonly WorldObject[]): void {
  h.u32(objects.length);
  for (const o of objects) {
    h.string(o.key).byte(0).u32(o.tx).u32(o.ty).bool(o.on).num(o.timer).num(o.vx).num(o.vy);
    h.string(o.link).byte(0);
  }
}
