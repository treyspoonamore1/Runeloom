/**
 * Edge exits (CONTENT §6.1 `<` `>` `^` `v` in the edge column or row, plus `@exit <edge> <room>`).
 * The player leaves by walking onto an exit tile and on against the room edge: when their center
 * is within radius + tuning.world.exitSlack of the edge, on an exit tile of that edge, while
 * facing out, the transition is requested (WorldState.pending) and applied at the end of the step.
 * They arrive just inside the target room's opposite edge, centered on its exit tiles there
 * (when that edge has several separate openings, on the one nearest to where they left).
 */
import { TILE_CELLS } from '../core/constants';
import type { GameState } from '../state';
import type { Room } from './room';
import { tileChar } from './objectGround';
import type { Edge } from './worldState';

export const EXIT_CHAR: Readonly<Record<Edge, string>> = { w: '<', e: '>', n: '^', s: 'v' };
export const OPPOSITE: Readonly<Record<Edge, Edge>> = { w: 'e', e: 'w', n: 's', s: 'n' };
/** Unit vector pointing out of the room through each edge. */
const OUT: Readonly<Record<Edge, readonly [number, number]>> = {
  w: [-1, 0],
  e: [1, 0],
  n: [0, -1],
  s: [0, 1],
};
/** Facing this much along the outward direction (cosine) counts as heading out. */
const FACING_OUT = 0.5;

/** The edge an exit character opens onto, or null. */
export function exitEdge(ch: string): Edge | null {
  for (const e of ['w', 'e', 'n', 's'] as const) if (EXIT_CHAR[e] === ch) return e;
  return null;
}

/** Tile positions along `edge` (y for w/e, x for n/s) whose edge tile is that edge's exit char. */
export function exitTilesOn(room: Room, edge: Edge): number[] {
  const out: number[] = [];
  const ch = EXIT_CHAR[edge];
  if (edge === 'w' || edge === 'e') {
    const tx = edge === 'w' ? 0 : room.tilesW - 1;
    for (let ty = 0; ty < room.tilesH; ty++) if (tileChar(room, tx, ty) === ch) out.push(ty);
  } else {
    const ty = edge === 'n' ? 0 : room.tilesH - 1;
    for (let tx = 0; tx < room.tilesW; tx++) if (tileChar(room, tx, ty) === ch) out.push(tx);
  }
  return out;
}

/** Runs of consecutive tile positions: [first, last] pairs. */
function runs(tiles: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const t of tiles) {
    const last = out[out.length - 1];
    if (last && t === last[1] + 1) last[1] = t;
    else out.push([t, t]);
  }
  return out;
}

/**
 * Where a player arriving through `edge` stands: the center of the exit run on that edge nearest
 * to `along` (0–1 along the edge), TILE_CELLS − radius cells in from the edge so they don't
 * trigger the exit again. Null when the edge has no exit tiles.
 */
export function arrivalPoint(
  room: Room,
  edge: Edge,
  along: number,
  radius: number,
): { x: number; y: number } | null {
  const rs = runs(exitTilesOn(room, edge));
  if (rs.length === 0) return null;
  const span = edge === 'w' || edge === 'e' ? room.tilesH : room.tilesW;
  let best = rs[0]!;
  let bestD = Number.POSITIVE_INFINITY;
  for (const r of rs) {
    const d = Math.abs((r[0] + r[1] + 1) / 2 / span - along);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  const mid = ((best[0] + best[1] + 1) / 2) * TILE_CELLS;
  const depth = TILE_CELLS - radius;
  switch (edge) {
    case 'w':
      return { x: depth, y: mid };
    case 'e':
      return { x: room.width - depth, y: mid };
    case 'n':
      return { x: mid, y: depth };
    case 's':
      return { x: mid, y: room.height - depth };
  }
}

/** The room the edge's @exit leads to, if it exists in state.rooms. */
export function exitTarget(state: GameState, edge: Edge): string | null {
  const ex = state.room.header.exits.find((e) => e.dir === edge);
  if (!ex || state.rooms[ex.room] === undefined) return null;
  return ex.room;
}

/** Requests the transition when the player is leaving through an exit (see the file comment). */
export function stepExits(state: GameState): void {
  const p = state.player;
  if (p.dead || state.world.pending) return;
  const room = state.room;
  const tx = Math.floor(p.x / TILE_CELLS);
  const ty = Math.floor(p.y / TILE_CELLS);
  const edge = exitEdge(tileChar(room, tx, ty));
  if (!edge) return;
  const near = state.tuning.player.radius + state.tuning.world.exitSlack;
  const dist = edge === 'w' ? p.x : edge === 'e' ? room.width - p.x : edge === 'n' ? p.y : room.height - p.y;
  if (dist > near) return;
  const [ox, oy] = OUT[edge];
  if (p.faceX * ox + p.faceY * oy < FACING_OUT) return;
  const target = exitTarget(state, edge);
  if (!target) return;
  state.world.pending = { roomId: target, arrival: { kind: 'edge', from: edge }, reason: 'exit' };
}
