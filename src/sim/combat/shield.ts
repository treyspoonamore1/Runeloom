import type { Enemy } from '../actors/enemies';

/**
 * True if a hit coming from (fromX, fromY) is stopped by the enemy's shield: the source lies
 * within the shield's front arc (±acos(halfAngleCos) around `facing`). For projectiles, pass
 * the projectile's position at contact; for beams (M2), the beam's origin.
 * Strike and other melee hits ignore shields and never call this.
 */
export function isBlockedByShield(enemy: Enemy, fromX: number, fromY: number): boolean {
  const s = enemy.shield;
  if (!s) return false;
  const dx = fromX - enemy.x;
  const dy = fromY - enemy.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) return false;
  return dx * enemy.facingX + dy * enemy.facingY >= d * s.halfAngleCos;
}
