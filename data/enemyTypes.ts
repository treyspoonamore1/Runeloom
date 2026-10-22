/**
 * Types of the enemy tables (data/enemies.ts, data/bosses.ts). Units: cells, seconds, cells per
 * second; resistances are fractions (0.75 = 75%).
 */
import type { AilmentKind, DamageAmounts, DamageType, ProjectileDef } from './combatTypes';

/**
 * Attack area relative to the attacker. `offset` is how far forward of the enemy's center the
 * shape's origin sits: the circle's center, the cone's apex or the line's start.
 * Cone and arc widths are stored as the cosine of the half angle, so the sim needs no trig.
 */
export type AttackShapeDef =
  | { kind: 'circle'; r: number; offset: number }
  | { kind: 'cone'; r: number; halfAngleCos: number; offset: number }
  | { kind: 'line'; length: number; width: number; offset: number };

/**
 * What an attack does to the chemistry grid when it lands (M4), over its own shape: an element
 * through applyElement (fire: placed fire, steam on water; frost: freezes water; storm:
 * electrifies water and metal with the attack's damage), or an oil splat. Owned by the enemy team.
 */
export type AttackTerrainDef =
  | { kind: 'element'; element: 'fire' | 'frost' | 'storm' }
  /**
   * Oil on every walkable or water cell within `radius` of the shape's origin. `tar` (the Tar
   * Matriarch's globs): the oil is volatile tar, and fire on it is world-owned whoever lit it, so
   * it hurts everyone (CONTENT §5).
   */
  | { kind: 'oil'; radius: number; tar?: boolean };

/**
 * A dash attack (M4: Bog Lurker lunge, Cinder Warden charge): on landing, the enemy runs along
 * the attack's line at `speed` for the line's length (stopping at walls, or for aquatic kinds at
 * the water's edge) and hits the player once on contact. The telegraph line covers the path.
 */
export interface DashDef {
  speed: number;
  /** Longest dash, cells (shorter when a wall is closer). */
  maxLength: number;
  /** Extra contact reach beyond the two bodies' edges, cells. */
  reach: number;
  /** Leaves placed fire (rule 26) along its path, this radius around its center. */
  fireTrailRadius?: number;
  /** Leaves the Tar Matriarch's tar (oil whose fire is world-owned) along its path, this radius around its center. */
  tarTrailRadius?: number;
}

export interface AttackDef {
  /** Id shown in events ('telegraph', 'attack'), e.g. for sounds. Unique within a kind. */
  name: string;
  /** Hit damage at area level 1 (bosses: absolute). 0: the attack deals no damage (terrain only). */
  damage: number;
  damageType: DamageType;
  /** Telegraph seconds before the attack lands (DESIGN §14: ≥ 0.4 s if damage ≥ 15% of player life). */
  windup: number;
  /** Seconds the attack shows as landing. The hit itself happens once, as it starts (dashes: during it). */
  active: number;
  /** Seconds after `active` before the enemy is free again. */
  recover: number;
  /** AI hint: seconds from one attack's start to the next. */
  cooldown: number;
  /** AI hint: start attacking when the gap between the two bodies' edges is at most this. */
  range: number;
  /** Knockback distance applied to the player, cells. */
  knockback: number;
  /** Telegraph and hit area. For projectile attacks it shows the flight path. */
  shape: AttackShapeDef;
  /** If set, the attack fires this projectile along its direction instead of hitting its shape. */
  projectile?: ProjectileDef;
  /**
   * The shape is placed at a point the AI picks (Stormcaller strike, Tar glob) instead of in
   * front of the enemy; `offset` is ignored. The AI may pick points up to `range` cells away.
   */
  targeted?: boolean;
  /** Terrain the attack leaves when it lands (M4). */
  terrain?: AttackTerrainDef;
  /** The attack is a dash along its line shape (M4). */
  dash?: DashDef;
  /**
   * AI hint for secondary attacks (`EnemyDef.extraAttacks`): seconds between uses, on its own
   * timer (EnemyAI.cooldowns). The first use waits a random 0–100% of it after aggro.
   */
  every?: number;
}

/**
 * How the AI (src/sim/ai) drives a kind. Distances in cells, times in seconds, speeds as a
 * fraction of the kind's `speed`, turn rates in radians per second.
 */
export type BehaviorDef =
  /** Never moves or attacks (dummies). */
  | { kind: 'none' }
  /**
   * Rushes the player. Each enemy aims at the player plus its own random offset of
   * min(distance × offsetPerCell, offsetMax) cells, so a pack fans out and surrounds instead of
   * queueing in a line.
   */
  | { kind: 'swarm'; offsetPerCell: number; offsetMax: number }
  /**
   * Advances with its shield up. Facing turns toward the player at most `turnRate`, so a player
   * circling fast enough gets behind it. Bashes only when the player is in range and within
   * ±acos(bashArcCos) of its facing; never turns while attacking.
   */
  | { kind: 'shield'; turnRate: number; bashArcCos: number }
  /**
   * Holds `preferredRange` with line of sight: backs off at `retreatSpeed` when the player is
   * closer than its min (without stopping to shoot inside `panicRange`, unless a wall is behind
   * it), strafes sideways at `strafeSpeed` inside the band while drifting toward its middle
   * (switching side every strafeFlipMin–strafeFlipMax s, or when a wall is within `wallProbe`
   * cells ahead), closes in when farther, and follows the flow field to regain line of sight.
   */
  | {
      kind: 'kite';
      panicRange: number;
      strafeSpeed: number;
      retreatSpeed: number;
      strafeFlipMin: number;
      strafeFlipMax: number;
      wallProbe: number;
    }
  /**
   * Bog Lurker (M4): stays in water, drifting submerged toward the nearest water to the player at
   * `driftSpeed`; lunges (its dash attack) when the player is within the attack's range.
   */
  | { kind: 'lurker'; driftSpeed: number }
  /**
   * Brood Kiln (M4): never moves. Once the player comes within aggroRange (no sight needed: it
   * sits inside its own solid tile) it spawns `count` of `spawn` every `interval` s while fewer
   * than `maxAlive` of its brood live, `distance` cells from its center. Frozen: no spawning.
   */
  | { kind: 'spawner'; spawn: string; count: number; interval: number; maxAlive: number; distance: number }
  /** A boss with its own state machine (src/sim/ai/bosses). */
  | { kind: 'boss'; boss: 'tar_matriarch' | 'cinder_warden' };

/** How a kind moves over the grid (M4). Missing means 'walk'. */
export type Locomotion =
  /** Walks: walls, water, pits and bramble block it (room.solid). */
  | 'walk'
  /**
   * Floats (Frost Wisp): only shot-blocking cells (walls, objects) block it; it passes over
   * water, pits and bramble, never falls, and ignores the ground (no Wet, Oiled, burning ground
   * or charge).
   */
  | 'float'
  /**
   * Swims (Bog Lurker): only water cells (shallow, deep, oily) are open to it. It never falls.
   * When its water freezes under it, it is trapped until the ice thaws.
   */
  | 'swim'
  /** Never moves and ignores the ground (Brood Kiln, which sits inside its own solid tile). */
  | 'fixed';

export interface EnemyDef {
  name: string;
  /** Max life at area level 1 (bosses: absolute). */
  life: number;
  /** Top move speed, cells per second (AI hint; the AI sets the velocity). */
  speed: number;
  /** Body radius in cells. */
  radius: number;
  resist: DamageAmounts;
  /** Multiplier on knockback this enemy receives (0: never moved by hits). */
  knockbackScale: number;
  /** AI hint: notices the player within this many cells. */
  aggroRange: number;
  /** AI hint for kiters: preferred distance band to the player, cells. */
  preferredRange?: { min: number; max: number };
  attack: AttackDef | null;
  /** More attacks, by name (M4): secondary attacks with `every`, and boss attacks. */
  extraAttacks?: readonly AttackDef[];
  behavior: BehaviorDef;
  /** Front-arc shield that blocks projectiles (Shieldbearer). */
  shield?: { halfAngleCos: number; burnTime: number };
  /** Training dummies: at 0 life they reset to full instead of dying (DESIGN §5.5). */
  immortal?: boolean;
  /** Drawn and heard as this kind (the rift bosses wear their region originals' art and sounds). */
  lookAs?: string;
  /** Ailments this kind never suffers (CONTENT §5), e.g. Tinderlings can't be ignited. */
  immune?: readonly AilmentKind[];
  /**
   * Bosses (CONTENT §5): the boss chill rule (DESIGN §6.4), absolute life and damage (no area
   * level scaling, no monster rarity), and they never leash.
   */
  isBoss?: boolean;
  /** Bosses: the area level they are fought at (CONTENT §5), for drops; default the room's. */
  level?: number;
  /** How it moves over the grid (M4). Default 'walk'. */
  locomotion?: Locomotion;
  /** Terrain behavior (CONTENT §5 "Chemistry", M3). Missing means none. */
  chemistry?: EnemyChemistry;
}

export interface EnemyChemistry {
  /**
   * Always burning (Tinderling): lights the flammable cells it crosses as an enemy-owned fire
   * (rule 22) and leaves fire where it dies. While Wet it is out: stunned for `dousedStun` s when
   * it goes out, and takes `dousedDamageTaken` × damage until it dries.
   */
  alwaysBurning?: {
    dousedStun: number;
    dousedDamageTaken: number;
    /** Radius (cells, from its cell's center) of the enemy-owned fire it leaves on death: 1.5 = 3×3. */
    deathFireRadius: number;
  };
  /** Its projectiles that miss (hit a wall or fly out) ignite flammable cells within this radius of where they land. */
  missIgniteRadius?: number;
  /** Walks through hazards that hurt it instead of avoiding them (Tinderlings don't care). */
  ignoresHazards?: boolean;
  /** Always Wet, wherever it is (Bog Lurker). */
  alwaysWet?: boolean;
  /** Leaves oil on the cells within this radius of its center as it walks (Tar Hulk). */
  oilTrailRadius?: number;
  /**
   * Ignited while Oiled, it explodes `fuse` s later (Tar Hulk): a world-owned fire burst of
   * `radius` cells for `damage` Fire (scaled like enemy damage) that hurts everyone, and it dies.
   * Getting Wet puts the fuse out; dying with a lit fuse explodes at once.
   */
  explodes?: { fuse: number; radius: number; damage: number };
  /**
   * Ignited while Oiled, it flares `fuse` s later and lives (Tar Matriarch, CONTENT §5): the same
   * world-owned fire burst as `explodes` (`radius` cells, `damage` Fire, absolute for bosses)
   * hurts everyone else in it, and it takes `selfDamage` Fire itself. Then it can't flare again
   * for `cooldown` s. Getting Wet puts the fuse out; dying with a lit fuse flares at once.
   */
  flare?: { fuse: number; radius: number; damage: number; selfDamage: number; cooldown: number };
  /**
   * Its targeted attack aims at the water or metal cell nearest the player within this many
   * cells of them, when there is one, instead of at the player (Stormcaller).
   */
  conductorTarget?: number;
}
