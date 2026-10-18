import { enemyDef, type AttackDef } from '../../../data/enemies';
import type { Enemy } from '../actors/enemies';
import { DT } from '../core/constants';
import { emit } from '../events';
import type { GameState } from '../state';
import { makePacket, scaleByLevel, type DamagePacket } from './damage';
import { applyHit, directionOr } from './hits';
import { spawnProjectile } from './projectiles';
import { circleHitsShape, type AttackShape } from './shapes';

/** Timers within this many seconds of zero count as expired (absorbs 1/60 rounding). */
const TIME_EPSILON = 1e-9;

/** The kind's attack, or null for kinds that never attack (dummies). */
export function attackDefFor(e: Enemy): AttackDef | null {
  return enemyDef(e.kind).attack;
}

/** The attack's damage at the enemy's area level: base × enemyDamageGrowth^(level − 1). Never crits. */
export function enemyAttackPacket(state: GameState, e: Enemy, def: AttackDef): DamagePacket {
  const dmg = scaleByLevel(def.damage, state.tuning.combat.enemyDamageGrowth, e.areaLevel);
  return makePacket(dmg, { [def.damageType]: 1 }, 0, state.tuning.combat.critMultiplier);
}

/** The attack's shape oriented along the unit direction (dirX, dirY). */
export function orientShape(def: AttackDef, dirX: number, dirY: number): AttackShape {
  const s = def.shape;
  switch (s.kind) {
    case 'circle':
      return { kind: 'circle', r: s.r };
    case 'cone':
      return { kind: 'cone', r: s.r, halfAngleCos: s.halfAngleCos, dirX, dirY };
    case 'line':
      return { kind: 'line', length: s.length, width: s.width, dirX, dirY };
  }
}

/**
 * Starts the enemy's attack toward the unit direction (dirX, dirY): locks the shape and origin
 * (center + dir × shape offset), faces that way, enters 'windup' and emits 'telegraph'.
 * Returns false (and does nothing) if the kind has no attack or an attack is already running.
 * The AI calls this; cooldowns are the AI's business (EnemyAI.cooldown).
 */
export function startEnemyAttack(state: GameState, e: Enemy, dirX: number, dirY: number): boolean {
  const def = attackDefFor(e);
  if (!def || e.dead || e.attack.phase !== 'none') return false;
  const a = e.attack;
  a.phase = 'windup';
  a.timeLeft = def.windup;
  a.name = def.name;
  a.shape = orientShape(def, dirX, dirY);
  a.originX = e.x + dirX * def.shape.offset;
  a.originY = e.y + dirY * def.shape.offset;
  e.facingX = dirX;
  e.facingY = dirY;
  emit(state, { type: 'telegraph', id: e.id, attack: def.name, windup: def.windup });
  return true;
}

/**
 * Advances the attack phases by one tick, carrying leftover time across phases. On entering
 * 'active' the attack resolves once (resolveEnemyAttack).
 */
export function stepEnemyAttack(state: GameState, e: Enemy): void {
  const a = e.attack;
  if (a.phase === 'none') return;
  const def = attackDefFor(e);
  if (!def) {
    a.phase = 'none';
    a.timeLeft = 0;
    return;
  }
  a.timeLeft -= DT;
  while (a.phase !== 'none' && a.timeLeft <= TIME_EPSILON) {
    if (a.phase === 'windup') {
      a.phase = 'active';
      a.timeLeft += def.active;
      resolveEnemyAttack(state, e, def);
    } else if (a.phase === 'active') {
      a.phase = 'recover';
      a.timeLeft += def.recover;
    } else {
      a.phase = 'none';
      a.timeLeft = 0;
    }
  }
}

/** Direction the current attack points (its shape's dir; circles use the enemy's facing). */
function attackDir(e: Enemy): [number, number] {
  const s = e.attack.shape;
  return s.kind === 'circle' ? [e.facingX, e.facingY] : [s.dirX, s.dirY];
}

/**
 * Lands the attack: fires its projectile from the shape origin along the attack direction, or
 * hits the player if their body touches the shape. Knockback pushes away from the enemy.
 */
export function resolveEnemyAttack(state: GameState, e: Enemy, def: AttackDef): void {
  const a = e.attack;
  emit(state, { type: 'attack', id: e.id, attack: def.name, x: a.originX, y: a.originY });
  const packet = enemyAttackPacket(state, e, def);
  const [dirX, dirY] = attackDir(e);
  if (def.projectile) {
    spawnProjectile(state, {
      team: 'enemy',
      ownerId: e.id,
      x: a.originX,
      y: a.originY,
      dirX,
      dirY,
      def: def.projectile,
      damage: packet,
      knockback: def.knockback,
    });
    return;
  }
  const p = state.player;
  if (p.dead) return;
  if (!circleHitsShape(a.shape, a.originX, a.originY, p.x, p.y, state.tuning.player.radius)) return;
  const [kx, ky] = directionOr(e.x, e.y, p.x, p.y, dirX, dirY);
  applyHit(state, p, packet, { sourceId: e.id, dirX: kx, dirY: ky, knockback: def.knockback });
}
