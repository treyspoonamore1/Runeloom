import type { DamageAmounts } from '../../../data/combatTypes';
import { enemyDef, isEnemyKind, type EnemyKind } from '../../../data/enemies';
import type { AttackShape } from '../combat/shapes';
import { createAilments, type Ailments } from '../combat/ailments';
import { scaleByLevel } from '../combat/damage';
import { emit } from '../events';
import { createTerrainState, type TerrainState } from './terrainState';
import type { GameState } from '../state';

/** Id of the player in events, `targetId`, `ownerId` and `hitIds`. Entity ids start at 1. */
export const PLAYER_ID = 0;

export type EnemyRarity = 'normal' | 'magic' | 'rare';

export type AttackPhase = 'none' | 'windup' | 'active' | 'recover';

/**
 * The enemy's current attack, written by startEnemyAttack and advanced by stepEnemyAttack
 * (combat/enemyAttacks.ts). Render draws the telegraph from `shape` at (originX, originY)
 * while phase is 'windup'; the hit uses the same shape, locked at windup start.
 */
export interface EnemyAttackState {
  /** none → windup (telegraph) → active (the hit lands on entry) → recover → none. */
  phase: AttackPhase;
  /** Seconds left in the current phase; 0 when phase is 'none'. */
  timeLeft: number;
  /** AttackDef.name of the current or last attack ('' before the first). */
  name: string;
  /** Hit and telegraph area of the current or last attack. */
  shape: AttackShape;
  /** Shape origin in cells (circle center, cone apex, line start). */
  originX: number;
  originY: number;
}

/**
 * Owned by the AI (src/sim/ai). Nothing else reads or writes these after spawn, so the AI
 * agent can give them any meaning; the comments are the intended use.
 */
export interface EnemyAI {
  /**
   * State-machine mode, human-readable for the AI-targets overlay: 'idle', 'chase', 'hold',
   * 'kite', 'retreat', 'reposition', 'windup', 'attack', 'recover'. Starts as 'idle'.
   */
  mode: string;
  /** Seconds spent in the current mode. */
  timer: number;
  /** Entity id being targeted (PLAYER_ID for the player), -1 for none. */
  targetId: number;
  /** Seconds until the enemy may start another attack. */
  cooldown: number;
  /** Line of sight (shots) to the target at the last check. */
  los: boolean;
  /** A straight walkable path to the target at the last check. */
  walkLine: boolean;
  /** Unit approach offset direction, rolled on aggro (swarmers surround with it). */
  offsetX: number;
  offsetY: number;
  /** Strafe side for kiters: 1 (counterclockwise around the target) or -1. */
  strafe: number;
  /** Seconds until the strafe side flips. */
  strafeLeft: number;
}

/** A fresh, idle AI record. */
export function createEnemyAI(): EnemyAI {
  return {
    mode: 'idle',
    timer: 0,
    targetId: -1,
    cooldown: 0,
    los: false,
    walkLine: false,
    offsetX: 0,
    offsetY: 0,
    strafe: 1,
    strafeLeft: 0,
  };
}

/** Shieldbearer's shield (CONTENT §5). Blocks projectiles from within its front arc. */
export interface EnemyShield {
  /** Cosine of the half angle of the blocking arc, around `facing`. */
  halfAngleCos: number;
  /**
   * Seconds of burning left before it is destroyed: counts down while the bearer is Ignited or
   * stands in fire that hurts it (CONTENT §5). At 0 the shield is gone (`Enemy.shield` = null)
   * and a 'shieldBurned' event is sent.
   */
  burnLeft: number;
}

/** One enemy, as plain data. Lives in `state.enemies` in spawn order. */
export interface Enemy {
  /** Stable id, unique for the run (from state.nextId). */
  id: number;
  /** Key into data/enemies.ts. */
  kind: EnemyKind;
  /** Body center in cells. */
  x: number;
  y: number;
  /** Position at the start of the current tick, for render interpolation. */
  prevX: number;
  prevY: number;
  /** Velocity the AI wants this tick, cells/s. Walls clip the motion but not this value. */
  vx: number;
  vy: number;
  /** Knockback velocity, cells/s. Decays each tick and slides along walls. */
  kbX: number;
  kbY: number;
  /** Body radius in cells. */
  radius: number;
  /** Unit vector the enemy faces (shield arc, attack direction). Set by the AI. */
  facingX: number;
  facingY: number;
  life: number;
  maxLife: number;
  resist: DamageAmounts;
  /** Ignite, Chill, Freeze and Shock (combat/ailments.ts). */
  ailments: Ailments;
  /** Wet, Oiled, Blind, ice, stun, charge memory and last safe spot (actors/terrainState.ts). */
  terrain: TerrainState;
  /** Area level its life and damage are scaled for. */
  areaLevel: number;
  rarity: EnemyRarity;
  /** Died this tick; removed at the end of the step. Dead enemies never act or get hit. */
  dead: boolean;
  ai: EnemyAI;
  attack: EnemyAttackState;
  shield: EnemyShield | null;
}

export interface SpawnOptions {
  /** Defaults to the room's level. */
  areaLevel?: number;
  /** Unit facing. Defaults to toward the player (or +y if on top of the player). */
  facingX?: number;
  facingY?: number;
}

/** Spawns an enemy at (x, y) cells and returns it. Throws on an unknown kind. */
export function spawnEnemy(
  state: GameState,
  kind: string,
  x: number,
  y: number,
  opts: SpawnOptions = {},
): Enemy {
  if (!isEnemyKind(kind)) throw new Error(`Unknown enemy kind "${kind}"`);
  const def = enemyDef(kind);
  const areaLevel = opts.areaLevel ?? state.room.level;
  const life = scaleByLevel(def.life, state.tuning.combat.enemyLifeGrowth, areaLevel);
  let fx = opts.facingX ?? state.player.x - x;
  let fy = opts.facingY ?? state.player.y - y;
  const fl = Math.sqrt(fx * fx + fy * fy);
  if (fl > 0) {
    fx /= fl;
    fy /= fl;
  } else {
    fx = 0;
    fy = 1;
  }
  const e: Enemy = {
    id: state.nextId++,
    kind,
    x,
    y,
    prevX: x,
    prevY: y,
    vx: 0,
    vy: 0,
    kbX: 0,
    kbY: 0,
    radius: def.radius,
    facingX: fx,
    facingY: fy,
    life,
    maxLife: life,
    resist: { ...def.resist },
    ailments: createAilments(),
    terrain: createTerrainState(x, y),
    areaLevel,
    rarity: 'normal',
    dead: false,
    ai: createEnemyAI(),
    attack: {
      phase: 'none',
      timeLeft: 0,
      name: '',
      shape: { kind: 'circle', r: 0 },
      originX: x,
      originY: y,
    },
    shield: def.shield ? { halfAngleCos: def.shield.halfAngleCos, burnLeft: def.shield.burnTime } : null,
  };
  state.enemies.push(e);
  emit(state, { type: 'enemySpawn', id: e.id, kind, x, y });
  return e;
}

/**
 * Spawns the room's `@spawn <digit> enemy:<id> [count]` entries at every matching marker.
 * Several enemies on one marker go on a square grid `spawnSpacing` cells apart, row by row,
 * centered on the marker. Packs (`pack:<id>`) arrive in M4 and are skipped.
 */
export function spawnRoomEnemies(state: GameState): void {
  const spacing = state.tuning.enemies.spawnSpacing;
  for (const s of state.room.spawns) {
    if (s.kind !== 'enemy') continue;
    let side = 1;
    while (side * side < s.count) side++;
    const half = (side - 1) / 2;
    for (const m of state.room.spawnMarkers) {
      if (m.marker !== s.marker) continue;
      for (let i = 0; i < s.count; i++) {
        const gx = (i % side) - half;
        const gy = Math.floor(i / side) - half;
        spawnEnemy(state, s.id, m.x + gx * spacing, m.y + gy * spacing);
      }
    }
  }
}

/** Removes dead enemies, keeping the order of the rest. */
export function compactEnemies(state: GameState): void {
  const list = state.enemies;
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const e = list[i]!;
    if (!e.dead) list[n++] = e;
  }
  list.length = n;
}
