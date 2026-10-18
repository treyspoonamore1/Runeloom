import { Button, wasPressed, type InputFrame } from '../core/input';
import type { GameState } from '../state';
import type { Tuning } from '../../../data/tuning';
import { DT } from '../core/constants';
import { clipToContacts, moveCircle } from './collision';

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
  /** Normalized last non-zero move direction (the dodge direction while dodging). */
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

type PlayerTuning = Tuning['player'];

/** Move inputs shorter than this count as no input. */
const MOVE_EPSILON = 1e-6;
/** Aim points closer than this (cells) to the player keep the previous aim direction. */
const AIM_EPSILON = 1e-6;
/** Timers within this many seconds of zero count as expired (absorbs 1/60 rounding). */
const TIME_EPSILON = 1e-9;

// Scratch vector for the walk target; the sim is single-threaded.
const target = { x: 0, y: 0 };

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

export function isDodging(p: PlayerState): boolean {
  return p.dodgeLeft > 0;
}

export function isInvulnerable(p: PlayerState): boolean {
  return p.iframesLeft > 0;
}

/** Dodge speed in cells per second: dodgeDistance covered evenly over dodgeDuration. */
export function dodgeSpeed(t: PlayerTuning): number {
  return t.dodgeDistance / t.dodgeDuration;
}

/** One 60 Hz player tick: timers, aim, dodge start, then dodge and/or walk movement. */
export function stepPlayer(state: GameState, input: InputFrame): void {
  const p = state.player;
  const t = state.tuning.player;
  p.prevX = p.x;
  p.prevY = p.y;

  tickTimers(p, t);
  updateAim(p, input);

  // Move input, clamped to length 1 so diagonals aren't faster; analog magnitudes below 1 are kept.
  let mx = input.moveX;
  let my = input.moveY;
  const mlen = Math.sqrt(mx * mx + my * my);
  if (mlen <= MOVE_EPSILON) {
    mx = 0;
    my = 0;
  } else if (mlen > 1) {
    mx /= mlen;
    my /= mlen;
  }

  if (
    !isDodging(p) &&
    p.dodgeCharges > 0 &&
    t.dodgeDuration > 0 &&
    wasPressed(state.prevButtons, input.buttons, Button.Dodge)
  ) {
    startDodge(p, t, mx, my, mlen);
  }

  let walkTime = DT;
  if (isDodging(p)) {
    // Movement input is ignored while dodging; the dodge moves at constant speed.
    const dt = Math.min(DT, p.dodgeLeft);
    const speed = dodgeSpeed(t);
    p.vx = p.dodgeDirX * speed;
    p.vy = p.dodgeDirY * speed;
    moveCircle(state.room, p, t.radius, p.vx * dt, p.vy * dt);
    p.dodgeLeft -= dt;
    walkTime -= dt;
    if (p.dodgeLeft <= TIME_EPSILON) {
      p.dodgeLeft = 0;
      // Leave the dodge at run speed along the (possibly wall-slid) dodge velocity, so
      // holding the same direction keeps running instead of stopping dead.
      const k = t.moveSpeed / speed;
      p.vx *= k;
      p.vy *= k;
    }
  }

  if (!isDodging(p) && walkTime > TIME_EPSILON) {
    walk(state, p, t, mx, my, walkTime);
  }
}

function tickTimers(p: PlayerState, t: PlayerTuning): void {
  p.iframesLeft = p.iframesLeft > DT + TIME_EPSILON ? p.iframesLeft - DT : 0;

  // Charges come back one at a time, each after a full dodgeRecharge.
  if (p.dodgeCharges >= t.dodgeCharges) {
    p.dodgeCharges = t.dodgeCharges;
    p.dodgeRechargeLeft = 0;
    return;
  }
  if (p.dodgeRechargeLeft <= 0) p.dodgeRechargeLeft = t.dodgeRecharge;
  p.dodgeRechargeLeft -= DT;
  if (p.dodgeRechargeLeft <= TIME_EPSILON) {
    p.dodgeCharges++;
    p.dodgeRechargeLeft = p.dodgeCharges < t.dodgeCharges ? p.dodgeRechargeLeft + t.dodgeRecharge : 0;
  }
}

function updateAim(p: PlayerState, input: InputFrame): void {
  const ax = input.aimX - p.x;
  const ay = input.aimY - p.y;
  const alen = Math.sqrt(ax * ax + ay * ay);
  if (alen > AIM_EPSILON) {
    p.aimDirX = ax / alen;
    p.aimDirY = ay / alen;
  }
}

/** Dodges along the move input if there is one, else toward the aim point. */
function startDodge(p: PlayerState, t: PlayerTuning, mx: number, my: number, mlen: number): void {
  if (mlen > MOVE_EPSILON) {
    const l = Math.sqrt(mx * mx + my * my);
    p.dodgeDirX = mx / l;
    p.dodgeDirY = my / l;
  } else {
    p.dodgeDirX = p.aimDirX;
    p.dodgeDirY = p.aimDirY;
  }
  p.faceX = p.dodgeDirX;
  p.faceY = p.dodgeDirY;
  p.dodgeCharges--;
  p.dodgeLeft = t.dodgeDuration;
  p.iframesLeft = t.dodgeIframes;
}

/**
 * Accelerates the velocity vector toward the input's target velocity (at
 * moveSpeed/accelTime), or toward rest with no input (at moveSpeed/decelTime),
 * then moves with collision for `dt` seconds.
 */
function walk(state: GameState, p: PlayerState, t: PlayerTuning, mx: number, my: number, dt: number): void {
  const hasInput = mx !== 0 || my !== 0;
  if (hasInput) {
    const l = Math.sqrt(mx * mx + my * my);
    p.faceX = mx / l;
    p.faceY = my / l;
  }
  target.x = mx * t.moveSpeed;
  target.y = my * t.moveSpeed;
  clipToContacts(state.room, p.x, p.y, t.radius, target);
  const tx = target.x;
  const ty = target.y;
  const rate = t.moveSpeed / (hasInput ? t.accelTime : t.decelTime);
  const maxDelta = rate * dt;
  const dvx = tx - p.vx;
  const dvy = ty - p.vy;
  const dv = Math.sqrt(dvx * dvx + dvy * dvy);
  if (dv <= maxDelta) {
    p.vx = tx;
    p.vy = ty;
  } else {
    p.vx += (dvx / dv) * maxDelta;
    p.vy += (dvy / dv) * maxDelta;
  }
  moveCircle(state.room, p, t.radius, p.vx * dt, p.vy * dt);
}
