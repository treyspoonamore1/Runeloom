/**
 * The Tar Hulk's explosion (CONTENT §5): ignited while Oiled, it explodes when its fuse runs out
 * (ai/passive.ts), or at once if it dies with the fuse lit (actors/chemistry.ts). A world-owned
 * fire burst: placed fire and ignition in `radius` cells, and every live body it touches (the
 * player and every other enemy; world hazards hurt everyone, DESIGN §6.3) takes `damage` Fire
 * scaled by the Hulk's area level and is knocked away (tuning.terrain.blastKnockback).
 * Applied at once, not through grid.blasts (which only the grid tick fills).
 */
import { enemyDef } from '../../../data/enemies';
import { OWNER } from '../../../data/materials';
import type { AilmentTarget } from '../combat/ailments';
import { makePacket, scaleByLevel } from '../combat/damage';
import { applyHit, directionOr, killEnemy } from '../combat/hits';
import { emit } from '../events';
import { WORLD_SOURCE_ID } from '../grid/cells';
import { applyElement } from '../grid/paint';
import type { GameState } from '../state';
import type { Enemy } from './enemies';

/** Explodes Hulk `e`; with `die`, it dies too (credited to whoever ignited it). */
export function explodeHulk(state: GameState, e: Enemy, die: boolean): void {
  const ex = enemyDef(e.kind).chemistry?.explodes;
  if (ex === undefined) return;
  e.special.fuseLeft = 0;
  const x = e.x;
  const y = e.y;
  const damage = scaleByLevel(ex.damage, state.tuning.combat.enemyDamageGrowth, e.areaLevel);
  emit(state, { type: 'hulkExploded', id: e.id, x, y, radius: ex.radius, damage });
  applyElement(state, {
    element: 'fire',
    shape: { kind: 'circle', x, y, r: ex.radius },
    owner: OWNER.world,
    sourceId: WORLD_SOURCE_ID,
    hitDamage: 0,
    durationMult: 1,
  });
  emit(state, {
    type: 'explosion',
    x,
    y,
    radius: ex.radius,
    damage,
    owner: OWNER.world,
    sourceId: WORLD_SOURCE_ID,
  });
  const p = state.player;
  if (!p.dead) blastHit(state, x, y, ex.radius, damage, p, state.tuning.player.radius);
  // Enemies added by kills' side effects don't count; only those alive as it goes off.
  const n = state.enemies.length;
  for (let k = 0; k < n; k++) {
    const o = state.enemies[k]!;
    if (o !== e && !o.dead) blastHit(state, x, y, ex.radius, damage, o, o.radius);
  }
  if (die && !e.dead) killEnemy(state, e, e.ailments.ignite.sourceId, 'hit');
}

function blastHit(
  state: GameState,
  x: number,
  y: number,
  radius: number,
  damage: number,
  t: AilmentTarget,
  r: number,
): void {
  const dx = t.x - x;
  const dy = t.y - y;
  const reach = radius + r;
  if (dx * dx + dy * dy > reach * reach) return;
  const [kx, ky] = directionOr(x, y, t.x, t.y, 0, 1);
  applyHit(state, t, makePacket(damage, { fire: 1 }, 0, state.tuning.combat.critMultiplier), {
    sourceId: WORLD_SOURCE_ID,
    dirX: kx,
    dirY: ky,
    knockback: state.tuning.terrain.blastKnockback,
    owner: OWNER.world,
  });
}
