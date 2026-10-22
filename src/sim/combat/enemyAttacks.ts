import { attackByName, enemyDef, type AttackDef } from '../../../data/enemies';
import { OWNER } from '../../../data/materials';
import { bossDamageScale, type Enemy } from '../actors/enemies';
import { attackSpeedMult, hastedWindup } from '../actors/rarity';
import { rememberCharge } from '../actors/terrainState';
import { landBossAttack } from '../ai/bosses/hooks';
import { DT } from '../core/constants';
import { emit } from '../events';
import { applyElement, type Footprint } from '../grid/paint';
import type { GameState } from '../state';
import { actionSpeed, isFrozen } from './ailments';
import { makePacket, scaleByLevel, type DamagePacket } from './damage';
import { endDash, startDash, stepDash } from './dash';
import { applyHit, directionOr } from './hits';
import { spillOil } from './oil';
import { spawnProjectile } from './projectiles';
import { circleHitsShape, type AttackShape } from './shapes';

/** Timers within this many seconds of zero count as expired (absorbs 1/60 rounding). */
const TIME_EPSILON = 1e-9;

/**
 * The enemy's current (or last) attack, by EnemyAttackState.name; before its first attack, the
 * kind's primary attack. Null for kinds that never attack (dummies, Brood Kilns).
 */
export function attackDefFor(e: Enemy): AttackDef | null {
  const primary = enemyDef(e.kind).attack;
  const name = e.attack.name;
  if (name === '' || (primary !== null && primary.name === name)) return primary;
  return attackByName(e.kind, name) ?? primary;
}

/**
 * The attack's damage at the enemy's area level: base × enemyDamageGrowth^(level − 1); bosses'
 * numbers are absolute (CONTENT §5; rift bosses scale, actors/enemies.ts riftBossScale). Never crits.
 */
export function enemyAttackPacket(state: GameState, e: Enemy, def: AttackDef): DamagePacket {
  const dmg = enemyDef(e.kind).isBoss
    ? def.damage * bossDamageScale(state, e)
    : scaleByLevel(def.damage, state.tuning.combat.enemyDamageGrowth, e.areaLevel);
  return makePacket(dmg, { [def.damageType]: 1 }, 0, state.tuning.combat.critMultiplier);
}

/** The attack's shape oriented along the unit direction (dirX, dirY); `length` overrides a line's. */
export function orientShape(def: AttackDef, dirX: number, dirY: number, length?: number): AttackShape {
  const s = def.shape;
  switch (s.kind) {
    case 'circle':
      return { kind: 'circle', r: s.r };
    case 'cone':
      return { kind: 'cone', r: s.r, halfAngleCos: s.halfAngleCos, dirX, dirY };
    case 'line':
      return { kind: 'line', length: length ?? s.length, width: s.width, dirX, dirY };
  }
}

/** Where and how far an attack goes, besides its direction (M4). */
export interface AttackAim {
  /** Targeted attacks: the shape's origin (default: the enemy's center). */
  x?: number;
  y?: number;
  /** Line shapes: the line's length (dashes: dashLineLength of the planned dash). */
  length?: number;
}

/**
 * Starts an attack toward the unit direction (dirX, dirY): `def` (default: the kind's primary
 * attack), locking the shape and origin (center + dir × shape offset; targeted attacks: `aim`'s
 * point), facing that way, entering 'windup' and emitting 'telegraph'. Hasted monsters wind up
 * faster, but not below minTelegraph (DESIGN §14).
 * Returns false (and does nothing) if there is no attack, an attack is already running, or the
 * enemy is Frozen. The AI calls this; cooldowns are the AI's business (EnemyAI.cooldown).
 */
export function startEnemyAttack(
  state: GameState,
  e: Enemy,
  dirX: number,
  dirY: number,
  def: AttackDef | null = enemyDef(e.kind).attack,
  aim: AttackAim = {},
): boolean {
  if (!def || e.dead || e.attack.phase !== 'none' || isFrozen(e)) return false;
  const a = e.attack;
  const windup = hastedWindup(def.windup, attackSpeedMult(e));
  a.phase = 'windup';
  a.timeLeft = windup;
  a.name = def.name;
  a.shape = orientShape(def, dirX, dirY, aim.length);
  if (def.targeted) {
    a.originX = aim.x ?? e.x;
    a.originY = aim.y ?? e.y;
  } else {
    a.originX = e.x + dirX * def.shape.offset;
    a.originY = e.y + dirY * def.shape.offset;
  }
  e.facingX = dirX;
  e.facingY = dirY;
  endDash(e);
  emit(state, { type: 'telegraph', id: e.id, attack: def.name, windup });
  return true;
}

/**
 * Advances the attack phases by one tick of the enemy's action speed (Chill slows every phase;
 * a Frozen enemy's attack doesn't advance), carrying leftover time across phases. On entering
 * 'active' the attack resolves once (resolveEnemyAttack); a dash runs during 'active' (stepDash).
 * Hasted monsters spend active and recover ÷ attack speed.
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
  const speed = actionSpeed(state, e);
  if (speed <= 0) return;
  if (a.phase === 'active' && def.dash && e.special.dashSpeed > 0)
    stepDash(state, e, def.dash, enemyAttackPacket(state, e, def), def.knockback);
  if (e.dead) return;
  const haste = e.mods.length > 0 ? attackSpeedMult(e) : 1;
  a.timeLeft -= DT * speed;
  while (a.phase !== 'none' && a.timeLeft <= TIME_EPSILON) {
    if (a.phase === 'windup') {
      a.phase = 'active';
      a.timeLeft += resolveEnemyAttack(state, e, def) / haste;
      if (e.dead) return;
    } else if (a.phase === 'active') {
      endDash(e);
      a.phase = 'recover';
      a.timeLeft += def.recover / haste;
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
 * Lands the attack and returns how long its 'active' phase lasts (def.active; a dash: its run):
 * - a dash starts running along its line (its hit comes on contact, stepDash);
 * - a projectile attack fires from the shape origin along the attack direction;
 * - otherwise, if it deals damage and the player's body touches the shape, the player is hit,
 *   knocked away from the enemy (targeted attacks: from the shape's center).
 * Then its terrain (M4) lands on the grid over the shape, as the enemy team, and boss attacks
 * do their part (ai/bosses/hooks.ts). A Storm attack that hit the player directly doesn't hit
 * them again through the water or metal it electrifies.
 */
export function resolveEnemyAttack(state: GameState, e: Enemy, def: AttackDef): number {
  const a = e.attack;
  emit(state, { type: 'attack', id: e.id, attack: def.name, x: a.originX, y: a.originY });
  const [dirX, dirY] = attackDir(e);
  if (def.dash) {
    const s = a.shape;
    return startDash(e, def.dash, dirX, dirY, s.kind === 'line' ? s.length : 0);
  }
  const packet = enemyAttackPacket(state, e, def);
  let hitPlayer = false;
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
  } else if (def.damage > 0) {
    const p = state.player;
    if (!p.dead && circleHitsShape(a.shape, a.originX, a.originY, p.x, p.y, state.tuning.player.radius)) {
      const fromX = def.targeted ? a.originX : e.x;
      const fromY = def.targeted ? a.originY : e.y;
      const [kx, ky] = directionOr(fromX, fromY, p.x, p.y, dirX, dirY);
      hitPlayer =
        applyHit(state, p, packet, { sourceId: e.id, dirX: kx, dirY: ky, knockback: def.knockback }) !== null;
    }
  }
  if (def.terrain) attackTerrain(state, e, def, packet, hitPlayer);
  if (!e.dead) landBossAttack(state, e, def.name);
  return def.active;
}

/** The grid footprint of the current attack's shape. */
export function attackFootprint(e: Enemy): Footprint {
  const a = e.attack;
  const s = a.shape;
  switch (s.kind) {
    case 'circle':
      return { kind: 'circle', x: a.originX, y: a.originY, r: s.r };
    case 'cone':
      return {
        kind: 'arc',
        x: a.originX,
        y: a.originY,
        dirX: s.dirX,
        dirY: s.dirY,
        r: s.r,
        halfAngleCos: s.halfAngleCos,
      };
    case 'line':
      return {
        kind: 'line',
        x0: a.originX,
        y0: a.originY,
        x1: a.originX + s.dirX * s.length,
        y1: a.originY + s.dirY * s.length,
        width: s.width,
      };
  }
}

function attackTerrain(
  state: GameState,
  e: Enemy,
  def: AttackDef,
  packet: DamagePacket,
  hitPlayer: boolean,
): void {
  const t = def.terrain!;
  const a = e.attack;
  if (t.kind === 'oil') {
    spillOil(state, a.originX, a.originY, t.radius, t.tar === true);
    return;
  }
  const firstCharge = state.grid.nextChargeId;
  applyElement(state, {
    element: t.element,
    shape: attackFootprint(e),
    owner: OWNER.enemy,
    sourceId: e.id,
    hitDamage: t.element === 'storm' ? packet.base.storm : 0,
    durationMult: 1,
  });
  if (!hitPlayer) return;
  // The strike already hit the player: its charge events don't hit them a second time.
  for (let id = firstCharge; id < state.grid.nextChargeId; id++) rememberCharge(state.player.terrain, id);
}
