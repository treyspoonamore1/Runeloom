/**
 * Volatile (CONTENT §5, M5): a monster with the mod arms a blast where it dies. After `delay`
 * seconds it explodes: enemy-owned fire in `radius` cells and `lifeFraction` × its max life as
 * Fire damage to the player if inside (enemy-owned, so other enemies are safe). The armed blast
 * lives in `state.volatiles` (room-scoped, hashed); the renderer draws it as a telegraph
 * (render/telegraphView.ts) that fills as the fuse runs out.
 */
import { OWNER } from '../../../data/materials';
import { DT } from '../core/constants';
import type { Hasher } from '../core/hash';
import { emit } from '../events';
import { applyElement } from '../grid/paint';
import type { GameState } from '../state';
import { applyBlast } from './blasts';
import type { Enemy } from './enemies';
import { modVolatile } from './rarity';

export interface VolatileBlast {
  x: number;
  y: number;
  radius: number;
  /** Fire damage when it goes off. */
  damage: number;
  /** Seconds until it goes off, and the fuse's full length (for the telegraph). */
  left: number;
  delay: number;
  /** The dead monster's id (damage attribution). */
  sourceId: number;
}

/** Timers within this of zero count as elapsed. */
const TIME_EPSILON = 1e-9;

/** Arms a dying Volatile monster's blast. */
export function armVolatile(state: GameState, e: Enemy): void {
  const v = e.mods.length > 0 ? modVolatile(e) : undefined;
  if (!v) return;
  const b: VolatileBlast = {
    x: e.x,
    y: e.y,
    radius: v.radius,
    damage: e.maxLife * v.lifeFraction,
    left: v.delay,
    delay: v.delay,
    sourceId: e.id,
  };
  state.volatiles.push(b);
  emit(state, { type: 'volatileArmed', x: b.x, y: b.y, radius: b.radius, delay: b.delay });
}

/** Counts armed blasts down and sets off the ones whose fuse ran out, in arming order. */
export function stepVolatiles(state: GameState): void {
  const list = state.volatiles;
  if (list.length === 0) return;
  let w = 0;
  for (let k = 0; k < list.length; k++) {
    const b = list[k]!;
    b.left -= DT;
    if (b.left > TIME_EPSILON) {
      list[w++] = b;
      continue;
    }
    applyElement(state, {
      element: 'fire',
      shape: { kind: 'circle', x: b.x, y: b.y, r: b.radius },
      owner: OWNER.enemy,
      sourceId: b.sourceId,
      hitDamage: 0,
      durationMult: 1,
    });
    emit(state, {
      type: 'explosion',
      x: b.x,
      y: b.y,
      radius: b.radius,
      damage: b.damage,
      owner: OWNER.enemy,
      sourceId: b.sourceId,
    });
    applyBlast(state, {
      x: b.x,
      y: b.y,
      radius: b.radius,
      damage: b.damage,
      owner: OWNER.enemy,
      sourceId: b.sourceId,
    });
  }
  list.length = w;
}

export function hashVolatiles(h: Hasher, list: readonly VolatileBlast[]): void {
  h.u32(list.length);
  for (const b of list)
    h.num(b.x).num(b.y).num(b.radius).num(b.damage).num(b.left).num(b.delay).u32(b.sourceId);
}
