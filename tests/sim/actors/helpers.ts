import {
  Button,
  createGame,
  isSolidCell,
  step,
  type GameState,
  type InputFrame,
  type Room,
} from '../../../src/sim';
import { cloneTuning, type Tuning } from '../../../data/tuning';

/** Builds a game from inline tile rows (each character is a 4×4-cell tile). */
export function gameFromRows(rows: string[], tuning?: Partial<Tuning['player']>): GameState {
  const t = cloneTuning();
  Object.assign(t.player, tuning);
  return createGame({ seed: 1, roomText: `@id test/inline\n${rows.join('\n')}\n`, tuning: t });
}

/** An open room `w`×`h` tiles with a one-tile wall border. Interior cells span [4, 4w-4]. */
export function openRoom(w: number, h: number, tuning?: Partial<Tuning['player']>): GameState {
  const rows = [
    '#'.repeat(w),
    ...Array.from({ length: h - 2 }, () => `#${'.'.repeat(w - 2)}#`),
    '#'.repeat(w),
  ];
  return gameFromRows(rows, tuning);
}

export function place(state: GameState, x: number, y: number): void {
  const p = state.player;
  p.x = p.prevX = x;
  p.y = p.prevY = y;
  p.vx = p.vy = 0;
}

export function input(moveX: number, moveY: number, buttons = 0, aim?: [number, number]): InputFrame {
  return { moveX, moveY, aimX: aim?.[0] ?? 0, aimY: aim?.[1] ?? 0, buttons };
}

/** Input that aims `dx, dy` away from the player's current position. */
export function aimRel(state: GameState, moveX: number, moveY: number, dx: number, dy: number, buttons = 0) {
  return input(moveX, moveY, buttons, [state.player.x + dx, state.player.y + dy]);
}

/** Steps `n` ticks; `each` runs after every step. */
export function run(
  state: GameState,
  n: number,
  frame: (tick: number) => InputFrame,
  each?: (tick: number) => void,
): void {
  for (let i = 0; i < n; i++) {
    step(state, frame(i));
    each?.(i);
  }
}

/** Presses Dodge on even ticks and releases it on odd ones, so every other tick is a fresh press. */
export function mashDodge(tick: number): number {
  return tick % 2 === 0 ? Button.Dodge : 0;
}

export const SPEED = (state: GameState): number => Math.hypot(state.player.vx, state.player.vy);

/**
 * Independent overlap oracle (does not use the collision module): deepest
 * penetration of a circle into any solid cell, 0 if clear.
 */
export function penetration(room: Room, x: number, y: number, r: number): number {
  let worst = 0;
  for (let cy = Math.floor(y - r) - 1; cy <= Math.floor(y + r) + 1; cy++) {
    for (let cx = Math.floor(x - r) - 1; cx <= Math.floor(x + r) + 1; cx++) {
      if (!isSolidCell(room, cx, cy)) continue;
      const qx = Math.min(Math.max(x, cx), cx + 1);
      const qy = Math.min(Math.max(y, cy), cy + 1);
      const d = Math.hypot(x - qx, y - qy);
      const inside = x > cx && x < cx + 1 && y > cy && y < cy + 1;
      worst = Math.max(worst, inside ? r + 1 : r - d);
    }
  }
  return worst;
}

/** Overlap allowed for floating-point rounding in push-out. */
export const OVERLAP_TOLERANCE = 1e-6;
