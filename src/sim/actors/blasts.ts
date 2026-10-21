/**
 * Explosions (DESIGN §6.2 oil barrels; grid.blasts): every live entity whose body touches the
 * blast takes its Fire damage (already scaled by area level) and is knocked away from its
 * center, if the blast's owner can hurt its team (world-owned blasts hurt everyone). Runs right
 * after the grid tick that recorded them, so each blast lands exactly once.
 */
import { OWNER } from '../../../data/materials';
import { makePacket } from '../combat/damage';
import { applyHit, directionOr } from '../combat/hits';
import type { AilmentTarget } from '../combat/ailments';
import type { Blast } from '../grid/grid';
import { hazardHurts } from '../grid/query';
import type { GameState } from '../state';

export function applyBlasts(state: GameState): void {
  const blasts = state.grid.blasts;
  for (let k = 0; k < blasts.length; k++) applyBlast(state, blasts[k]!);
}

/** One blast on every live entity it touches whose team its owner can hurt (Volatile uses it too). */
export function applyBlast(state: GameState, b: Blast): void {
  const p = state.player;
  if (!p.dead && hazardHurts(b.owner, OWNER.player)) blastHit(state, b, p, state.tuning.player.radius);
  if (!hazardHurts(b.owner, OWNER.enemy)) return;
  // Enemies may be added by kills' side effects; only those alive when the blast lands count.
  const n = state.enemies.length;
  for (let i = 0; i < n; i++) {
    const e = state.enemies[i]!;
    if (!e.dead) blastHit(state, b, e, e.radius);
  }
}

function blastHit(state: GameState, b: Blast, t: AilmentTarget, r: number): void {
  const dx = t.x - b.x;
  const dy = t.y - b.y;
  const reach = b.radius + r;
  if (dx * dx + dy * dy > reach * reach) return;
  const [kx, ky] = directionOr(b.x, b.y, t.x, t.y, 0, 1);
  const packet = makePacket(b.damage, { fire: 1 }, 0, state.tuning.combat.critMultiplier);
  applyHit(state, t, packet, {
    sourceId: b.sourceId,
    dirX: kx,
    dirY: ky,
    knockback: state.tuning.terrain.blastKnockback,
    owner: b.owner,
  });
}
