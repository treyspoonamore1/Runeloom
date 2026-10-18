import type { AttackDef, BehaviorDef } from '../../../data/enemies';
import type { Enemy } from '../actors/enemies';
import { DT } from '../core/constants';
import { smallAngleCos, smallAngleSin, turnToward } from '../core/math';
import type { GameState } from '../state';
import { attack, setMode, steerTo, stop, toPlayer } from './common';

type Shield = Extract<BehaviorDef, { kind: 'shield' }>;

// Scratch for the turned facing.
const turned = { x: 0, y: 0 };

/**
 * Shieldbearer: advances on the player while its shield (facing) turns toward them at most
 * `turnRate` rad/s, toward its walking direction when it can't see them. It bashes only when the
 * player is in range and in front (within ±acos(bashArcCos) of facing), along its facing; the
 * attack locks facing until it is over (stepEnemyAI keeps it still), so circling the player
 * gets behind the shield.
 */
export function stepShield(state: GameState, e: Enemy, b: Shield, def: AttackDef): void {
  const ai = e.ai;
  const front = e.facingX * toPlayer.ux + e.facingY * toPlayer.uy;
  if (toPlayer.gap <= def.range && ai.cooldown <= 0 && ai.los && front >= b.bashArcCos) {
    attack(state, e, def, e.facingX, e.facingY);
    return;
  }
  const p = state.player;
  if (toPlayer.gap <= def.range) {
    // In reach: plant and turn instead of shoving into the player's body.
    stop(e);
    setMode(e, 'hold');
  } else {
    steerTo(state, e, p.x, p.y, 1);
    setMode(e, 'chase');
  }

  let wantX = toPlayer.ux;
  let wantY = toPlayer.uy;
  if (!ai.los) {
    const v = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
    if (v === 0) return;
    wantX = e.vx / v;
    wantY = e.vy / v;
  }
  const step = b.turnRate * DT;
  turnToward(e.facingX, e.facingY, wantX, wantY, smallAngleCos(step), smallAngleSin(step), turned);
  e.facingX = turned.x;
  e.facingY = turned.y;
}
