/**
 * Push blocks (`P`) and ice blocks (`I`), DESIGN §10.2 "Push". Walking into a block along one
 * axis for tuning.world.pushTime seconds pushes it one tile if the tile beyond is free; an ice
 * block that ends a move on ice keeps sliding the same way, tile by tile, until the next tile is
 * not free or it leaves the ice. A moving block occupies its new tile at once (its cells become
 * `object`, the old tile's cells get their ground back) and `timer` counts the visual travel.
 *
 * A tile is free when it is inside the room, not an exit, every cell is walkable ground, no other
 * object (a pickup, a Loom Stone) is on it, and no player or enemy body overlaps it. Pressure
 * plates are free: that's the point.
 */
import { MAT } from '../../../data/materials';
import { tileForChar } from '../../../data/tiles';
import { DT, TILE_CELLS } from '../core/constants';
import type { InputFrame } from '../core/input';
import { emit } from '../events';
import type { GameState } from '../state';
import { objectCenter, type WorldObject } from './objects';
import { coverTile, forTileCells, tileChar, uncoverTile } from './objectGround';

const TIME_EPSILON = 1e-9;
/** pushDir codes → tile steps. Index 0 is "none". */
const DIR_X = [0, 1, -1, 0, 0];
const DIR_Y = [0, 0, 0, 1, -1];

export function isBlock(o: WorldObject): boolean {
  return o.kind === 'push_block' || (o.kind === 'ice_block' && !o.on);
}

/** Distance from (x, y) to the rectangle of tile (tx, ty), in cells (0 inside). */
export function distToTile(x: number, y: number, tx: number, ty: number): number {
  const x0 = tx * TILE_CELLS;
  const y0 = ty * TILE_CELLS;
  const dx = x < x0 ? x0 - x : x > x0 + TILE_CELLS ? x - x0 - TILE_CELLS : 0;
  const dy = y < y0 ? y0 - y : y > y0 + TILE_CELLS ? y - y0 - TILE_CELLS : 0;
  return Math.sqrt(dx * dx + dy * dy);
}

/** True when tile (tx, ty) can take a block (see the file comment). */
export function tileFree(state: GameState, tx: number, ty: number, self: WorldObject): boolean {
  const room = state.room;
  if (tx < 0 || ty < 0 || tx >= room.tilesW || ty >= room.tilesH) return false;
  const id = tileForChar(tileChar(room, tx, ty))?.id ?? '';
  if (id.startsWith('exit_')) return false;
  for (const o of state.objects) {
    if (o === self || o.tx !== tx || o.ty !== ty) continue;
    if (o.kind === 'pressure_plate' || (o.kind === 'ice_block' && o.on)) continue;
    if ((o.kind === 'door' || o.kind === 'locked_door' || o.kind === 'big_key_door') && o.on) continue;
    return false;
  }
  let walkable = true;
  forTileCells(state, tx, ty, (i) => {
    if (room.solid[i] === 1) walkable = false;
  });
  if (!walkable) return false;
  const p = state.player;
  if (!p.dead && distToTile(p.x, p.y, tx, ty) < state.tuning.player.radius) return false;
  for (const e of state.enemies) if (!e.dead && distToTile(e.x, e.y, tx, ty) < e.radius) return false;
  return true;
}

/** Every cell of the block's tile was ice before the block covered it. */
function onIce(state: GameState, o: WorldObject): boolean {
  const g = state.grid;
  let ice = true;
  forTileCells(state, o.tx, o.ty, (i) => {
    const u = g.under[i];
    if (u !== MAT.ice && u !== MAT.ice_bridge) ice = false;
  });
  return ice;
}

/** Moves a block one tile along pushDir `dir` if the tile is free. Returns true if it moved. */
function moveBlock(state: GameState, o: WorldObject, dir: number, slide: boolean): boolean {
  const tx = o.tx + DIR_X[dir]!;
  const ty = o.ty + DIR_Y[dir]!;
  if (!tileFree(state, tx, ty, o)) return false;
  const speed = slide ? state.tuning.world.iceSlideSpeed : state.tuning.world.blockMoveSpeed;
  const fromTx = o.tx;
  const fromTy = o.ty;
  uncoverTile(state, fromTx, fromTy);
  o.tx = tx;
  o.ty = ty;
  coverTile(state, tx, ty);
  o.vx = DIR_X[dir]! * speed;
  o.vy = DIR_Y[dir]! * speed;
  o.timer = 1 / speed;
  o.pushDir = dir;
  emit(state, {
    type: 'blockMoved',
    key: o.key,
    kind: o.kind,
    fromTx,
    fromTy,
    tx,
    ty,
    slide,
    seconds: o.timer,
  });
  return true;
}

/** The pushDir the move input points along, or 0 if it isn't firmly along one axis. */
function inputDir(state: GameState, input: InputFrame | undefined): number {
  if (!input) return 0;
  const min = state.tuning.world.pushInputMin;
  const ax = Math.abs(input.moveX);
  const ay = Math.abs(input.moveY);
  if (ax >= ay && ax >= min) return input.moveX > 0 ? 1 : 2;
  if (ay > ax && ay >= min) return input.moveY > 0 ? 3 : 4;
  return 0;
}

/** True when the player is lined up against the block's face on the `dir` side and touching it. */
function pushing(state: GameState, o: WorldObject, dir: number): boolean {
  const p = state.player;
  const r = state.tuning.player.radius;
  const slack = state.tuning.world.touchSlack;
  const x0 = o.tx * TILE_CELLS;
  const y0 = o.ty * TILE_CELLS;
  const dx = DIR_X[dir]!;
  const dy = DIR_Y[dir]!;
  if (dx !== 0) {
    if (p.y < y0 || p.y > y0 + TILE_CELLS) return false;
    const gap = dx > 0 ? x0 - p.x : p.x - (x0 + TILE_CELLS);
    return gap >= 0 && gap <= r + slack;
  }
  if (p.x < x0 || p.x > x0 + TILE_CELLS) return false;
  const gap = dy > 0 ? y0 - p.y : p.y - (y0 + TILE_CELLS);
  return gap >= 0 && gap <= r + slack;
}

export function stepBlocks(state: GameState, input: InputFrame | undefined): void {
  const p = state.player;
  const dir = p.dead || p.dodgeLeft > 0 ? 0 : inputDir(state, input);
  for (const o of state.objects) {
    if (!isBlock(o)) continue;
    if (o.timer > 0) {
      o.timer = o.timer > DT + TIME_EPSILON ? o.timer - DT : 0;
      if (o.timer > 0) continue;
      // Arrived. An ice block on ice slides on; anything else comes to rest.
      if (o.kind === 'ice_block' && onIce(state, o) && moveBlock(state, o, o.pushDir, true)) continue;
      o.vx = o.vy = 0;
      o.pushDir = 0;
      const c = objectCenter(o);
      emit(state, { type: 'blockStopped', key: o.key, x: c.x, y: c.y });
      continue;
    }
    if (dir === 0 || !pushing(state, o, dir)) {
      o.push = 0;
      continue;
    }
    if (o.pushDir !== dir) {
      o.pushDir = dir;
      o.push = 0;
    }
    o.push += DT;
    if (o.push + TIME_EPSILON >= state.tuning.world.pushTime) {
      o.push = 0;
      if (!moveBlock(state, o, dir, false)) o.pushDir = 0;
    }
  }
}
