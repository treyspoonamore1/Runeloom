import { enemyDef, type AttackDef, type BehaviorDef } from '../../../data/enemies';
import type { Enemy } from '../actors/enemies';
import { moveSpeedMult } from '../actors/rarity';
import { isWaterCell } from '../actors/locomotion';
import { swimToward } from '../actors/swim';
import { emit } from '../events';
import type { GameState } from '../state';
import { attack, setMode, toPlayer } from './common';

type Leaper = Extract<BehaviorDef, { kind: 'leaper' }>;

const landing = { x: 0, y: 0 };

/**
 * Glasspike (M8, CONTENT §5; the Bog Lurker's ways with a leap): hides submerged, swimming
 * through its water toward the water nearest the player (actors/swim.ts), so it waits at the
 * shore closest to them; only a faint glint shows it. When the player is within its leap's range
 * with line of sight and it is off cooldown, it flashes (the 0.8 s windup, 'telegraph') with the
 * landing circle placed at landingPoint, then leaps in 0.5 s (combat/enemyAttacksM8.ts) and bites
 * on landing. Coming down on dry ground or ice Strands it (rule 31); back in water it submerges
 * again ('lurkerSubmerge'). Trapped in ice or Stranded, it doesn't think (ai/index.ts).
 */
export function stepLeaper(state: GameState, e: Enemy, b: Leaper, def: AttackDef): void {
  const ai = e.ai;
  const s = e.special;
  if (!s.submerged) {
    s.submerged = true;
    emit(state, { type: 'lurkerSubmerge', id: e.id, x: e.x, y: e.y });
  }
  e.facingX = toPlayer.ux;
  e.facingY = toPlayer.uy;
  if (toPlayer.gap <= def.range && ai.cooldown <= 0 && ai.los) {
    const pt = landingPoint(state, b.landReach);
    const dx = pt.x - e.x;
    const dy = pt.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const ux = d > 0 ? dx / d : toPlayer.ux;
    const uy = d > 0 ? dy / d : toPlayer.uy;
    if (attack(state, e, def, ux, uy, { x: pt.x, y: pt.y })) {
      s.submerged = false;
      emit(state, { type: 'lurkerSurface', id: e.id, x: e.x, y: e.y });
      return;
    }
  }
  if (swimToward(state, e, state.player.x, state.player.y, swimSpeed(e, b.driftSpeed))) setMode(e, 'lurk');
  else setMode(e, 'hold');
}

/** A swimmer's speed at `fraction` of its top speed (× Hasted, × rift Hasty), as moveAlong. */
export function swimSpeed(e: Enemy, fraction: number): number {
  const haste = e.mods.length > 0 ? moveSpeedMult(e) : 1;
  return enemyDef(e.kind).speed * fraction * haste * e.speedMult;
}

/**
 * Where a Glasspike lands: the center of the water cell nearest the player within `reach` cells
 * (ties: row-major), else the player's spot. The returned object is shared scratch.
 */
export function landingPoint(state: GameState, reach: number): { x: number; y: number } {
  const p = state.player;
  const g = state.grid;
  landing.x = p.x;
  landing.y = p.y;
  const cx = Math.floor(p.x);
  const cy = Math.floor(p.y);
  const R = Math.ceil(reach);
  let best = reach * reach;
  let found = false;
  for (let y = cy - R; y <= cy + R; y++) {
    if (y < 0 || y >= g.height) continue;
    for (let x = cx - R; x <= cx + R; x++) {
      if (x < 0 || x >= g.width || !isWaterCell(g, y * g.width + x)) continue;
      const dx = x + 0.5 - p.x;
      const dy = y + 0.5 - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best || (!found && d2 === best)) {
        best = d2;
        found = true;
        landing.x = x + 0.5;
        landing.y = y + 0.5;
      }
    }
  }
  return landing;
}
