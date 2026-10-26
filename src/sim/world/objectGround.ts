/**
 * Objects on the chemistry grid: what is under an object tile, and rewriting a tile's cells when
 * a door opens or a block moves. Every write goes through setGround, which keeps room.solid and
 * room.shotSolid in sync and bumps grid.walkVersion so the AI flow field rebuilds (M3 contract).
 */
import { MAT, materialByCode, type MaterialCode } from '../../../data/materials';
import { tileGround } from '../../../data/tileGround';
import { tileForChar } from '../../../data/tiles';
import { TILE_CELLS } from '../core/constants';
import { emit } from '../events';
import { setGround } from '../grid/cells';
import type { GameState } from '../state';
import type { Room } from './room';
import { OBJECT_CHAR, objectCenter, type WorldObject } from './objects';
import { roomFlags } from './worldState';
import { noteText } from './riftTierLink';

const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** The tile character at (tx, ty), or '' outside the room. */
export function tileChar(room: Room, tx: number, ty: number): string {
  if (tx < 0 || ty < 0 || tx >= room.tilesW || ty >= room.tilesH) return '';
  return String.fromCharCode(room.tiles[ty * room.tilesW + tx]!);
}

/**
 * The floor an object tile stands on, for an opened door or a block's starting tile: the most
 * common WALKABLE ground among its 4 neighbor tiles (markers and walls don't count), ties and
 * no candidates going to stone. Unlike the marker rule (CONTENT §6.1) walls are skipped, so a
 * door set in a wall opens onto floor.
 */
export function floorBeneath(room: Room, tx: number, ty: number): MaterialCode {
  const counts = new Map<MaterialCode, number>();
  for (const [dx, dy] of NEIGHBORS) {
    const def = tileForChar(tileChar(room, tx + dx, ty + dy));
    if (!def) continue;
    const spec = tileGround[def.id as keyof typeof tileGround];
    if (spec === 'neighbor') continue;
    const code = MAT[spec.ground];
    if (!materialByCode[code]!.walk) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  let best: MaterialCode = MAT.stone;
  let bestCount = 0;
  let tied = false;
  for (const [code, c] of counts) {
    if (c > bestCount) {
      best = code;
      bestCount = c;
      tied = false;
    } else if (c === bestCount) tied = true;
  }
  return tied ? MAT.stone : best;
}

/** Calls fn with every cell index of tile (tx, ty). */
export function forTileCells(state: GameState, tx: number, ty: number, fn: (i: number) => void): void {
  const w = state.grid.width;
  for (let cy = 0; cy < TILE_CELLS; cy++) {
    const row = (ty * TILE_CELLS + cy) * w + tx * TILE_CELLS;
    for (let cx = 0; cx < TILE_CELLS; cx++) fn(row + cx);
  }
}

/** Sets every cell of a tile to `code` (and `under` when given), putting out any fire on it. */
export function setTileGround(state: GameState, tx: number, ty: number, code: number, under?: number): void {
  const g = state.grid;
  forTileCells(state, tx, ty, (i) => {
    g.fire[i] = 0;
    g.fuel[i] = 0;
    setGround(state, i, code);
    if (under !== undefined) g.under[i] = under;
  });
  g.version++;
}

/**
 * A block covers a tile: its cells become `object`, remembering their ground in `under`. A
 * borrowed cell (M8) keeps its borrowed origin in `under` and its timer running; the borrowed
 * ground it hides goes into `cover`, so it can still return to `under` under the block (rule 27).
 */
export function coverTile(state: GameState, tx: number, ty: number): void {
  const g = state.grid;
  forTileCells(state, tx, ty, (i) => {
    g.fire[i] = 0;
    g.fuel[i] = 0;
    if (g.ground[i] === MAT.object) return;
    if (g.borrowed[i] === 1) {
      g.cover[i] = g.ground[i]! + 1;
      const t = g.timer[i]!;
      setGround(state, i, MAT.object);
      g.timer[i] = t;
      return;
    }
    g.under[i] = g.ground[i]!;
    setGround(state, i, MAT.object);
  });
  g.version++;
}

/** A block leaves a tile: its cells go back to the ground they had (`under`, or the borrowed `cover`). */
export function uncoverTile(state: GameState, tx: number, ty: number): void {
  const g = state.grid;
  forTileCells(state, tx, ty, (i) => {
    if (g.cover[i]! > 0) {
      const code = g.cover[i]! - 1;
      const t = g.timer[i]!;
      g.cover[i] = 0;
      setGround(state, i, code);
      g.timer[i] = t;
      return;
    }
    setGround(state, i, g.under[i]!);
  });
  g.version++;
}

/** Sends the room's `@note` for this object's character, if it has one. */
export function sendNote(state: GameState, o: WorldObject): void {
  const ch = OBJECT_CHAR[o.kind];
  const c = objectCenter(o);
  for (const n of state.room.header.notes) {
    const text = n.char === ch ? noteText(state, n.text) : null;
    if (text !== null) emit(state, { type: 'note', key: o.key, text, x: c.x, y: c.y });
  }
}

/** Opens a door for good: walkable floor, remembered in RoomFlags.opened, 'doorOpened' and its note. */
export function openDoor(state: GameState, o: WorldObject): void {
  if (o.on) return;
  o.on = true;
  const floor = floorBeneath(state.room, o.tx, o.ty);
  setTileGround(state, o.tx, o.ty, floor, floor);
  const f = roomFlags(state.world, state.room.id);
  if (!f.opened.includes(o.key)) f.opened.push(o.key);
  const c = objectCenter(o);
  emit(state, { type: 'doorOpened', key: o.key, kind: o.kind, link: o.link, x: c.x, y: c.y });
  sendNote(state, o);
}
