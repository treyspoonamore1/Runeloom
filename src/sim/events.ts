import type { DamageType } from '../../data/combatTypes';
import type { SpellId } from '../../data/spells';
import type { GameState } from './state';

/**
 * Things that happened during one step, for render and audio (hit flash, damage numbers,
 * sounds, particles). `state.events` is cleared at the start of every step and never hashed:
 * nothing in the sim reads it back, so it can't affect determinism. The app collects each
 * step's events (Session.drainEvents) because one frame can run several steps.
 *
 * Conventions: positions in cells, times in seconds. Entity ids are stable for an entity's
 * life (`Enemy.id`, `Projectile.id`); the player is id PLAYER_ID (0) and appears as 'player'
 * in `target`.
 */
export type SimEvent =
  /** A cast began winding up. The spell releases after castRelease seconds, the cast ends after castTime. */
  | { type: 'castStart'; slot: number; spell: SpellId; castTime: number; castRelease: number }
  /** A cast released its spell (mana paid). dir is the unit aim direction it was released along. */
  | { type: 'cast'; slot: number; spell: SpellId; x: number; y: number; dirX: number; dirY: number }
  /** An unreleased cast was cancelled (dodge or death). */
  | { type: 'castCancel'; slot: number; spell: SpellId }
  /** A cast button was pressed but the cast couldn't start. Sent on the press only, not while held. */
  | { type: 'castFailed'; slot: number; spell: SpellId; reason: 'mana' }
  | {
      type: 'projectileSpawn';
      id: number;
      kind: string;
      team: Team;
      ownerId: number;
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
    }
  /** A projectile is gone. x, y is where it ended (its last clear position for 'wall'). */
  | { type: 'projectileEnd'; id: number; kind: string; x: number; y: number; reason: ProjectileEndReason }
  /**
   * Damage landed. amount is after every multiplier (fractional; round for display).
   * damageType is the type that dealt the most. kbX, kbY is the unit knockback direction, 0 if none.
   * x, y is the target's position. sourceId is the attacker (PLAYER_ID for the player).
   */
  | {
      type: 'hit';
      target: number | 'player';
      sourceId: number;
      amount: number;
      crit: boolean;
      damageType: DamageType;
      x: number;
      y: number;
      kbX: number;
      kbY: number;
    }
  /** A hit on the player was ignored because of i-frames. */
  | { type: 'evaded'; x: number; y: number; sourceId: number }
  /** An enemy died. Dummies never send this. */
  | { type: 'death'; id: number; kind: string; x: number; y: number }
  | { type: 'enemySpawn'; id: number; kind: string; x: number; y: number }
  | { type: 'playerDeath'; x: number; y: number }
  | { type: 'playerRespawn'; x: number; y: number }
  /** A dodge started. dir is its unit direction. */
  | { type: 'dodge'; x: number; y: number; dirX: number; dirY: number }
  /** An enemy began an attack windup: draw `enemy.attack.shape` until the phase leaves 'windup'. */
  | { type: 'telegraph'; id: number; attack: string; windup: number }
  /** An enemy attack landed (its shape was applied, or its projectile fired). */
  | { type: 'attack'; id: number; attack: string; x: number; y: number }
  /** A shield blocked a projectile. x, y is the projectile's position. */
  | { type: 'shieldBlock'; id: number; projectileId: number; x: number; y: number }
  /** The sim freezes for `seconds` from the next step (the longest pending hitstop). */
  | { type: 'hitstop'; seconds: number };

export type SimEventType = SimEvent['type'];

export type Team = 'player' | 'enemy';

export type ProjectileEndReason = 'hit' | 'wall' | 'expired' | 'blocked';

/** Records an event for this step. */
export function emit(state: GameState, e: SimEvent): void {
  state.events.push(e);
}
