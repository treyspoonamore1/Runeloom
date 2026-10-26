/**
 * M8 parts of enemy attacks (combat/enemyAttacks.ts calls these):
 * - Leaps (AttackDef.leap, the Glasspike): when the windup ends the enemy flies to the shape's
 *   origin in a straight line over leap.seconds (render draws the arc from EnemySpecial
 *   leapFrom / leapTo / leapLeft), reading no ground; on touchdown the hit lands over the shape
 *   and a swimmer that came down off water Strands (rule 31).
 * - Terrain `water` (Spark Heron's spit): temporary shallow water on dry ground (grid/tempWater.ts;
 *   borrowed water once Tide lands). Terrain `gust` (Bellows Toad's croak): an enemy gust over
 *   the attack's cone (grid/wind.ts writeGust).
 * - A Charged Copperback's attacks add Storm (fenChemistry.ts chargedAttackStorm).
 * - The end of an attack's active phase (endActiveM8): a leap's touchdown, a Mirebull's charge
 *   into a wall (ai/charger.ts).
 */
import type { AttackDef } from '../../../data/enemies';
import type { Enemy } from '../actors/enemies';
import { chargedAttackStorm } from '../actors/fenChemistry';
import { isWaterCell, locomotionOf } from '../actors/locomotion';
import { strand } from '../actors/strand';
import { cellOf } from '../actors/swim';
import { endCharge } from '../ai/charger';
import { DT } from '../core/constants';
import { emit } from '../events';
import { placeBorrowedWater } from '../grid/tempWater';
import { writeGust } from '../grid/wind';
import type { GameState } from '../state';
import { scaleByLevel, type DamagePacket } from './damage';
import { applyHit, directionOr } from './hits';
import { circleHitsShape } from './shapes';

/** Starts a leap to the attack's origin (the landing point). Returns its duration. */
export function startLeap(state: GameState, e: Enemy, seconds: number): number {
  const s = e.special;
  const a = e.attack;
  s.leapFromX = e.x;
  s.leapFromY = e.y;
  s.leapToX = a.originX;
  s.leapToY = a.originY;
  s.leapTime = seconds;
  s.leapLeft = seconds;
  s.submerged = false;
  e.vx = e.vy = 0;
  emit(state, {
    type: 'pikeLeap',
    id: e.id,
    fromX: e.x,
    fromY: e.y,
    toX: a.originX,
    toY: a.originY,
    seconds,
  });
  return seconds;
}

/** One tick of a leap in the air at action speed `speed` (Chill slows it). */
export function stepLeap(e: Enemy, speed: number): void {
  const s = e.special;
  if (s.leapLeft <= 0) return;
  s.leapLeft = Math.max(0, s.leapLeft - DT * speed);
  const k = s.leapTime > 0 ? 1 - s.leapLeft / s.leapTime : 1;
  e.x = s.leapFromX + (s.leapToX - s.leapFromX) * k;
  e.y = s.leapFromY + (s.leapToY - s.leapFromY) * k;
  e.vx = e.vy = 0;
}

/** Touchdown: at the landing point, the bite over the shape, then Stranded if it came down off water. */
function land(state: GameState, e: Enemy, def: AttackDef, packet: DamagePacket): void {
  const s = e.special;
  const a = e.attack;
  s.leapLeft = 0;
  e.x = s.leapToX;
  e.y = s.leapToY;
  const i = cellOf(state, e.x, e.y);
  const onWater = i >= 0 && isWaterCell(state.grid, i);
  emit(state, { type: 'pikeLand', id: e.id, x: e.x, y: e.y, onWater });
  const p = state.player;
  if (
    def.damage > 0 &&
    !p.dead &&
    circleHitsShape(a.shape, a.originX, a.originY, p.x, p.y, state.tuning.player.radius)
  ) {
    const [kx, ky] = directionOr(a.originX, a.originY, p.x, p.y, e.facingX, e.facingY);
    applyHit(state, p, packet, { sourceId: e.id, dirX: kx, dirY: ky, knockback: def.knockback });
  }
  if (!e.dead && !onWater && locomotionOf(e.kind) === 'swim') strand(state, e);
}

/** The end of an attack's active phase (before its recover): a leap lands, a charge ends. */
export function endActiveM8(state: GameState, e: Enemy, def: AttackDef, packet: () => DamagePacket): void {
  if (def.leap) land(state, e, def, packet());
  if (def.dash) endCharge(state, e);
}

/** Adds a Charged Copperback's Storm to an attack packet (at its area level). */
export function addChargedStorm(state: GameState, e: Enemy, packet: DamagePacket): DamagePacket {
  const extra = chargedAttackStorm(e);
  if (extra <= 0) return packet;
  const storm = scaleByLevel(extra, state.tuning.combat.enemyDamageGrowth, e.areaLevel);
  return { ...packet, base: { ...packet.base, storm: packet.base.storm + storm } };
}

/**
 * The M8 attack terrains, over the current attack's shape: `water` puddles the dry ground around
 * its origin, `gust` writes an enemy gust over its cone. Returns false for other terrain kinds.
 */
export function fenAttackTerrain(state: GameState, e: Enemy, def: AttackDef): boolean {
  const t = def.terrain;
  const a = e.attack;
  if (t === undefined) return false;
  if (t.kind === 'water') {
    // Enemy puddles are borrowed water (DESIGN §6.5): they go back to the ground (rule 27).
    placeBorrowedWater(state, a.originX, a.originY, t.radius, t.seconds);
    emit(state, {
      type: 'heronPuddle',
      id: e.id,
      x: a.originX,
      y: a.originY,
      radius: t.radius,
      seconds: t.seconds,
    });
    return true;
  }
  if (t.kind === 'gust') {
    const sh = a.shape;
    const dirX = sh.kind === 'circle' ? e.facingX : sh.dirX;
    const dirY = sh.kind === 'circle' ? e.facingY : sh.dirY;
    const radius = sh.kind === 'cone' ? sh.r : sh.kind === 'circle' ? sh.r : sh.length;
    writeGust(state, {
      x: a.originX,
      y: a.originY,
      dirX,
      dirY,
      radius,
      angleDeg: t.angleDeg,
      seconds: t.seconds,
      team: 'enemy',
    });
    emit(state, {
      type: 'toadCroak',
      id: e.id,
      x: a.originX,
      y: a.originY,
      dirX,
      dirY,
      radius,
      angleDeg: t.angleDeg,
      seconds: t.seconds,
    });
    return true;
  }
  return false;
}
