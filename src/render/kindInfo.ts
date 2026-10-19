import { enemyDef, isEnemyKind, type AttackDef } from '../../data/enemies';
import { BODY, type BodyBox } from './ailmentPalette';
import { isM4Kind, M4_LOOK } from './bestiary/bestiaryPalette';

/**
 * Render-side lookups by enemy kind that never throw: kinds the sim doesn't define yet (the M4
 * gallery) fall back to their art table (bestiary/bestiaryPalette.ts).
 */

/** Top speed, cells per second (animation normalization). */
export function kindSpeed(kind: string): number {
  if (isEnemyKind(kind)) return enemyDef(kind).speed;
  return isM4Kind(kind) ? M4_LOOK[kind].speed : 0;
}

/** The kind's single M1-style attack, if its def has one. */
export function kindAttack(kind: string): AttackDef | null {
  return isEnemyKind(kind) ? enemyDef(kind).attack : null;
}

/** Where effects (ailments, icons, falls) sit on the body. */
export function bodyBoxOf(kind: string): BodyBox {
  if (isM4Kind(kind)) return M4_LOOK[kind].box;
  return BODY[kind as keyof typeof BODY] ?? BODY.tinderling;
}

/** M4 art is drawn for a reference radius; this scales it to the sim's radius (1 for M1 kinds). */
export function artScale(kind: string, radius: number): number {
  return isM4Kind(kind) ? radius / M4_LOOK[kind].radius : 1;
}
