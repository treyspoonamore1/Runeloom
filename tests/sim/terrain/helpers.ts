import {
  applyElement,
  applyLoadoutSpec,
  createGame,
  PLAYER_ID,
  setGround,
  spawnEnemy,
  step,
  type ElementApplication,
  type Enemy,
  type Footprint,
  type GameState,
  type SimEvent,
} from '../../../src/sim';
import { MAT, OWNER, SURFACE, type MaterialId } from '../../../data/materials';
import { place } from '../actors/helpers';

export { MAT, OWNER, SURFACE, place };

/**
 * A walled room `w`×`h` tiles whose interior is `fill` (a tile character), player at (px, py),
 * enemy AI off. Interior cells span [4, 4w − 4) × [4, 4h − 4).
 */
export function room(fill: string, w = 30, h = 20, px = 20, py = 40, level = 1): GameState {
  const rows = [
    '#'.repeat(w),
    ...Array.from({ length: h - 2 }, () => `#${fill.repeat(w - 2)}#`),
    '#'.repeat(w),
  ];
  const state = createGame({
    seed: 1,
    roomText: `@id test/terrain\n@level ${level}\n${rows.join('\n')}\n`,
    spawnRoomEnemies: false,
  });
  place(state, px, py);
  state.cheats.noAI = true;
  return state;
}

/** A game from inline tile rows (AI off; the player at (px, py)). */
export function rowsRoom(rows: string[], px: number, py: number): GameState {
  const state = createGame({
    seed: 1,
    roomText: `@id test/terrain\n${rows.join('\n')}\n`,
    spawnRoomEnemies: false,
  });
  place(state, px, py);
  state.cheats.noAI = true;
  return state;
}

/** Puts `notations` in slots 0–3 on the 99-Capacity test spindle. */
export function weaves(state: GameState, notations: string[]): void {
  applyLoadoutSpec(state, { spindleId: 'test_spindle', capacity: 99, notations });
  for (let i = 0; i < notations.length; i++)
    if (!state.weaves.slots[i]!.program) throw new Error(`weave ${i}: ${state.weaves.slots[i]!.error}`);
}

export function idx(s: GameState, x: number, y: number): number {
  return Math.floor(y) * s.grid.width + Math.floor(x);
}

/** Sets the material of every cell in the inclusive rectangle (walk masks follow). */
export function paintRect(
  s: GameState,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  mat: MaterialId,
): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setGround(s, idx(s, x, y), MAT[mat]);
}

export function oilRect(s: GameState, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) s.grid.surface[idx(s, x, y)] = SURFACE.oil;
}

export function apply(
  s: GameState,
  element: ElementApplication['element'],
  shape: Footprint,
  extra: Partial<ElementApplication> = {},
): void {
  applyElement(s, {
    element,
    shape,
    owner: OWNER.player,
    sourceId: PLAYER_ID,
    hitDamage: 0,
    durationMult: 1,
    ...extra,
  });
}

export function dummy(s: GameState, x: number, y: number): Enemy {
  return spawnEnemy(s, 'dummy', x, y);
}

/** Steps `n` ticks moving along `move`, aiming at `aim` (default: just right of the player) with `buttons` held; returns every event. */
export function run(
  s: GameState,
  n: number,
  buttons = 0,
  aim?: [number, number],
  move: [number, number] = [0, 0],
): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    const p = s.player;
    step(s, { moveX: move[0], moveY: move[1], aimX: aim?.[0] ?? p.x + 1, aimY: aim?.[1] ?? p.y, buttons });
    all.push(...s.events);
  }
  return all;
}

export function ofType<T extends SimEvent['type']>(events: SimEvent[], type: T) {
  return events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
}

/** Cells in the inclusive rectangle for which `pred` holds. */
export function count(
  s: GameState,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  pred: (i: number) => boolean,
): number {
  let n = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (pred(idx(s, x, y))) n++;
  return n;
}

/** Cells whose centers are within r of (x, y) for which `pred` holds, and how many there are. */
export function inCircle(
  s: GameState,
  x: number,
  y: number,
  r: number,
  pred: (i: number) => boolean,
): [number, number] {
  let hit = 0;
  let all = 0;
  for (let cy = Math.floor(y - r); cy <= Math.ceil(y + r); cy++)
    for (let cx = Math.floor(x - r); cx <= Math.ceil(x + r); cx++) {
      const dx = cx + 0.5 - x;
      const dy = cy + 0.5 - y;
      if (dx * dx + dy * dy > r * r) continue;
      all++;
      if (pred(idx(s, cx, cy))) hit++;
    }
  return [hit, all];
}

export const burning = (s: GameState) => (i: number) => s.grid.fire[i]! > 0;
