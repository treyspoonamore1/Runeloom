/**
 * The Fen's shelled kinds (M8, CONTENT §5):
 * - hotShell (Slagshell, the Cinder Warden's Superheat generalized): Hot, it takes hotTaken ×
 *   damage and can't be chilled or frozen (combat/ailments.ts isImmune). Getting Wet (standing
 *   in water, Tide) quenches it in a puff of steam: Cracked, crackedTaken × damage taken,
 *   crackedSpeed × move speed, chill works. Cracked is held while Wet and lasts crackedSeconds
 *   after it dries; then it is Hot again.
 * - bell (Bellshell; shared with the Old Bellwether): shelled, shelledTaken × damage. A ring
 *   (actors/fenChemistry.ts chargeTouched: charge of another team or the world through what it
 *   stands on) stuns it and opens the shell for openSeconds (openTaken ×), then it can't ring for
 *   cooldown s.
 */
import type { EnemyChemistry } from '../../../data/enemies';
import { DT } from '../core/constants';
import { emit } from '../events';
import { newBatch } from '../grid/cells';
import { steamAround } from '../grid/elements';
import { flush } from '../grid/fx';
import type { GameState } from '../state';
import type { Enemy } from './enemies';
import { cellOf } from './swim';
import { isWet } from './terrainState';

type HotShell = NonNullable<EnemyChemistry['hotShell']>;
type Bell = NonNullable<EnemyChemistry['bell']>;

const TIME_EPSILON = 1e-9;
const steamBatch = newBatch();

/** A Slagshell's crust is Hot (it takes less damage and can't be chilled). */
export function isHot(e: Enemy): boolean {
  return e.special.hot;
}

export function hotTakenMult(e: Enemy, h: HotShell): number {
  return e.special.hot ? h.hotTaken : h.crackedTaken;
}

export function stepHotShell(state: GameState, e: Enemy, h: HotShell): void {
  const s = e.special;
  if (isWet(e)) {
    if (s.hot) quench(state, e, h);
    s.crackedLeft = h.crackedSeconds;
    return;
  }
  if (s.hot) return;
  s.crackedLeft -= DT;
  if (s.crackedLeft > TIME_EPSILON) return;
  s.crackedLeft = 0;
  s.hot = true;
  emit(state, { type: 'slagReheated', id: e.id, x: e.x, y: e.y });
}

function quench(state: GameState, e: Enemy, h: HotShell): void {
  e.special.hot = false;
  emit(state, { type: 'slagQuenched', id: e.id, seconds: h.crackedSeconds, x: e.x, y: e.y });
  const i = cellOf(state, e.x, e.y);
  if (i < 0) return;
  steamAround(state, i, 1, steamBatch);
  flush(state, 'steam', steamBatch);
}

export function bellTakenMult(e: Enemy, b: Bell): number {
  return e.special.openLeft > 0 ? b.openTaken : b.shelledTaken;
}

/** Rings the bell (stun, shell open) unless it is already open or ringing is on cooldown. */
export function ringBell(state: GameState, e: Enemy, b: Bell): boolean {
  const s = e.special;
  if (s.openLeft > 0 || s.ringCooldown > 0) return false;
  s.openLeft = b.openSeconds;
  e.terrain.stunLeft = b.stun;
  e.vx = e.vy = 0;
  if (e.attack.phase === 'windup') {
    e.attack.phase = 'none';
    e.attack.timeLeft = 0;
  }
  emit(state, { type: 'bellRung', id: e.id, stun: b.stun, open: b.openSeconds, x: e.x, y: e.y });
  return true;
}

export function stepBell(state: GameState, e: Enemy, b: Bell): void {
  const s = e.special;
  if (s.ringCooldown > 0) s.ringCooldown = s.ringCooldown > DT + TIME_EPSILON ? s.ringCooldown - DT : 0;
  if (s.openLeft <= 0) return;
  s.openLeft -= DT;
  if (s.openLeft > TIME_EPSILON) return;
  s.openLeft = 0;
  s.ringCooldown = b.cooldown;
  emit(state, { type: 'bellClosed', id: e.id, cooldown: b.cooldown, x: e.x, y: e.y });
}
