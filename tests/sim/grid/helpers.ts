import {
  applyElement,
  createGame,
  PLAYER_ID,
  setGround,
  stepGrid,
  type ElementApplication,
  type Footprint,
  type GameState,
  type SimEvent,
} from '../../../src/sim';
import { MAT, OWNER, type MaterialId } from '../../../data/materials';

/** A game whose room is the given tile rows (each character is 4×4 cells). */
export function gridGame(rows: string[], seed = 1, level = 1): GameState {
  return createGame({
    seed,
    roomText: `@id test/grid\n@level ${level}\n${rows.join('\n')}\n`,
    spawnRoomEnemies: false,
  });
}

/** `w`×`h` tiles of one tile character. */
export function field(ch: string, w: number, h: number, seed = 1): GameState {
  return gridGame(
    Array.from({ length: h }, () => ch.repeat(w)),
    seed,
  );
}

export function idx(s: GameState, x: number, y: number): number {
  return y * s.grid.width + x;
}

/** Sets one cell's material (through setGround, so the walk masks follow). */
export function paint(s: GameState, x: number, y: number, mat: MaterialId): void {
  setGround(s, idx(s, x, y), MAT[mat]);
}

export function circle(x: number, y: number, r: number): Footprint {
  return { kind: 'circle', x, y, r };
}

/** A footprint covering exactly cell (x, y). */
export function cellShape(x: number, y: number): Footprint {
  return circle(x + 0.5, y + 0.5, 0.1);
}

/** Applies an element as the player (hitDamage 10, durationMult 1 unless overridden). */
export function hit(
  s: GameState,
  element: ElementApplication['element'],
  shape: Footprint,
  extra: Partial<ElementApplication> = {},
): SimEvent[] {
  s.events.length = 0;
  applyElement(s, {
    element,
    shape,
    owner: OWNER.player,
    sourceId: PLAYER_ID,
    hitDamage: 10,
    durationMult: 1,
    ...extra,
  });
  return [...s.events];
}

/** Runs `n` grid ticks directly (no entity step) and returns every event they sent. */
export function gridTicks(s: GameState, n: number): SimEvent[] {
  const all: SimEvent[] = [];
  for (let k = 0; k < n; k++) {
    s.events.length = 0;
    stepGrid(s);
    all.push(...s.events);
  }
  return all;
}

export function ofType<T extends SimEvent['type']>(events: SimEvent[], type: T) {
  return events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
}

/** Number of cells with `pred` true. */
export function countCells(s: GameState, pred: (i: number) => boolean): number {
  let n = 0;
  for (let i = 0; i < s.grid.ground.length; i++) if (pred(i)) n++;
  return n;
}

export { MAT, OWNER };
