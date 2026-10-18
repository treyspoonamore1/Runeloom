import type { Tuning } from '../../../data/tuning';
import { DT } from '../core/constants';
import type { Room } from '../world/room';
import { moveCircle, type CircleBody } from './collision';

/** A body that can be knocked back: position plus a knockback velocity in cells/s. */
export interface KnockbackBody {
  x: number;
  y: number;
  kbX: number;
  kbY: number;
}

type FeelTuning = Tuning['feel'];

// Scratch body so moveCircle clips the knockback velocity, not the body's own velocity.
const scratch: CircleBody = { x: 0, y: 0, vx: 0, vy: 0 };

/**
 * Adds a knockback impulse that travels `distance` cells along the unit direction in total.
 *
 * Each tick the body moves kb × DT, then kb loses DT / knockbackTime of itself, so the travel is
 * the geometric sum v0 × DT / (DT / knockbackTime) = v0 × knockbackTime. An impulse of
 * distance / knockbackTime therefore covers `distance` (minus the tail below knockbackStopSpeed).
 */
export function addKnockback(
  body: KnockbackBody,
  dirX: number,
  dirY: number,
  distance: number,
  feel: FeelTuning,
): void {
  if (distance <= 0) return;
  const v = distance / feel.knockbackTime;
  body.kbX += dirX * v;
  body.kbY += dirY * v;
}

/**
 * Moves the body by its knockback velocity through `moveCircle` (so it slides along walls and
 * never passes through them; the part of kb pointing into a wall is removed), then decays it.
 */
export function stepKnockback(room: Room, body: KnockbackBody, radius: number, feel: FeelTuning): void {
  if (body.kbX === 0 && body.kbY === 0) return;
  scratch.x = body.x;
  scratch.y = body.y;
  scratch.vx = body.kbX;
  scratch.vy = body.kbY;
  moveCircle(room, scratch, radius, body.kbX * DT, body.kbY * DT);
  body.x = scratch.x;
  body.y = scratch.y;
  const keep = Math.max(0, 1 - DT / feel.knockbackTime);
  body.kbX = scratch.vx * keep;
  body.kbY = scratch.vy * keep;
  const stop = feel.knockbackStopSpeed;
  if (body.kbX * body.kbX + body.kbY * body.kbY < stop * stop) {
    body.kbX = 0;
    body.kbY = 0;
  }
}
