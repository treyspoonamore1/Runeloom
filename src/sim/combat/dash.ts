/**
 * Dash attacks (M4: Bog Lurker lunge, Cinder Warden charge; data DashDef). The AI plans the dash
 * at windup (planDash: how far the body can run before a wall, or for swimmers the water's edge)
 * and the telegraph line covers it. On landing the enemy runs along the line at the dash speed
 * (ai/index.ts sets the velocity while EnemySpecial.dashSpeed > 0), hitting the player once on
 * contact and, for the charge, leaving placed fire behind it (stepDash, from stepEnemyAttack).
 */
import { OWNER } from '../../../data/materials';
import type { DashDef } from '../../../data/enemyTypes';
import { circleOverlapsSolid } from '../actors/collision';
import type { Enemy } from '../actors/enemies';
import { isWaterAt, locomotionOf } from '../actors/locomotion';
import { applyElement } from '../grid/paint';
import type { GameState } from '../state';
import { applyHit, directionOr } from './hits';
import type { DamagePacket } from './damage';

/** Distance between samples when planning a dash, cells. */
const PLAN_STEP = 0.5;

/**
 * How far (cells, at most dash.maxLength and at most `want`) the enemy's body can run along the
 * unit direction before it would touch a wall (walkers) or leave the water (swimmers).
 */
export function planDash(
  state: GameState,
  e: Enemy,
  dash: DashDef,
  dirX: number,
  dirY: number,
  want: number,
): number {
  const max = want < dash.maxLength ? want : dash.maxLength;
  const swims = locomotionOf(e.kind) === 'swim';
  let d = 0;
  while (d + PLAN_STEP <= max) {
    const x = e.x + dirX * (d + PLAN_STEP);
    const y = e.y + dirY * (d + PLAN_STEP);
    if (swims ? !isWaterAt(state, x, y) : circleOverlapsSolid(state.room, x, y, e.radius)) break;
    d += PLAN_STEP;
  }
  return d;
}

/** The telegraph line's length for a dash of `length`: the path plus the body's front edge. */
export function dashLineLength(e: Enemy, length: number): number {
  return length + e.radius;
}

/** Starts the dash along the attack's line (on landing). Returns its duration in seconds. */
export function startDash(e: Enemy, dash: DashDef, dirX: number, dirY: number, lineLength: number): number {
  const s = e.special;
  s.dashX = dirX;
  s.dashY = dirY;
  s.dashSpeed = dash.speed;
  s.dashHit = false;
  const length = lineLength - e.radius;
  return length > 0 ? length / dash.speed : 0;
}

export function endDash(e: Enemy): void {
  const s = e.special;
  s.dashSpeed = 0;
  s.dashX = s.dashY = 0;
}

/**
 * One tick of a running dash: the first touch of the player's body (within dash.reach of it)
 * hits them, knocking them away along the dash's side; the charge leaves placed fire (rule 26)
 * under its body.
 */
export function stepDash(
  state: GameState,
  e: Enemy,
  dash: DashDef,
  packet: DamagePacket,
  knockback: number,
): void {
  const s = e.special;
  if (s.dashSpeed <= 0) return;
  if (dash.fireTrailRadius !== undefined)
    applyElement(state, {
      element: 'fire',
      shape: { kind: 'circle', x: e.x, y: e.y, r: dash.fireTrailRadius },
      owner: OWNER.enemy,
      sourceId: e.id,
      hitDamage: 0,
      durationMult: 1,
    });
  const p = state.player;
  if (s.dashHit || p.dead) return;
  const reach = e.radius + state.tuning.player.radius + dash.reach;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  if (dx * dx + dy * dy > reach * reach) return;
  s.dashHit = true;
  const [kx, ky] = directionOr(e.x, e.y, p.x, p.y, s.dashX, s.dashY);
  applyHit(state, p, packet, { sourceId: e.id, dirX: kx, dirY: ky, knockback });
}
