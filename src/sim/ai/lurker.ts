import type { AttackDef, BehaviorDef } from '../../../data/enemies';
import type { Enemy } from '../actors/enemies';
import { dashLineLength, planDash } from '../combat/dash';
import { emit } from '../events';
import type { GameState } from '../state';
import { swimToward } from '../actors/swim';
import { attack, setMode, toPlayer } from './common';
import { swimSpeed } from './leaper';

type Lurker = Extract<BehaviorDef, { kind: 'lurker' }>;

/** Shortest lunge worth making, cells (closer than this it just bites from where it is). */
const MIN_LUNGE = 1;

/**
 * Bog Lurker (CONTENT §5): drifts submerged toward the player through its water ('lurk';
 * M8: along a route through the water, actors/swim.ts, so it waits at the shore nearest them).
 * When the player is within the lunge's range with line of sight, the water lets the lunge
 * reach them and it is off cooldown, it surfaces ('lurkerSurface') and lunges: a 1.2 s ripple telegraph along the planned path, then a
 * dash at 32 cells/s through the water that bites on contact. After the lunge it submerges
 * again ('lurkerSubmerge'). Trapped in ice it does nothing (ai/index.ts).
 */
export function stepLurker(state: GameState, e: Enemy, b: Lurker, def: AttackDef): void {
  const ai = e.ai;
  const s = e.special;
  if (!s.submerged) {
    s.submerged = true;
    emit(state, { type: 'lurkerSubmerge', id: e.id, x: e.x, y: e.y });
  }
  if (toPlayer.gap <= def.range && ai.cooldown <= 0 && ai.los && def.dash) {
    const len = planDash(state, e, def.dash, toPlayer.ux, toPlayer.uy, toPlayer.dist);
    // Only when the water lets the lunge reach them (a player well up the bank is safe).
    const reaches = toPlayer.gap - len <= def.dash.reach;
    const aim = { length: dashLineLength(e, len < MIN_LUNGE ? 0 : len) };
    if (reaches && attack(state, e, def, toPlayer.ux, toPlayer.uy, aim)) {
      s.submerged = false;
      emit(state, { type: 'lurkerSurface', id: e.id, x: e.x, y: e.y });
      return;
    }
  }
  // M8: its route follows the water (actors/swim.ts), borrowed water included.
  const p = state.player;
  if (toPlayer.gap > 0 && swimToward(state, e, p.x, p.y, swimSpeed(e, b.driftSpeed))) setMode(e, 'lurk');
  else {
    e.vx = e.vy = 0;
    setMode(e, 'hold');
  }
  e.facingX = toPlayer.ux;
  e.facingY = toPlayer.uy;
}
