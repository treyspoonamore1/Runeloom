/**
 * How M4 kinds move over the grid (data/enemyTypes.ts Locomotion):
 * - 'walk' (default): room.solid blocks (moveCircle on the room).
 * - 'float' (Frost Wisp): only shot-blocking cells block, so it crosses water, pits and bramble;
 *   moveCircle runs on a view of the room whose `solid` mask is room.shotSolid.
 * - 'swim' (Bog Lurker): only water cells are open; it moves only to points whose cell is water
 *   (sliding along one axis when the straight move would leave it), never with moveCircle.
 * - 'fixed' (Brood Kiln): never moves.
 * Floating and fixed kinds ignore the ground (no Wet, Oiled, burning ground, charge or falls);
 * swimmers read the ground but never fall (actors/terrain.ts).
 */
import { enemyDef, type EnemyKind } from '../../../data/enemies';
import type { Locomotion } from '../../../data/enemyTypes';
import { materialByCode } from '../../../data/materials';
import type { GameState } from '../state';
import type { Room } from '../world/room';
import type { CircleBody } from './collision';

export function locomotionOf(kind: EnemyKind): Locomotion {
  return enemyDef(kind).locomotion ?? 'walk';
}

/** True if the kind ignores the ground under it (floats or is fixed in place). */
export function ignoresGround(kind: EnemyKind): boolean {
  const l = locomotionOf(kind);
  return l === 'float' || l === 'fixed';
}

/** True if the cell under (x, y) is water (shallow, deep or oily). Outside the grid: false. */
export function isWaterAt(state: GameState, x: number, y: number): boolean {
  const g = state.grid;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= g.width || cy >= g.height) return false;
  return materialByCode[g.ground[cy * g.width + cx]!]!.water !== null;
}

// One floating view per room: the same arrays, with shotSolid standing in for solid. The masks
// are edited in place when terrain changes, so the view stays current.
const floatViews = new WeakMap<Room, Room>();

/** The room as a floating body sees it (walls and objects block; water, pits, bramble don't). */
export function floatRoom(room: Room): Room {
  let v = floatViews.get(room);
  if (!v) {
    v = { ...room, solid: room.shotSolid };
    floatViews.set(room, v);
  }
  return v;
}

/** The room a kind's collision runs against (moveCircle, knockback). */
export function movementRoom(state: GameState, kind: EnemyKind): Room {
  return locomotionOf(kind) === 'float' ? floatRoom(state.room) : state.room;
}

/**
 * Moves a swimmer by (dx, dy) cells, staying on water: the straight move if its end is on
 * water, else the longer axis-only move that is, else the other one, else none. Moves of at
 * most a cell per call (callers move once per tick). Clears the velocity along a blocked axis.
 */
export function swimMove(state: GameState, body: CircleBody, dx: number, dy: number): void {
  if (isWaterAt(state, body.x + dx, body.y + dy)) {
    body.x += dx;
    body.y += dy;
    return;
  }
  const xFirst = (dx < 0 ? -dx : dx) >= (dy < 0 ? -dy : dy);
  for (let k = 0; k < 2; k++) {
    const alongX = xFirst === (k === 0);
    const mx = alongX ? dx : 0;
    const my = alongX ? 0 : dy;
    if ((mx !== 0 || my !== 0) && isWaterAt(state, body.x + mx, body.y + my)) {
      body.x += mx;
      body.y += my;
      if (alongX) body.vy = 0;
      else body.vx = 0;
      return;
    }
  }
  body.vx = body.vy = 0;
}
