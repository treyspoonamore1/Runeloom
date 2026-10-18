import type { Tuning } from '../../../data/tuning';
import { DT } from '../core/constants';
import { emit } from '../events';
import type { GameState } from '../state';
import type { PlayerState } from './player';
import { cancelCast } from '../weave/runtime/castState';
import { clearAilments } from '../combat/ailments';

type CombatTuning = Tuning['combat'];

/** Timers within this many seconds of zero count as expired (absorbs 1/60 rounding). */
const TIME_EPSILON = 1e-9;

/** Player max life at `level` (DESIGN §7): 80 + 12 × (level − 1). */
export function playerMaxLife(c: CombatTuning, level: number): number {
  return c.playerBaseLife + c.playerLifePerLevel * (level - 1);
}

/** Player max mana at `level` (DESIGN §7): 50 + 4 × (level − 1). */
export function playerMaxMana(c: CombatTuning, level: number): number {
  return c.playerBaseMana + c.playerManaPerLevel * (level - 1);
}

/**
 * Start of the player's tick: counts down to respawn while dead, regenerates mana while alive.
 * Returns true if the player is alive and acts this tick.
 */
export function stepPlayerVitals(state: GameState): boolean {
  const p = state.player;
  if (p.dead) {
    p.respawnLeft -= DT;
    if (p.respawnLeft <= TIME_EPSILON) respawnPlayer(state);
    return false;
  }
  const regen = p.maxMana * state.tuning.combat.manaRegen * DT;
  p.mana = p.mana + regen >= p.maxMana ? p.maxMana : p.mana + regen;
  return true;
}

/** Life reached 0: the player drops, ignores input and respawns after respawnDelay. */
export function killPlayer(state: GameState): void {
  const p = state.player;
  if (p.dead) return;
  cancelCast(state);
  p.life = 0;
  p.dead = true;
  p.respawnLeft = state.tuning.player.respawnDelay;
  p.vx = p.vy = 0;
  p.kbX = p.kbY = 0;
  p.dodgeLeft = 0;
  p.iframesLeft = 0;
  clearAilments(p.ailments);
  emit(state, { type: 'playerDeath', x: p.x, y: p.y });
}

/** Back at the room's spawn point (Loom Stone) with full life, mana and dodges. */
export function respawnPlayer(state: GameState): void {
  const p = state.player;
  const t = state.tuning;
  resetPlayerVitals(p, t);
  p.x = p.prevX = state.room.spawnX;
  p.y = p.prevY = state.room.spawnY;
  p.vx = p.vy = 0;
  p.kbX = p.kbY = 0;
  p.dodgeCharges = t.player.dodgeCharges;
  p.dodgeRechargeLeft = 0;
  p.iframesLeft = t.player.respawnIframes;
  emit(state, { type: 'playerRespawn', x: p.x, y: p.y });
}

/** Full life and mana for the player's level, alive. */
export function resetPlayerVitals(p: PlayerState, t: Tuning): void {
  p.maxLife = playerMaxLife(t.combat, p.level);
  p.maxMana = playerMaxMana(t.combat, p.level);
  p.life = p.maxLife;
  p.mana = p.maxMana;
  p.dead = false;
  p.respawnLeft = 0;
  clearAilments(p.ailments);
}
