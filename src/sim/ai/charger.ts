/**
 * Mirebull (M8, CONTENT §5; the Cinder Warden's planDash generalized): walks at the player and
 * gores up close. Off its charge cooldown, seeing a player chargeMin–chargeMax cells away, it
 * charges: a line telegraph over the planned run (0.9 s), then a dash at the charge's speed that
 * hits on contact. The run goes `overshoot` cells past where the player stood, at most the
 * dash's maxLength, and cells on ice cost 1 / iceLengthMult of it (a charge on ice runs farther).
 * - A run planned into a wall (anything shots can't cross) stuns it wallStun s when it ends.
 * - Entering mud ends the charge at once: bogged for bogSeconds (it can't act and takes
 *   boggedTaken × damage, actors/fenChemistry.ts).
 * Tide turning dirt to mud ahead of it is Tide's chemistry; the bull just runs into it.
 */
import { attackByName, enemyDef, type AttackDef, type BehaviorDef } from '../../../data/enemies';
import type { DashDef } from '../../../data/enemyTypes';
import { MAT, materialByCode } from '../../../data/materials';
import { circleOverlapsSolid } from '../actors/collision';
import type { Enemy } from '../actors/enemies';
import { floatRoom } from '../actors/locomotion';
import { attackSpeedMult } from '../actors/rarity';
import { cellOf } from '../actors/swim';
import { dashLineLength, endDash } from '../combat/dash';
import { startEnemyAttack } from '../combat/enemyAttacks';
import { emit } from '../events';
import type { GameState } from '../state';
import { attack, faceVelocity, setMode, steerTo, stop, toPlayer } from './common';

type Charger = Extract<BehaviorDef, { kind: 'charger' }>;

/** Distance between samples when planning a charge, cells. */
const PLAN_STEP = 0.5;
/** Slack on the length budget (sums of PLAN_STEP costs). */
const EPS = 1e-9;

/** Charge cooldown slot in EnemyAI.cooldowns. */
const CHARGE_SLOT = 0;

const plan = { length: 0, wall: false };

/**
 * How far the bull can run along the unit direction (at most `want` and dash.maxLength, cells on
 * ice costing 1 / iceLengthMult), and whether a wall stops it. The returned object is scratch.
 */
export function planCharge(
  state: GameState,
  e: Enemy,
  dash: DashDef,
  b: Charger,
  dirX: number,
  dirY: number,
  want: number,
): { length: number; wall: boolean } {
  const budget = want < dash.maxLength ? want : dash.maxLength;
  const g = state.grid;
  let d = 0;
  let spent = 0;
  plan.wall = false;
  for (;;) {
    const x = e.x + dirX * (d + PLAN_STEP);
    const y = e.y + dirY * (d + PLAN_STEP);
    if (circleOverlapsSolid(state.room, x, y, e.radius)) {
      plan.wall = circleOverlapsSolid(floatRoom(state.room), x, y, e.radius);
      break;
    }
    const i = cellOf(state, x, y);
    const ice = i >= 0 && materialByCode[g.ground[i]!]!.slippery;
    const cost = ice ? PLAN_STEP / b.iceLengthMult : PLAN_STEP;
    if (spent + cost > budget + EPS) break;
    spent += cost;
    d += PLAN_STEP;
  }
  plan.length = d;
  return plan;
}

/** The Mirebull's think: charge when it can, gore up close, else walk at the player. */
export function stepCharger(state: GameState, e: Enemy, b: Charger, gore: AttackDef): void {
  const ai = e.ai;
  const cds = ai.cooldowns;
  const charge = attackByName(e.kind, b.charge);
  const dist = toPlayer.dist;
  if (charge?.dash && cds[CHARGE_SLOT]! <= 0 && ai.los && dist >= b.chargeMin && dist <= b.chargeMax) {
    const p = planCharge(state, e, charge.dash, b, toPlayer.ux, toPlayer.uy, dist + b.overshoot);
    const wall = p.wall;
    if (
      p.length >= b.minLength &&
      startEnemyAttack(state, e, toPlayer.ux, toPlayer.uy, charge, { length: dashLineLength(e, p.length) })
    ) {
      e.special.chargeWall = wall;
      cds[CHARGE_SLOT] = charge.cooldown / attackSpeedMult(e);
      stop(e);
      setMode(e, 'windup');
      return;
    }
  }
  if (toPlayer.gap <= gore.range) {
    if (ai.cooldown <= 0 && ai.los && attack(state, e, gore, toPlayer.ux, toPlayer.uy)) return;
    stop(e);
    e.facingX = toPlayer.ux;
    e.facingY = toPlayer.uy;
    setMode(e, 'hold');
    return;
  }
  steerTo(state, e, state.player.x, state.player.y, 1);
  setMode(e, 'chase');
  faceVelocity(e);
}

/** A charge's run ended (combat/enemyAttacksM8.ts): planned into a wall, it is stunned. */
export function endCharge(state: GameState, e: Enemy): void {
  const b = enemyDef(e.kind).behavior;
  const s = e.special;
  if (b.kind !== 'charger' || !s.chargeWall) return;
  s.chargeWall = false;
  if (e.attack.name !== b.charge) return;
  e.terrain.stunLeft = b.wallStun;
  e.vx = e.vy = 0;
  emit(state, { type: 'bullStunned', id: e.id, seconds: b.wallStun, x: e.x, y: e.y });
}

/** Every tick (ai/passive.ts): a charging bull that enters mud bogs down. */
export function stepChargerPassive(state: GameState, e: Enemy, b: Charger): void {
  const s = e.special;
  if (s.dashSpeed <= 0 || e.attack.phase !== 'active' || e.attack.name !== b.charge) return;
  const i = cellOf(state, e.x, e.y);
  if (i < 0 || state.grid.ground[i] !== MAT.mud) return;
  endDash(e);
  s.chargeWall = false;
  s.boggedLeft = b.bogSeconds;
  e.terrain.stunLeft = b.bogSeconds;
  e.vx = e.vy = 0;
  // The charge is over: straight to its recover.
  const charge = attackByName(e.kind, b.charge);
  e.attack.phase = 'recover';
  e.attack.timeLeft = charge?.recover ?? 0;
  emit(state, { type: 'bullBogged', id: e.id, seconds: b.bogSeconds, x: e.x, y: e.y });
}
