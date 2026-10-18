import { Hasher } from './core/hash';
import type { GameState } from './state';

/**
 * Hash of all simulation state that affects the future. Two runs with the same
 * seed and inputs must produce the same hash on every tick. Add every new piece
 * of sim state here when you add it to GameState.
 */
export function hashState(state: GameState): number {
  const h = new Hasher();
  h.u32(state.tick).u32(state.seed).u32(state.prevButtons);
  for (const w of state.rng.getState()) h.u32(w);
  h.string(state.room.id);
  const p = state.player;
  h.num(p.x).num(p.y).num(p.vx).num(p.vy);
  h.num(p.aimDirX).num(p.aimDirY).num(p.faceX).num(p.faceY);
  h.num(p.dodgeCharges).num(p.dodgeRechargeLeft).num(p.dodgeLeft);
  h.num(p.dodgeDirX).num(p.dodgeDirY).num(p.iframesLeft);
  return h.digest();
}

export function hashHex(n: number): string {
  return (n >>> 0).toString(16).padStart(8, '0');
}
