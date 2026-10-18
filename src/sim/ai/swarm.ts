import type { AttackDef, BehaviorDef } from '../../../data/enemies';
import type { Enemy } from '../actors/enemies';
import type { GameState } from '../state';
import { attack, faceVelocity, setMode, steerTo, stop, toPlayer } from './common';

type Swarm = Extract<BehaviorDef, { kind: 'swarm' }>;

/**
 * Tinderling: rush the player and nip in range. Each one runs at the player plus its own offset
 * (rolled on aggro) that shrinks as it closes in, so a pack fans out and arrives from several
 * sides instead of queueing in one line. In reach and cooling down, it holds ('hold').
 */
export function stepSwarm(state: GameState, e: Enemy, b: Swarm, def: AttackDef): void {
  const ai = e.ai;
  if (toPlayer.gap <= def.range) {
    if (ai.cooldown <= 0 && ai.los) {
      attack(state, e, def, toPlayer.ux, toPlayer.uy);
      return;
    }
    // In reach but cooling down: hold, facing the player, instead of shoving into their body.
    stop(e);
    e.facingX = toPlayer.ux;
    e.facingY = toPlayer.uy;
    setMode(e, 'hold');
    return;
  }
  const p = state.player;
  const spread = toPlayer.dist * b.offsetPerCell;
  const off = spread < b.offsetMax ? spread : b.offsetMax;
  steerTo(state, e, p.x + ai.offsetX * off, p.y + ai.offsetY * off, 1);
  setMode(e, 'chase');
  faceVelocity(e);
}
