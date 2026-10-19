/**
 * A stateless adventure tourist for the sim CLI, benches and determinism tests: it walks to one
 * of the current room's exits and out through it (exits to unvisited rooms first, else changing
 * its pick every `period` ticks), and
 * fires slot 1 (LMB) at the nearest enemy in sight every 20 ticks. A pure function of the tick
 * and the state, so a run is reproducible from the seed alone.
 */
import { TILE_CELLS } from '../core/constants';
import { Button, type InputFrame } from '../core/input';
import type { GameState } from '../state';
import { exitTilesOn, EXIT_CHAR, exitTarget } from '../world/exits';
import { hasLineOfSight } from '../world/los';
import type { Edge } from '../world/worldState';
import { findPath } from './scriptPath';

const EDGES: readonly Edge[] = ['w', 'e', 'n', 's'];
const OUT: Readonly<Record<Edge, readonly [number, number]>> = {
  w: [-1, 0],
  e: [1, 0],
  n: [0, -1],
  s: [0, 1],
};

/** The exits of the current room that lead somewhere, as [edge, tile center x, y]. */
function exits(state: GameState): [Edge, number, number][] {
  const room = state.room;
  const out: [Edge, number, number][] = [];
  for (const e of EDGES) {
    if (!exitTarget(state, e)) continue;
    const tiles = exitTilesOn(room, e);
    if (tiles.length === 0) continue;
    const mid = (tiles[Math.floor(tiles.length / 2)]! + 0.5) * TILE_CELLS;
    const x = e === 'w' ? TILE_CELLS / 2 : e === 'e' ? room.width - TILE_CELLS / 2 : mid;
    const y = e === 'n' ? TILE_CELLS / 2 : e === 's' ? room.height - TILE_CELLS / 2 : mid;
    out.push([e, x, y]);
  }
  return out;
}

export function tourInput(state: GameState, period = 600): InputFrame {
  const p = state.player;
  const t = state.tick;
  let moveX = 0;
  let moveY = 0;
  // Exits to rooms not visited yet first (every other period, so a blocked one isn't forever).
  const all = exits(state);
  const fresh = all.filter(([e]) => !state.world.flags[exitTarget(state, e)!]?.visited);
  const ex = fresh.length > 0 && Math.floor(t / period) % 2 === 0 ? fresh : all;
  if (ex.length > 0) {
    // Offset the pick per room so two rooms don't keep sending the bot back and forth.
    let salt = 0;
    for (let i = 0; i < state.room.id.length; i++) salt += state.room.id.charCodeAt(i) * (i + 1);
    const [edge, gx, gy] = ex[(Math.floor(t / period / 2) + salt) % ex.length]!;
    const tx = Math.floor(p.x / TILE_CELLS);
    const ty = Math.floor(p.y / TILE_CELLS);
    const onExit = state.room.tiles[ty * state.room.tilesW + tx] === EXIT_CHAR[edge].charCodeAt(0);
    if (onExit) [moveX, moveY] = OUT[edge];
    else {
      const path = findPath(state.room, p.x, p.y, gx, gy) ?? [];
      const to = path[0] ?? { x: gx, y: gy };
      const dx = to.x - p.x;
      const dy = to.y - p.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 1e-9) {
        moveX = dx / len;
        moveY = dy / len;
      }
    }
  }
  let aimX = p.x + p.faceX * 8;
  let aimY = p.y + p.faceY * 8;
  let best = Number.POSITIVE_INFINITY;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
    if (d < best && hasLineOfSight(state.room, p.x, p.y, e.x, e.y)) {
      best = d;
      aimX = e.x;
      aimY = e.y;
    }
  }
  const fire = best < Number.POSITIVE_INFINITY && t % 20 < 10;
  return { moveX, moveY, aimX, aimY, buttons: fire ? Button.Cast1 : 0 };
}
