import type { InputFrame } from '../core/input';
import type { GameState } from '../state';
import { DT } from '../core/constants';

/** All player state lives here as plain data, so it hashes, saves and replays. */
export interface PlayerState {
  /** Position in cells (center of the collision circle). */
  x: number;
  y: number;
  /** Position at the start of the current tick, for render interpolation. */
  prevX: number;
  prevY: number;
  /** Velocity in cells per second. */
  vx: number;
  vy: number;
  /** Normalized aim direction (from player toward the aim point). */
  aimDirX: number;
  aimDirY: number;
  /** Normalized last non-zero move direction; dodges go this way. */
  faceX: number;
  faceY: number;
  dodgeCharges: number;
  /** Seconds until the next charge comes back (0 when full). */
  dodgeRechargeLeft: number;
  /** Seconds left in the current dodge (0 when not dodging). */
  dodgeLeft: number;
  dodgeDirX: number;
  dodgeDirY: number;
  /** Seconds of invulnerability left. */
  iframesLeft: number;
}

export function createPlayer(x: number, y: number, dodgeCharges: number): PlayerState {
  return {
    x,
    y,
    prevX: x,
    prevY: y,
    vx: 0,
    vy: 0,
    aimDirX: 1,
    aimDirY: 0,
    faceX: 0,
    faceY: 1,
    dodgeCharges,
    dodgeRechargeLeft: 0,
    dodgeLeft: 0,
    dodgeDirX: 0,
    dodgeDirY: 0,
    iframesLeft: 0,
  };
}

/**
 * SCAFFOLD STUB: moves at constant speed with no collision or dodge.
 * The M0 player task replaces this with acceleration, dodge and wall collision.
 */
export function stepPlayer(state: GameState, input: InputFrame): void {
  const p = state.player;
  p.prevX = p.x;
  p.prevY = p.y;
  const speed = state.tuning.player.moveSpeed;
  p.vx = input.moveX * speed;
  p.vy = input.moveY * speed;
  p.x += p.vx * DT;
  p.y += p.vy * DT;
}
