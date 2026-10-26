/**
 * Light lure (M8, CONTENT §5 Sparkfly): a lit brazier or a burning cell within lightLure.range
 * cells pulls a Sparkfly to circle there for lightLure.seconds instead of chasing the player
 * (it still zaps a player who comes within reach). It looks for light on its sight cadence
 * (ai/common.ts sightDue) and again when a lure runs out, so a light that keeps burning keeps
 * it: lit braziers gather clouds.
 */
import type { AttackDef, EnemyChemistry } from '../../../data/enemies';
import { TILE_CELLS } from '../core/constants';
import type { Enemy } from '../actors/enemies';
import { actionSpeed } from '../combat/ailments';
import { DT } from '../core/constants';
import { emit } from '../events';
import type { GameState } from '../state';
import { attack, faceVelocity, moveAlong, setMode, sightDue, toPlayer } from './common';

type Lure = NonNullable<EnemyChemistry['lightLure']>;

const light = { x: 0, y: 0 };

/**
 * The nearest light to (x, y) within `range` cells: lit braziers (their tile centers) and burning
 * cells (ties: braziers in object order, then cells row-major). Null if none. Shared scratch.
 */
export function nearestLight(
  state: GameState,
  x: number,
  y: number,
  range: number,
): { x: number; y: number } | null {
  let best = range * range;
  let found = false;
  const half = TILE_CELLS / 2;
  for (const o of state.objects) {
    if (o.kind !== 'brazier' || !o.on) continue;
    const lx = o.tx * TILE_CELLS + half;
    const ly = o.ty * TILE_CELLS + half;
    const d2 = (lx - x) * (lx - x) + (ly - y) * (ly - y);
    if (d2 < best || (!found && d2 === best)) {
      best = d2;
      found = true;
      light.x = lx;
      light.y = ly;
    }
  }
  const g = state.grid;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const R = Math.ceil(range);
  for (let j = Math.max(0, cy - R); j <= Math.min(g.height - 1, cy + R); j++)
    for (let i = Math.max(0, cx - R); i <= Math.min(g.width - 1, cx + R); i++) {
      if (g.fire[j * g.width + i] === 0) continue;
      const dx = i + 0.5 - x;
      const dy = j + 0.5 - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) {
        best = d2;
        found = true;
        light.x = i + 0.5;
        light.y = j + 0.5;
      }
    }
  return found ? light : null;
}

/** A lured Sparkfly's think. Returns true when it is circling a light (its behavior is skipped). */
export function stepLure(state: GameState, e: Enemy, lure: Lure, def: AttackDef): boolean {
  const s = e.special;
  if (s.lureLeft > 0) {
    s.lureLeft -= DT * actionSpeed(state, e);
    if (s.lureLeft <= 0) s.lureLeft = 0;
  }
  if (s.lureLeft <= 0) {
    if (!sightDue(state, e)) return false;
    const l = nearestLight(state, e.x, e.y, lure.range);
    if (l === null) return false;
    s.lureLeft = lure.seconds;
    s.lureX = l.x;
    s.lureY = l.y;
    emit(state, { type: 'sparkflyLured', id: e.id, lightX: l.x, lightY: l.y, seconds: lure.seconds });
  }
  if (
    toPlayer.gap <= def.range &&
    e.ai.cooldown <= 0 &&
    e.ai.los &&
    attack(state, e, def, toPlayer.ux, toPlayer.uy)
  )
    return true;
  orbit(e, lure.orbit);
  setMode(e, 'lured');
  return true;
}

/** Circles (lureX, lureY) at `r` cells: along the tangent, pulled toward the ring. */
function orbit(e: Enemy, r: number): void {
  const s = e.special;
  const dx = e.x - s.lureX;
  const dy = e.y - s.lureY;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) {
    moveAlong(e, 1, 0, 1);
    return;
  }
  const rx = dx / d;
  const ry = dy / d;
  const side = e.ai.strafe;
  const pull = (r - d) / r;
  const mx = -ry * side + rx * pull;
  const my = rx * side + ry * pull;
  const m = Math.sqrt(mx * mx + my * my);
  moveAlong(e, mx / m, my / m, 1);
  faceVelocity(e);
}
