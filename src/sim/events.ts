import type { DamageAmounts, DamageType } from '../../data/combatTypes';
import type { ElementId, FormId, TriggerId } from '../../data/runes';
import type { GameState } from './state';
import type { FormParams } from './weave/program';
import type { SpellEndReason } from './weave/runtime/types';
import type { EnemyEvent } from './enemyEvents';

/**
 * Things that happened during one step, for render and audio (hit flash, damage numbers,
 * sounds, particles). `state.events` is cleared at the start of every step and never hashed:
 * nothing in the sim reads it back, so it can't affect determinism. The app collects each
 * step's events (Session.drainEvents) because one frame can run several steps.
 *
 * Conventions: positions in cells, times in seconds. Entity ids are stable for an entity's
 * life (`Enemy.id`, `Projectile.id`, `SpellInstance.id`, one id space); the player is id
 * PLAYER_ID (0) and appears as 'player' in `target`. Player Bolts also send the M1
 * 'projectileSpawn' / 'projectileEnd' events (kind '<element>_bolt', e.g. 'fire_bolt'), but live
 * in `state.spells`, not `state.projectiles`.
 */
export type SimEvent =
  /**
   * A Cast-trigger weave began winding up. The spell releases after castRelease seconds, the cast
   * ends after castTime. `spell` (in all four cast events) is the weave's root form id: 'bolt',
   * 'strike', 'nova', … (M1 sent spell ids 'fire_bolt' and 'strike').
   */
  | { type: 'castStart'; slot: number; spell: string; castTime: number; castRelease: number }
  /**
   * A Cast-trigger weave released (mana paid), from the player along the unit aim direction.
   * Automatic triggers send only 'triggerFired'. Sent just before that release's 'triggerFired'.
   */
  | { type: 'cast'; slot: number; spell: string; x: number; y: number; dirX: number; dirY: number }
  /** An unreleased cast was cancelled (dodge, death, freeze, or a Loom edit to its slot). */
  | { type: 'castCancel'; slot: number; spell: string }
  /** A cast button was pressed but the cast couldn't start. Sent on the press only, not while held. */
  | { type: 'castFailed'; slot: number; spell: string; reason: 'mana' }
  /**
   * A weave slot fired (any trigger): its root spell spawns from (x, y) along unit (dirX, dirY).
   * castId groups every instance of this fire's tree. mana: what it cost (paid even with
   * cheats.infiniteMana in the count, not from the bar).
   */
  | {
      type: 'triggerFired';
      slot: number;
      trigger: TriggerId;
      castId: number;
      x: number;
      y: number;
      dirX: number;
      dirY: number;
      mana: number;
    }
  /**
   * A player spell instance appeared (state.spells; see SpellInstance in weave/runtime/types.ts
   * for what to draw per form). elements: in slot order, empty for physical. params: the form's
   * shape numbers (radius, length, width, orbitRadius, reach, …), shared, never mutate.
   * (toX, toY): Lob landing point or Sigil position, else (x, y). followsPlayer: an Orb circling
   * the player (else it circles (x, y) minus its offset). echo: an Echo repeat.
   */
  | {
      type: 'spellSpawn';
      id: number;
      castId: number;
      slot: number;
      form: FormId;
      elements: ElementId[];
      depth: number;
      echo: boolean;
      x: number;
      y: number;
      dirX: number;
      dirY: number;
      toX: number;
      toY: number;
      followsPlayer: boolean;
      params: FormParams;
    }
  /** A player spell instance ended at (x, y). Every spellSpawn gets exactly one, possibly in the same step. */
  | {
      type: 'spellEnd';
      id: number;
      castId: number;
      form: FormId;
      x: number;
      y: number;
      reason: SpellEndReason;
    }
  /**
   * A Beam fired (instant): the line from (fromX, fromY) to where it stopped (a wall, its full
   * length, or the last target it hit), `width` cells wide. hits: the targets it hit directly, in
   * order along the beam (Chain jumps come as 'chainJump').
   */
  | {
      type: 'beamFire';
      id: number;
      castId: number;
      elements: ElementId[];
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      width: number;
      hits: { target: number; x: number; y: number }[];
    }
  /** A Lob landed at (x, y) and bursts with `radius` (its hits follow as 'hit' events). */
  | {
      type: 'lobLand';
      id: number;
      castId: number;
      elements: ElementId[];
      x: number;
      y: number;
      radius: number;
    }
  /** A Chain jump from (fromX, fromY) to enemy `target` at (toX, toY); its hit follows. */
  | {
      type: 'chainJump';
      id: number;
      castId: number;
      target: number;
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
    }
  /** A spawn was dropped because its cast already created program.spawnCap (64) instances. */
  | { type: 'spawnDropped'; castId: number; slot: number; form: FormId; depth: number }
  /** "Closer pays more": a Strike or Nova hit near the player restored `amount` mana; (x, y) is the enemy hit. */
  | { type: 'manaRefund'; amount: number; instanceId: number; x: number; y: number }
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
   * damageType is the type that dealt the most; byType splits amount by type (shared, never
   * mutate). kbX, kbY is the unit knockback direction, 0 if none. x, y is the target's position.
   * sourceId is the attacker (PLAYER_ID for the player). spellId: the player spell instance
   * that dealt it, when there is one.
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
      byType?: DamageAmounts;
      spellId?: number;
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
    }
  /*
   * Chemistry grid events (src/sim/grid). Batched ones carry `count` cells and their inclusive
   * bounds in cell coordinates (minX..maxX, minY..maxY): one per kind per grid tick or per
   * applyElement call, never one per cell. Persistent visuals read state.grid directly; these
   * are for sounds and one-shot effects.
   */
  /** Cells caught fire (rule 1, 2, 6, 14, 26 fire; spread and hits batched separately). */
  | ({ type: 'cellIgnited' } & CellBounds)
  /** Burning cells ran out of fuel (rule 3 results, oil burnt away, placed fire out). */
  | ({ type: 'burntOut' } & CellBounds)
  /** Fire on water made steam (rule 4); the bounds cover the steamed cells. */
  | ({ type: 'steam' } & CellBounds)
  /** Frost froze water into ice or an ice bridge (rules 7, 8). */
  | ({ type: 'iceFormed' } & CellBounds)
  /** Ice bridge cells started their visible cracking (crack progress: grid/query.ts). */
  | ({ type: 'iceBreaking' } & CellBounds)
  /** Ice bridge cells broke back into deep water (rule 25 is the entity side). */
  | ({ type: 'iceBroke' } & CellBounds)
  /**
   * A water body (rule 11) or metal network (rule 12) was electrified: charge event `chargeId`
   * over `cells` cells from (x, y) (the first cell reached, its center). handoff: it came across
   * a water ↔ metal contact (rule 13), not straight from the hit.
   */
  | ({ type: 'waterElectrified' } & ElectrifyFields)
  | ({ type: 'metalElectrified' } & ElectrifyFields)
  /*
   * Entity terrain events (src/sim/actors/terrain.ts, falling.ts, chemistry.ts; combat/arcs.ts).
   * Persistent looks read the entity fields: `terrain.wetLeft` / `oiledLeft` (> 0 while Wet /
   * Oiled), `terrain.onIce`, `terrain.moveMult`, `terrain.blind` and `terrain.stunLeft` on enemies
   * and the player (actors/terrainState.ts), `Enemy.shield` (null once burnt) and its burnLeft.
   */
  /** The target became Wet (stepped into water) or dried off (wetSeconds after leaving it). */
  | { type: 'wetChanged'; target: number | 'player'; wet: boolean; x: number; y: number }
  /** The target became Oiled (stepped on oil) or the oil wore off. */
  | { type: 'oiledChanged'; target: number | 'player'; oiled: boolean; x: number; y: number }
  /**
   * Rule 25: the ground dropped away under the target at (fromX, fromY); it took `damage` (a
   * 'hit' follows) and is back on safe ground at (toX, toY). Draw a fall, don't interpolate.
   */
  | {
      type: 'fell';
      target: number | 'player';
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      damage: number;
    }
  /** A Shieldbearer's wooden shield burnt away (4 s of total burning); `Enemy.shield` is now null. */
  | { type: 'shieldBurned'; id: number; x: number; y: number }
  /**
   * Charged water or metal (rules 11, 12) hit the target once for charge event `chargeId`
   * (`damage` before resistance; its 'hit' follows unless damage is 0 or it was evaded).
   */
  | { type: 'chargeHit'; target: number | 'player'; chargeId: number; damage: number; x: number; y: number }
  /** Rule 19: a Shock arced from one Wet entity to another (its 'hit' follows). */
  | {
      type: 'arc';
      from: number | 'player';
      to: number | 'player';
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    }
  /** A Tinderling got Wet and went out: stunned for `stun` s, takes more damage until it dries. */
  | { type: 'tinderlingDoused'; id: number; x: number; y: number; stun: number }
  /** A doused Tinderling dried off and burns again. */
  | { type: 'tinderlingRelit'; id: number; x: number; y: number }
  /** An enemy became Blind (in smoke or steam, or its target is) or could see again. */
  | { type: 'blindChanged'; id: number; blind: boolean; x: number; y: number }
  /** M4 enemies and bosses: see enemyEvents.ts. */
  | EnemyEvent
  /**
   * An oil barrel exploded at (x, y) (cells): a fire burst of `radius` cells dealing `damage`
   * Fire (already scaled by area level), world-owned. The entity code applies the damage from
   * state.grid.blasts, not from this event.
   */
  | {
      type: 'explosion';
      x: number;
      y: number;
      radius: number;
      damage: number;
      owner: number;
      sourceId: number;
    };

/** Fields of 'waterElectrified' and 'metalElectrified'. */
export interface ElectrifyFields {
  chargeId: number;
  x: number;
  y: number;
  cells: number;
  owner: number;
  sourceId: number;
  handoff: boolean;
}

/** Cell count and inclusive bounds (cells) of a batched grid event. */
export interface CellBounds {
  count: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

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
