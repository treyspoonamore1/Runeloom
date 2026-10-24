/**
 * Scripted puzzle driver (M4): turns a list of commands into InputFrames, one per tick, reading
 * the state each tick. Deterministic: the same state and commands give the same frames, so a
 * script is a reproducible solution for a puzzle room (BUILD_PLAN M4 task 10).
 *
 * Commands (positions in cells; a tile's center is ((tx + 0.5) × 4, (ty + 0.5) × 4)):
 * - `{ do: 'moveTo', x, y, tolerance?, timeout? }`: walk to the point along a tile path over
 *   walkable tiles (replanned when the room or its walkability changes, e.g. a door opens).
 *   Done within `tolerance` cells (default 0.6). The point itself must be reachable.
 * - `{ do: 'face', x, y }`: aim at the point from now on (takes no tick).
 * - `{ do: 'cast', slot, at: { x, y }, timeout? }`: aim at `at`, wait until no cast is in progress,
 *   then press and hold weave slot `slot` (0 = LMB, 1 = RMB, 2 = Q, 3 = E, 4 = R) until that cast
 *   releases its spell, then let go. Waits for mana while holding.
 * - `{ do: 'dodge', dirX, dirY }`: dodge that way; done when the dodge ends.
 * - `{ do: 'walk', dirX, dirY, s, until? }`: hold that move direction for `s` seconds (pushing a
 *   block, walking out through an exit). With `until`, stops as soon as it holds, and fails if
 *   it still doesn't after `s`.
 * - `{ do: 'wait', s }`: stand still for `s` seconds.
 * - `{ do: 'until', cond, timeout, label? }`: stand still until `cond(state)` holds; fails after
 *   `timeout` seconds.
 * Default timeouts are 20 s. Every frame aims at the last `face`/`cast` point (else straight ahead).
 *
 *   const r = runScript(state, [
 *     { do: 'moveTo', x: 14, y: 10 },
 *     { do: 'cast', slot: 0, at: { x: 14, y: 2 } },
 *     { do: 'until', cond: (s) => doorOpen(s), timeout: 5, label: 'door opens' },
 *   ]);
 *   expect(r.error).toBeUndefined();
 */
import { Button, type InputFrame } from '../core/input';
import { SLOT_BUTTONS } from '../weave/runtime/channel';
import { DT, SIM_HZ } from '../core/constants';
import type { GameState } from '../state';
import { step } from '../step';
import { findPath } from './scriptPath';

export type ScriptCommand =
  | { do: 'moveTo'; x: number; y: number; tolerance?: number; timeout?: number }
  | { do: 'face'; x: number; y: number }
  | { do: 'cast'; slot: number; at: { x: number; y: number }; timeout?: number }
  | { do: 'dodge'; dirX: number; dirY: number }
  | { do: 'walk'; dirX: number; dirY: number; s: number; until?: (state: GameState) => boolean }
  | { do: 'wait'; s: number }
  | { do: 'until'; cond: (state: GameState) => boolean; timeout: number; label?: string };

export interface ScriptResult {
  /** Every command finished. */
  ok: boolean;
  /** Ticks stepped. */
  ticks: number;
  /** Why it stopped early: a command timed out, or maxTicks ran out. */
  error?: string;
  /** Index of the command that failed. */
  failedAt?: number;
  /** The frames stepped, in order (a replay of the solution). */
  frames: InputFrame[];
}

const DEFAULT_TIMEOUT = 20;
/** Waypoints count as reached within this many cells. */
const WAYPOINT_REACH = 1;
/** Within this many cells of the final point, the move input scales down so the player stops on it. */
const BRAKE_DIST = 3;
const MIN_INPUT = 0.15;

/** Steps commands one tick at a time. Use runScript unless you interleave other inputs. */
export class ScriptDriver {
  /** Index of the running command (commands.length when done). */
  index = 0;
  error: string | undefined;
  private ticks = 0;
  private phase = 0;
  private aimX = 0;
  private aimY = 0;
  private hasAim = false;
  private path: { x: number; y: number }[] | null = null;
  private pathKey = '';

  constructor(readonly commands: readonly ScriptCommand[]) {}

  get done(): boolean {
    return this.index >= this.commands.length || this.error !== undefined;
  }

  /** The input for the next tick, or null when the script is done (check `error`). */
  next(state: GameState): InputFrame | null {
    while (!this.done) {
      const frame = this.run(state, this.commands[this.index]!);
      if (frame) {
        this.ticks++;
        return frame;
      }
      if (this.error === undefined) this.advance();
    }
    return null;
  }

  private advance(): void {
    this.index++;
    this.ticks = 0;
    this.phase = 0;
    this.path = null;
  }

  private fail(msg: string): null {
    this.error = `command ${this.index} (${this.commands[this.index]!.do}): ${msg}`;
    return null;
  }

  private frame(state: GameState, moveX: number, moveY: number, buttons: number): InputFrame {
    const p = state.player;
    const aimX = this.hasAim ? this.aimX : p.x + p.faceX * 4;
    const aimY = this.hasAim ? this.aimY : p.y + p.faceY * 4;
    return { moveX, moveY, aimX, aimY, buttons };
  }

  private timedOut(seconds: number): boolean {
    return this.ticks >= Math.round(seconds * SIM_HZ);
  }

  /** One tick of command `c`: a frame, or null when it finished (or failed: see `error`). */
  private run(state: GameState, c: ScriptCommand): InputFrame | null {
    const p = state.player;
    switch (c.do) {
      case 'face':
        this.aim(c.x, c.y);
        return null;
      case 'wait':
        return this.timedOut(c.s) ? null : this.frame(state, 0, 0, 0);
      case 'until':
        if (c.cond(state)) return null;
        if (this.timedOut(c.timeout))
          return this.fail(`timed out after ${c.timeout} s${c.label ? `: ${c.label}` : ''}`);
        return this.frame(state, 0, 0, 0);
      case 'walk':
        if (c.until?.(state)) return null;
        if (this.timedOut(c.s)) return c.until ? this.fail(`condition not met after ${c.s} s`) : null;
        return this.frame(state, c.dirX, c.dirY, 0);
      case 'dodge':
        if (this.phase === 0) {
          this.phase = 1;
          return this.frame(state, c.dirX, c.dirY, Button.Dodge);
        }
        if (p.dodgeLeft > 0) return this.frame(state, c.dirX, c.dirY, 0);
        return null;
      case 'cast': {
        this.aim(c.at.x, c.at.y);
        if (this.timedOut(c.timeout ?? DEFAULT_TIMEOUT)) return this.fail('the cast never released');
        const bit = SLOT_BUTTONS[c.slot];
        if (bit === undefined) return this.fail(`no slot ${c.slot}`);
        if (this.phase === 0) {
          // Wait until any earlier cast is over, with the buttons up so the next press registers.
          if (p.castSlot >= 0 || p.dead) return this.frame(state, 0, 0, 0);
          this.phase = 1;
        }
        if (this.phase === 1) {
          if (p.castSlot === c.slot && p.castReleased) {
            this.phase = 2;
            return this.frame(state, 0, 0, 0);
          }
          return this.frame(state, 0, 0, bit);
        }
        return null;
      }
      case 'moveTo':
        return this.moveTo(state, c);
    }
  }

  private aim(x: number, y: number): void {
    this.aimX = x;
    this.aimY = y;
    this.hasAim = true;
  }

  private moveTo(state: GameState, c: Extract<ScriptCommand, { do: 'moveTo' }>): InputFrame | null {
    const p = state.player;
    const tol = c.tolerance ?? 0.6;
    const dx = c.x - p.x;
    const dy = c.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= tol) return null;
    const timeout = c.timeout ?? DEFAULT_TIMEOUT;
    if (this.timedOut(timeout))
      return this.fail(
        `didn't reach (${c.x}, ${c.y}) in ${timeout} s; stuck at (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`,
      );
    if (p.dead) return this.frame(state, 0, 0, 0);
    const key = `${state.room.id}:${state.grid.walkVersion}`;
    if (this.path === null || key !== this.pathKey) {
      this.path = findPath(state.room, p.x, p.y, c.x, c.y) ?? [];
      this.pathKey = key;
    }
    while (this.path.length > 0) {
      const wp = this.path[0]!;
      const ex = wp.x - p.x;
      const ey = wp.y - p.y;
      if (ex * ex + ey * ey > WAYPOINT_REACH * WAYPOINT_REACH) break;
      this.path.shift();
    }
    const to = this.path[0] ?? { x: c.x, y: c.y };
    const tx = to.x - p.x;
    const ty = to.y - p.y;
    const len = Math.sqrt(tx * tx + ty * ty);
    if (len < 1e-9) return this.frame(state, 0, 0, 0);
    const mag = this.path.length > 0 ? 1 : Math.max(MIN_INPUT, Math.min(1, len / BRAKE_DIST));
    return this.frame(state, (tx / len) * mag, (ty / len) * mag, 0);
  }
}

/**
 * Runs `commands` on `state` (stepping it in place) until they all finish, one fails, or
 * `maxTicks` ticks pass (default 2 minutes of game time).
 */
export function runScript(
  state: GameState,
  commands: readonly ScriptCommand[],
  maxTicks = 120 * SIM_HZ,
): ScriptResult {
  const d = new ScriptDriver(commands);
  const frames: InputFrame[] = [];
  while (frames.length < maxTicks) {
    const f = d.next(state);
    if (!f) break;
    frames.push(f);
    step(state, f);
  }
  const ticks = frames.length;
  if (d.error !== undefined) return { ok: false, ticks, error: d.error, failedAt: d.index, frames };
  if (!d.done)
    return {
      ok: false,
      ticks,
      error: `ran out of ticks (${maxTicks}, ${(maxTicks * DT).toFixed(1)} s)`,
      failedAt: d.index,
      frames,
    };
  return { ok: true, ticks, frames };
}
