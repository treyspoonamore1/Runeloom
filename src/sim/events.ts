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
  /**
   * An enemy died. Dummies never send this. killerId dealt the killing damage (PLAYER_ID for the
   * player's spells and ignites; -1 for the console's killall). cause: 'hit', 'dot' (an Ignite
   * tick; credited to whoever applied the Ignite) or 'console'. shattered: it was Frozen when it
   * died (Shatter); a hit shatter also sends a hitstop (feel.hitstopShatter), a DoT one doesn't.
   */
  | {
      type: 'death';
      id: number;
      kind: string;
      x: number;
      y: number;
      killerId: number;
      cause: DeathCause;
      shattered: boolean;
    }
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
  | { type: 'hitstop'; seconds: number }
  /**
   * An ailment took hold or got stronger (combat/ailments.ts). Weaker ones that change nothing
   * send nothing. magnitude: 'ignite' damage per second (before Shock); 'chill' the target's
   * new chill total in points (0–100; slow = 0.3% per point, max 30%, bosses 15%); 'shock' the
   * increased damage taken as a fraction (0.05–0.5). duration: seconds it lasts (chill: until it
   * decays to 0 if nothing adds more). Sent on every frost hit that adds chill.
   */
  | {
      type: 'ailmentApplied';
      target: number | 'player';
      ailment: TimedAilment;
      magnitude: number;
      duration: number;
      sourceId: number;
      x: number;
      y: number;
    }
  /**
   * An ailment ran out (chill: decayed to 0). Not sent when the target dies, respawns or is
   * frozen (freezing consumes chill without this event): clear status icons on those too.
   */
  | { type: 'ailmentEnded'; target: number | 'player'; ailment: TimedAilment; x: number; y: number }
  /** The target froze for `duration` seconds (its chill is consumed; an enemy windup is cancelled). */
  | { type: 'freeze'; target: number | 'player'; duration: number; sourceId: number; x: number; y: number }
  /** The target is no longer frozen (not sent on death). */
  | { type: 'thaw'; target: number | 'player'; x: number; y: number }
  /**
   * Damage over time, batched for damage numbers: the Ignite damage a target took since its last
   * 'dot' event (after Shock). One per burning target every tuning.ailments.dotReportInterval
   * seconds, plus one when the Ignite ends or kills. No hitstop, shake or hit flash for these.
   */
  | {
      type: 'dot';
      target: number | 'player';
      sourceId: number;
      amount: number;
      damageType: DamageType;
      x: number;
      y: number;
    };

export type SimEventType = SimEvent['type'];

export type Team = 'player' | 'enemy';

/** What killed an enemy (see the 'death' event). */
export type DeathCause = 'hit' | 'dot' | 'console';

/** Ailments that send 'ailmentApplied' / 'ailmentEnded' (Freeze has 'freeze' / 'thaw'). */
export type TimedAilment = 'ignite' | 'chill' | 'shock';

export type ProjectileEndReason = 'hit' | 'wall' | 'expired' | 'blocked';

/** Records an event for this step. */
export function emit(state: GameState, e: SimEvent): void {
  state.events.push(e);
}
