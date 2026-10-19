/**
 * Rule 19 (DESIGN §6.3): a Shock landing on a Wet entity arcs to up to `arc.maxTargets` other Wet
 * entities within `arc.range` cells, applying the same Shock and `arc.damageFraction` of the
 * hit's damage (as Storm, through the target's resistance). One generation: arcs never arc.
 *
 * Arcs reach only entities the hit's team can hurt (hazard ownership): the player's shocks jump
 * between Wet enemies, an enemy's only to the player, the world's to everyone.
 * Targets are the nearest first (ties: the player, then enemy array order).
 */
import { emit } from '../events';
import type { GameState } from '../state';
import type { Enemy } from '../actors/enemies';
import { isWet } from '../actors/terrainState';
import { hazardHurts } from '../grid/query';
import { applyShock, shockFor, targetRef, teamOf, type AilmentTarget } from './ailments';
import { makePacket, type DamagePacket, type HitResult } from './damage';
import { applyHit } from './hits';

// Scratch: candidate query results and the chosen targets with their squared distances.
const found: number[] = [];
const picks: AilmentTarget[] = [];
const pickD: number[] = [];

export function arcShock(
  state: GameState,
  t: AilmentTarget,
  packet: DamagePacket,
  res: HitResult,
  sourceId: number,
  owner: number,
): void {
  if (t.dead || !isWet(t)) return;
  const T = state.tuning.terrain.arc;
  const A = state.tuning.ailments;
  picks.length = 0;
  pickD.length = 0;
  const p = state.player;
  if (p !== t && !p.dead && isWet(p) && hazardHurts(owner, teamOf(p))) consider(p, t, T.range, T.maxTargets);
  const n = state.enemyHash.queryCircle(t.x, t.y, T.range, found);
  for (let k = 0; k < n; k++) {
    const e: Enemy = state.enemies[found[k]!]!;
    if (e === t || e.dead || !isWet(e) || !hazardHurts(owner, teamOf(e))) continue;
    consider(e, t, T.range, T.maxTargets);
  }
  if (picks.length === 0) return;
  const storm = res.byType.storm / ((1 + res.shock) * res.takenMult);
  const effect = shockFor(state, t, storm);
  const duration = A.shockDuration * (packet.ailmentDuration ?? 1);
  const arc = makePacket(res.total * T.damageFraction, { storm: 1 }, 0, state.tuning.combat.critMultiplier);
  // Copied: the hits below run other code that may reuse the scratch lists.
  const targets = picks.slice();
  for (const o of targets) {
    if (o.dead) continue;
    emit(state, { type: 'arc', from: targetRef(t), to: targetRef(o), x0: t.x, y0: t.y, x1: o.x, y1: o.y });
    applyHit(state, o, arc, { sourceId, dirX: 0, dirY: 0, knockback: 0, owner, arc: true });
    if (!o.dead) applyShock(state, o, effect, duration, sourceId);
  }
}

/** Keeps the `max` nearest candidates within `range` of `from` in picks (sorted, stable). */
function consider(o: AilmentTarget, from: AilmentTarget, range: number, max: number): void {
  const dx = o.x - from.x;
  const dy = o.y - from.y;
  const d2 = dx * dx + dy * dy;
  if (d2 > range * range) return;
  let j = picks.length;
  if (j >= max && d2 >= pickD[j - 1]!) return;
  if (j < max) {
    picks.push(o);
    pickD.push(d2);
  } else j--;
  while (j > 0 && pickD[j - 1]! > d2) {
    picks[j] = picks[j - 1]!;
    pickD[j] = pickD[j - 1]!;
    j--;
  }
  picks[j] = o;
  pickD[j] = d2;
}
