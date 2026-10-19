import { createGame, spawnEnemy, type Enemy, type GameState, type SimEvent } from '../../../src/sim';
import { loadRoomText } from '../../../tools/lib/rooms';
import { place } from '../actors/helpers';
import { idx, MAT, ofType, paintRect, room, run } from '../terrain/helpers';

export { idx, MAT, ofType, paintRect, place, room, run };

/** A test room from data/rooms (spawns its @spawn enemies unless `spawn` is false). */
export function fromFile(id: string, seed = 1, spawn = true): GameState {
  return createGame({ seed, roomText: loadRoomText(id), spawnRoomEnemies: spawn });
}

/** An open stone room with the AI on and the player at (px, py), `level` the area level. */
export function arena(px = 100, py = 40, level = 1, w = 40, h = 24): GameState {
  const s = room('.', w, h, px, py, level);
  s.cheats.noAI = false;
  return s;
}

export function spawn(s: GameState, kind: string, x: number, y: number): Enemy {
  return spawnEnemy(s, kind, x, y);
}

/** Steps until `pred` holds (at most `max` ticks); returns the events seen and whether it held. */
export function runUntil(
  s: GameState,
  max: number,
  pred: (ev: SimEvent[]) => boolean,
  move: [number, number] = [0, 0],
): { events: SimEvent[]; ok: boolean } {
  const all: SimEvent[] = [];
  for (let i = 0; i < max; i++) {
    const ev = run(s, 1, 0, undefined, move);
    all.push(...ev);
    if (pred(ev)) return { events: all, ok: true };
  }
  return { events: all, ok: false };
}

/** The material code of the cell under (x, y). */
export function groundAt(s: GameState, x: number, y: number): number {
  return s.grid.ground[idx(s, x, y)]!;
}

export function isWaterCode(code: number): boolean {
  return code === MAT.shallow_water || code === MAT.deep_water;
}
