/**
 * Orb and Sigil (CONTENT §1.2): instances that live for a duration and Emit.
 * - Orb circles its center at params.orbitRadius, starting along its aim, turning by
 *   params.tickRotation every tick (no trig). It hits each target at most every
 *   params.hitInterval. The center is the player when the spell started at the player
 *   (SpawnAt.fromPlayer), otherwise the point it spawned at.
 * - Sigil sits at its aim point (clamped to params.range) and only emits.
 */
import { directionOr } from '../../../combat/hits';
import { DT } from '../../../core/constants';
import type { GameState } from '../../../state';
import { clampPoint, enemiesTouching } from '../geom';
import { canTarget, spellHit, stepEmits, TIME_EPSILON } from '../procs';
import { endSpell } from '../spawn';
import { paintOrb } from '../terrain';
import type { SpellInstance } from '../types';

export function initOrb(state: GameState, o: SpellInstance, fromPlayer: boolean): void {
  const p = o.spec.params;
  if (p.form !== 'orb') return;
  o.followsPlayer = fromPlayer;
  o.cx = fromPlayer ? state.player.x : o.x;
  o.cy = fromPlayer ? state.player.y : o.y;
  o.x = o.prevX = o.cx + o.dirX * p.orbitRadius;
  o.y = o.prevY = o.cy + o.dirY * p.orbitRadius;
  o.toX = o.x;
  o.toY = o.y;
  o.radius = p.radius;
  o.lifeLeft = p.duration;
}

export function stepOrb(state: GameState, o: SpellInstance): void {
  const p = o.spec.params;
  if (p.form !== 'orb') return;
  const pl = state.player;
  if (o.followsPlayer && !pl.dead) {
    o.cx = pl.x;
    o.cy = pl.y;
  }
  const r = p.tickRotation;
  const dx = o.dirX * r.cos - o.dirY * r.sin;
  const dy = o.dirX * r.sin + o.dirY * r.cos;
  o.dirX = dx;
  o.dirY = dy;
  o.x = o.cx + dx * p.orbitRadius;
  o.y = o.cy + dy * p.orbitRadius;

  for (let i = 0; i < o.hitCooldowns.length; i++) o.hitCooldowns[i]! -= DT;
  for (const idx of enemiesTouching(state, o.x, o.y, o.radius)) {
    const e = state.enemies[idx]!;
    if (!canTarget(o, e)) continue;
    const k = o.hitIds.indexOf(e.id);
    if (k >= 0 && o.hitCooldowns[k]! > TIME_EPSILON) continue;
    if (k >= 0) o.hitCooldowns[k] = p.hitInterval;
    else {
      o.hitIds.push(e.id);
      o.hitCooldowns.push(p.hitInterval);
    }
    const [kx, ky] = directionOr(o.cx, o.cy, e.x, e.y, dx, dy);
    // Its direction of travel: the offset turned a quarter in the orbit's sense.
    const ts = r.sin >= 0 ? 1 : -1;
    spellHit(state, o, e, kx, ky, -dy * ts, dx * ts);
    if (o.ended) return;
  }
  paintOrb(state, o, DT);
  stepEmits(state, o);
  if (o.ended) return;
  o.lifeLeft -= DT;
  if (o.lifeLeft <= TIME_EPSILON) {
    // On Expire aims along its last direction of travel.
    const ts = r.sin >= 0 ? 1 : -1;
    o.dirX = -dy * ts;
    o.dirY = dx * ts;
    endSpell(state, o, 'expired');
  }
}

export function initSigil(state: GameState, s: SpellInstance, aimX: number, aimY: number): void {
  const p = s.spec.params;
  if (p.form !== 'sigil') return;
  const [x, y] = clampPoint(state.room, s.x, s.y, aimX, aimY, p.range);
  s.x = s.prevX = s.toX = s.cx = x;
  s.y = s.prevY = s.toY = s.cy = y;
  s.lifeLeft = p.duration;
}

export function stepSigil(state: GameState, s: SpellInstance): void {
  stepEmits(state, s);
  if (s.ended) return;
  s.lifeLeft -= DT;
  if (s.lifeLeft <= TIME_EPSILON) endSpell(state, s, 'expired');
}
