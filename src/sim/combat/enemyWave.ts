/**
 * The Old Bellwether's attack parts (M8, CONTENT §5), called by combat/enemyAttacks.ts:
 * - Ring wave (AttackDef.wave, the toll ring): when the windup ends a front expands from the
 *   attack's origin to the circle shape's radius over the active phase. It hits the player once,
 *   as it passes their body (within half the wave's width); a player outside the circle never
 *   meets it, and one who dodges through it as it passes takes nothing ('bellWave').
 * - Rolls (AttackDef.roll, the shell roll): a dash planned into a wall stuns it where it ends
 *   ('bellRollStunned'; the plan is ai/bosses/bellwether.ts).
 * The state lives on BossState.fen (actors/bossStateFen.ts); kinds without it never wave or roll.
 */
import type { AttackDef } from '../../../data/enemies';
import type { Enemy } from '../actors/enemies';
import { DT } from '../core/constants';
import { emit } from '../events';
import type { GameState } from '../state';
import type { DamagePacket } from './damage';
import { applyHit, directionOr } from './hits';

/** A front radius that marks a running wave (0 means none). */
const WAVE_START = 1e-6;

/** The wave starts (the windup ended). Returns the active phase's length. */
export function startWave(state: GameState, e: Enemy, def: AttackDef): number {
  const f = e.boss?.fen;
  if (!f || def.shape.kind !== 'circle') return def.active;
  f.waveR = WAVE_START;
  f.waveHit = false;
  const a = e.attack;
  emit(state, { type: 'bellWave', id: e.id, x: a.originX, y: a.originY, radius: def.shape.r, seconds: def.active });
  return def.active;
}

/** One tick of a running wave at action speed `speed`: the front moves out and may hit the player. */
export function stepWave(state: GameState, e: Enemy, def: AttackDef, packet: DamagePacket, speed: number): void {
  const f = e.boss?.fen;
  if (!f || f.waveR <= 0 || def.shape.kind !== 'circle' || !def.wave) return;
  const R = def.shape.r;
  const r0 = f.waveR;
  const r1 = Math.min(R, r0 + (R / def.active) * DT * speed);
  f.waveR = r1;
  const p = state.player;
  if (f.waveHit || p.dead) return;
  const a = e.attack;
  const dx = p.x - a.originX;
  const dy = p.y - a.originY;
  const d = Math.sqrt(dx * dx + dy * dy);
  const reach = state.tuning.player.radius + def.wave.width / 2;
  if (d + reach < r0 || d - reach > r1) return;
  f.waveHit = true;
  const [kx, ky] = directionOr(a.originX, a.originY, p.x, p.y, e.facingX, e.facingY);
  applyHit(state, p, packet, { sourceId: e.id, dirX: kx, dirY: ky, knockback: def.knockback });
}

/** The active phase ended: the wave is gone; a roll planned into a wall stuns its roller. */
export function endBossActive(state: GameState, e: Enemy, def: AttackDef): void {
  const f = e.boss?.fen;
  if (!f) return;
  if (def.wave) f.waveR = 0;
  if (!def.roll || !f.rollWall) return;
  f.rollWall = false;
  e.terrain.stunLeft = def.roll.wallStun;
  e.vx = e.vy = 0;
  emit(state, { type: 'bellRollStunned', id: e.id, seconds: def.roll.wallStun, x: e.x, y: e.y });
}
