import type { DamageAmounts } from '../../../data/combatTypes';
import { enemyDef, isEnemyKind, type EnemyKind } from '../../../data/enemies';
import type { AttackShape } from '../combat/shapes';
import { createAilments, type Ailments } from '../combat/ailments';
import { scaleByLevel } from '../combat/damage';
import { emit } from '../events';
import { createTerrainState, type TerrainState } from './terrainState';
import { rarityLifeMult } from './rarity';
import { createBossState, createEnemySpecial, type BossState, type EnemySpecial } from './enemyState';
import type { GameState } from '../state';
import { riftRules } from '../world/rift/rules';

/** Id of the player in events, `targetId`, `ownerId` and `hitIds`. Entity ids start at 1. */
export const PLAYER_ID = 0;

export type EnemyRarity = 'normal' | 'magic' | 'rare';

export { createBossState, createEnemySpecial, type BossState, type EnemySpecial } from './enemyState';

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
  /**
   * M4: per-kind timers, seconds until each is ready (AI_SLOTS of them, 0 = ready). Index k is
   * the kind's extraAttacks[k] cadence (`every`: Frost Wisp's frost line); the Brood Kiln's spawn
   * timer is slot 0; bosses use them per attack (ai/bosses).
   */
  cooldowns: number[];
}

/** Length of EnemyAI.cooldowns. */
export const AI_SLOTS = 4;

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
    cooldowns: new Array<number>(AI_SLOTS).fill(0),
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
  /** Movement speed × this (rift Hasty, M6); 1 otherwise. */
  speedMult: number;
  rarity: EnemyRarity;
  /** Monster mods (data/monsterMods.ts ids), M4: Magic and Rare monsters. Empty for normal ones. */
  mods: string[];
  /** Died this tick; removed at the end of the step. Dead enemies never act or get hit. */
  dead: boolean;
  ai: EnemyAI;
  attack: EnemyAttackState;
  shield: EnemyShield | null;
  /** M4 chemistry and dash state (EnemySpecial). */
  special: EnemySpecial;
  /** Fight state for bosses (EnemyDef.isBoss), else null. */
  boss: BossState | null;
}

export interface SpawnOptions {
  /** Defaults to the room's level (bosses: their CONTENT §5 level, EnemyDef.level). */
  areaLevel?: number;
  /** Unit facing. Defaults to toward the player (or +y if on top of the player). */
  facingX?: number;
  facingY?: number;
  /** Monster rarity (M4). Default 'normal'. Ignored for bosses. */
  rarity?: EnemyRarity;
  /** Monster mods (data/monsterMods.ts ids), usually rolled with the rarity (actors/rarity.ts). */
  mods?: readonly string[];
  /** The enemy that spawned it (EnemySpecial.parentId). */
  parentId?: number;
}

/**
 * Spawns an enemy at (x, y) cells and returns it. Throws on an unknown kind.
 * Life is base × enemyLifeGrowth^(area level − 1) (DESIGN §7), × the rarity's and mods' life
 * multipliers (Magic ×1.7, Rare ×4, Thick-skinned ×1.4). Bosses have absolute life and no rarity.
 */
export function spawnEnemy(
  state: GameState,
  kind: string,
  x: number,
  y: number,
  opts: SpawnOptions = {},
): Enemy {
  if (!isEnemyKind(kind)) throw new Error(`Unknown enemy kind "${kind}"`);
  const def = enemyDef(kind);
  const boss = def.isBoss === true;
  const areaLevel = opts.areaLevel ?? (boss ? (def.level ?? state.room.level) : state.room.level);
  const rarity: EnemyRarity = boss ? 'normal' : (opts.rarity ?? 'normal');
  const mods = boss ? [] : [...(opts.mods ?? [])];
  let life = boss ? def.life : scaleByLevel(def.life, state.tuning.combat.enemyLifeGrowth, areaLevel);
  if (rarity !== 'normal' || mods.length > 0) life *= rarityLifeMult(rarity, mods);
  // Rift prefixes (M6): Hardened, Resolute, Hasty.
  const rift = riftRules(state);
  life *= 1 + rift.monsterLifeMore;
  const resist = { ...def.resist };
  if (rift.monsterResistAdd !== 0)
    for (const k of ['fire', 'frost', 'storm'] as const) resist[k] += rift.monsterResistAdd;
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
  const special = createEnemySpecial();
  special.submerged = def.behavior.kind === 'lurker';
  special.parentId = opts.parentId ?? -1;
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
    resist,
    ailments: createAilments(),
    terrain: createTerrainState(x, y),
    areaLevel,
    speedMult: 1 + rift.monsterSpeedMore,
    rarity,
    mods,
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
    special,
    boss: boss ? createBossState() : null,
  };
  state.enemies.push(e);
  emit(state, { type: 'enemySpawn', id: e.id, kind, x, y });
  return e;
}

/**
 * Spawns the room's `@spawn` entries (enemies, packs, rarity) and a Brood Kiln on every `&`
 * tile: see actors/roomSpawns.ts.
 */
export { spawnRoomEnemies } from './roomSpawns';

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
