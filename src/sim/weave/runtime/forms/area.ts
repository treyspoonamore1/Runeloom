/**
 * Area forms (CONTENT §1.2): Strike (instant arc), Swath (instant strip), Nova (expanding ring)
 * and Lob (arcs over everything, bursts on landing). Each hits a target at most once. Area forms
 * fire On Hit on their first target only (ProcRule.firstTargetOnly).
 */
import { DT } from '../../../core/constants';
import { directionOr } from '../../../combat/hits';
import { circleIntersectsLine, circleIntersectsSector } from '../../../combat/shapes';
import { emit } from '../../../events';
import type { GameState } from '../../../state';
import { clampPoint, enemiesTouching, unitOr } from '../geom';
import { canTarget, spellHit, TIME_EPSILON } from '../procs';
import { elementsOf, endSpell } from '../spawn';
import type { SpellInstance } from '../types';

/**
 * Strike: hits every enemy whose body touches the arc (apex at the instance, `reach` cells,
 * ±acos(halfAngleCos) around its aim), once each, in spatial-hash order. Ignores shields and
 * walls. Knockback pushes away from the apex; a kill adds the Strike-kill hitstop.
 */
export function fireStrike(state: GameState, s: SpellInstance): void {
  const p = s.spec.params;
  if (p.form !== 'strike') return;
  for (const idx of enemiesTouching(state, s.x, s.y, p.reach)) {
    const e = state.enemies[idx]!;
    if (!canTarget(s, e)) continue;
    if (!circleIntersectsSector(e.x, e.y, e.radius, s.x, s.y, s.dirX, s.dirY, p.halfAngleCos, p.reach))
      continue;
    s.hitIds.push(e.id);
    const [kx, ky] = directionOr(s.x, s.y, e.x, e.y, s.dirX, s.dirY);
    spellHit(state, s, e, kx, ky, s.dirX, s.dirY);
    if (s.ended) return;
  }
  endSpell(state, s, 'done');
}

/** Swath: hits every enemy touching the strip from the instance along its aim, once each. Ignores walls. */
export function fireSwath(state: GameState, s: SpellInstance): void {
  const p = s.spec.params;
  if (p.form !== 'swath') return;
  const half = p.length / 2;
  const reach = Math.sqrt(half * half + (p.width / 2) * (p.width / 2));
  for (const idx of enemiesTouching(state, s.x + s.dirX * half, s.y + s.dirY * half, reach)) {
    const e = state.enemies[idx]!;
    if (!canTarget(s, e)) continue;
    if (!circleIntersectsLine(e.x, e.y, e.radius, s.x, s.y, s.dirX, s.dirY, p.length, p.width)) continue;
    s.hitIds.push(e.id);
    spellHit(state, s, e, s.dirX, s.dirY, s.dirX, s.dirY);
    if (s.ended) return;
  }
  // It ends at the far end of the strip, where On Expire spawns.
  s.x += s.dirX * p.length;
  s.y += s.dirY * p.length;
  endSpell(state, s, 'done');
}

/** Nova: a ring centered where it spawned, growing from 0 to params.radius over params.expandTime. */
export function initNova(n: SpellInstance): void {
  const p = n.spec.params;
  if (p.form !== 'nova') return;
  n.cx = n.x;
  n.cy = n.y;
  n.lifeLeft = p.expandTime;
}

/** Hits each enemy once as the ring reaches its body; knockback outward. Ends fully expanded. */
export function stepNova(state: GameState, n: SpellInstance): void {
  const p = n.spec.params;
  if (p.form !== 'nova') return;
  n.lifeLeft -= DT;
  const done = n.lifeLeft <= TIME_EPSILON;
  n.radius = done ? p.radius : p.radius * (1 - n.lifeLeft / p.expandTime);
  for (const idx of enemiesTouching(state, n.cx, n.cy, n.radius)) {
    const e = state.enemies[idx]!;
    if (!canTarget(n, e) || n.hitIds.includes(e.id)) continue;
    n.hitIds.push(e.id);
    const [kx, ky] = directionOr(n.cx, n.cy, e.x, e.y, n.dirX, n.dirY);
    spellHit(state, n, e, kx, ky, kx, ky);
    if (n.ended) return;
  }
  if (done) endSpell(state, n, 'done');
}

/**
 * Lob: lands on the aim point clamped to params.range; a branch Lob (randomLandRadius) lands on
 * a uniformly random point within that radius of its origin instead, from state.spellRng.
 */
export function initLob(state: GameState, l: SpellInstance, aimX: number, aimY: number): void {
  const p = l.spec.params;
  if (p.form !== 'lob') return;
  let tx: number;
  let ty: number;
  if (p.randomLandRadius !== null) {
    let ux: number;
    let uy: number;
    do {
      ux = state.spellRng.range(-1, 1);
      uy = state.spellRng.range(-1, 1);
    } while (ux * ux + uy * uy > 1);
    [tx, ty] = clampPoint(
      state.room,
      l.x,
      l.y,
      l.x + ux * p.randomLandRadius,
      l.y + uy * p.randomLandRadius,
      Infinity,
    );
  } else [tx, ty] = clampPoint(state.room, l.x, l.y, aimX, aimY, p.range);
  l.fromX = l.x;
  l.fromY = l.y;
  l.toX = tx;
  l.toY = ty;
  [l.dirX, l.dirY] = unitOr(tx - l.x, ty - l.y, l.dirX, l.dirY);
  l.lifeLeft = p.flightTime;
  l.radius = p.burstRadius;
}

/** Flies (x, y) linearly from launch to landing; on landing bursts, hitting everything in the radius once. */
export function stepLob(state: GameState, l: SpellInstance): void {
  const p = l.spec.params;
  if (p.form !== 'lob') return;
  l.lifeLeft -= DT;
  if (l.lifeLeft > TIME_EPSILON) {
    const t = 1 - l.lifeLeft / p.flightTime;
    l.x = l.fromX + (l.toX - l.fromX) * t;
    l.y = l.fromY + (l.toY - l.fromY) * t;
    return;
  }
  l.x = l.toX;
  l.y = l.toY;
  emit(state, {
    type: 'lobLand',
    id: l.id,
    castId: l.castId,
    elements: elementsOf(l.spec),
    x: l.x,
    y: l.y,
    radius: p.burstRadius,
  });
  for (const idx of enemiesTouching(state, l.x, l.y, p.burstRadius)) {
    const e = state.enemies[idx]!;
    if (!canTarget(l, e)) continue;
    l.hitIds.push(e.id);
    const [kx, ky] = directionOr(l.x, l.y, e.x, e.y, l.dirX, l.dirY);
    spellHit(state, l, e, kx, ky, l.dirX, l.dirY);
    if (l.ended) return;
  }
  endSpell(state, l, 'done');
}
