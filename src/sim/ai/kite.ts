import type { AttackDef, BehaviorDef, EnemyDef } from '../../../data/enemies';
import type { Enemy } from '../actors/enemies';
import { DT } from '../core/constants';
import type { GameState } from '../state';
import { isSolidCell } from '../world/room';
import { attack, faceVelocity, moveAlong, setMode, steerTo, toPlayer } from './common';

type Kite = Extract<BehaviorDef, { kind: 'kite' }>;

/**
 * Ember Archer: keeps `preferredRange` from the player with line of sight and shoots.
 * - No line of sight: 'reposition', following the flow field until it sees the player again.
 * - Sees the player within attack range and off cooldown: draws (windup) and fires.
 * - Closer than the band: 'retreat' straight away, sliding sideways when a wall is behind it.
 * - Farther than the band: 'chase'.
 * - In the band: 'kite', strafing sideways and switching sides every strafeFlipMin–Max s or when
 *   a wall is ahead.
 */
export function stepKite(state: GameState, e: Enemy, b: Kite, def: AttackDef, kind: EnemyDef): void {
  const ai = e.ai;
  const p = state.player;
  if (!ai.los) {
    steerTo(state, e, p.x, p.y, 1);
    setMode(e, 'reposition');
    faceVelocity(e);
    return;
  }
  if (toPlayer.gap <= def.range && ai.cooldown <= 0) {
    attack(state, e, def, toPlayer.ux, toPlayer.uy);
    return;
  }

  ai.strafeLeft -= DT;
  if (ai.strafeLeft <= 0) flipStrafe(state, e, b);
  const band = kind.preferredRange!;
  const ux = toPlayer.ux;
  const uy = toPlayer.uy;
  if (toPlayer.dist > band.max) {
    steerTo(state, e, p.x, p.y, 1);
    setMode(e, 'chase');
    faceVelocity(e);
    return;
  }
  if (toPlayer.dist < band.min) {
    setMode(e, 'retreat');
    if (!wallAhead(state, e, -ux, -uy, b.wallProbe)) {
      moveAlong(e, -ux, -uy, b.retreatSpeed);
      faceVelocity(e);
      return;
    }
    // Backed against a wall: slide along it, away from the player's side.
  } else {
    setMode(e, 'kite');
  }
  let sx = -uy * ai.strafe;
  let sy = ux * ai.strafe;
  if (wallAhead(state, e, sx, sy, b.wallProbe)) {
    flipStrafe(state, e, b);
    sx = -sx;
    sy = -sy;
  }
  moveAlong(e, sx, sy, ai.mode === 'retreat' ? b.retreatSpeed : b.strafeSpeed);
  faceVelocity(e);
}

function flipStrafe(state: GameState, e: Enemy, b: Kite): void {
  e.ai.strafe = -e.ai.strafe;
  e.ai.strafeLeft = state.aiRng.range(b.strafeFlipMin, b.strafeFlipMax);
}

/** True if the cell `probe` cells from the enemy's edge along the unit direction is unwalkable. */
function wallAhead(state: GameState, e: Enemy, dx: number, dy: number, probe: number): boolean {
  const reach = e.radius + probe;
  return isSolidCell(state.room, Math.floor(e.x + dx * reach), Math.floor(e.y + dy * reach));
}
