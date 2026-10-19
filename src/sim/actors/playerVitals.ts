import type { Tuning } from '../../../data/tuning';
import { DT } from '../core/constants';
import { emit } from '../events';
import type { GameState } from '../state';
import type { PlayerState } from './player';
import { cancelCast } from '../weave/runtime/castState';
import { clearAilments } from '../combat/ailments';
import { resetTerrainState } from './terrainState';
import { damageTypes } from '../../../data/combatTypes';
import type { HeroMods } from '../hero/mods';

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
 * Max life with the character (HeroMods Core): (level formula + flat) × (1 + increased).
 * Neutral mods give exactly playerMaxLife.
 */
export function heroMaxLife(c: CombatTuning, level: number, mods: HeroMods): number {
  return (playerMaxLife(c, level) + mods.maxLifeAdd) * (1 + mods.maxLifeInc);
}

/** Max mana with the character: (level formula + flat) × (1 + increased). */
export function heroMaxMana(c: CombatTuning, level: number, mods: HeroMods): number {
  return (playerMaxMana(c, level) + mods.maxManaAdd) * (1 + mods.maxManaInc);
}

/** Dodge charges with the character (tuning + Second Wind). */
export function playerDodgeCharges(state: GameState): number {
  return state.tuning.player.dodgeCharges + state.heroMods.dodgeChargesAdd;
}

/** Seconds to regain one dodge charge with the character: tuning ÷ (1 + faster recharge). */
export function playerDodgeRecharge(state: GameState): number {
  return state.tuning.player.dodgeRecharge / (1 + state.heroMods.dodgeRechargeInc);
}

/** Top walking speed with the character, cells/s: tuning × (1 + increased move speed). */
export function playerMoveSpeed(state: GameState): number {
  return state.tuning.player.moveSpeed * (1 + state.heroMods.moveSpeedInc);
}

/**
 * Brings the player in line with the hero and HeroMods after refreshHero: level, max life and
 * mana (current values keep their fraction of the max, so a load at full life stays full),
 * resistances (capped at combat.resistCap). Changes nothing when the numbers didn't change.
 */
export function syncPlayerToHero(state: GameState): void {
  const p = state.player;
  const c = state.tuning.combat;
  const mods = state.heroMods;
  p.level = state.hero.level;
  const life = heroMaxLife(c, p.level, mods);
  if (life !== p.maxLife) {
    p.life = p.maxLife > 0 ? (p.life * life) / p.maxLife : life;
    p.maxLife = life;
  }
  const mana = heroMaxMana(c, p.level, mods);
  if (mana !== p.maxMana) {
    p.mana = p.maxMana > 0 ? (p.mana * mana) / p.maxMana : mana;
    p.maxMana = mana;
  }
  for (const t of damageTypes) p.resist[t] = Math.min(c.resistCap, mods.resistAdd[t]);
  const charges = playerDodgeCharges(state);
  if (p.dodgeCharges > charges) p.dodgeCharges = charges;
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
  const regen = (p.maxMana * state.tuning.combat.manaRegen + state.heroMods.manaRegenAdd) * DT;
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
  resetTerrainState(p.terrain, p.x, p.y);
  emit(state, { type: 'playerDeath', x: p.x, y: p.y });
}

/** Back at the room's spawn point (Loom Stone) with full life, mana and dodges. */
export function respawnPlayer(state: GameState): void {
  const p = state.player;
  const t = state.tuning;
  resetPlayerVitals(p, t, state.heroMods);
  p.x = p.prevX = state.room.spawnX;
  p.y = p.prevY = state.room.spawnY;
  p.vx = p.vy = 0;
  p.kbX = p.kbY = 0;
  p.dodgeCharges = playerDodgeCharges(state);
  p.dodgeRechargeLeft = 0;
  p.iframesLeft = t.player.respawnIframes;
  resetTerrainState(p.terrain, p.x, p.y);
  emit(state, { type: 'playerRespawn', x: p.x, y: p.y });
}

/** Full life and mana for the player's level and character (default: none), alive. */
export function resetPlayerVitals(p: PlayerState, t: Tuning, mods?: HeroMods): void {
  p.maxLife = mods ? heroMaxLife(t.combat, p.level, mods) : playerMaxLife(t.combat, p.level);
  p.maxMana = mods ? heroMaxMana(t.combat, p.level, mods) : playerMaxMana(t.combat, p.level);
  p.life = p.maxLife;
  p.mana = p.maxMana;
  p.dead = false;
  p.respawnLeft = 0;
  clearAilments(p.ailments);
}
