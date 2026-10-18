import { Rng } from './core/rng';
import { buildRoom, parseRoom, type Room } from './world/room';
import { createPlayer, type PlayerState } from './actors/player';
import { spawnRoomEnemies, type Enemy } from './actors/enemies';
import type { Projectile } from './combat/projectiles';
import { defaultLoadout, type Loadout } from './combat/casting';
import { SpatialHash } from './core/spatialHash';
import { SPATIAL_BUCKET_CELLS } from './core/constants';
import type { SimEvent } from './events';
import { cloneTuning, type Tuning } from '../../data/tuning';
import { createFlowField, type FlowField } from './ai/flowField';
import { createArenaState, type ArenaState } from './world/waves';

/**
 * How the room plays. 'sandbox': only the room's @spawn enemies. 'arena': endless waves of
 * enemies (src/sim/world/waves.ts).
 */
export type GameMode = 'sandbox' | 'arena';

/** Debug toggles that change the simulation. Hashed, so replays record them. */
export interface Cheats {
  /** The player takes no damage (hits still land and show). */
  god: boolean;
  /** Enemy AI frozen: enemies keep whatever velocity and facing they have (tests, debugging). */
  noAI?: boolean;
}

/** The complete simulation state. Everything the sim needs to continue lives here. */
export interface GameState {
  /** Ticks stepped since creation (hitstop ticks included). */
  tick: number;
  seed: number;
  mode: GameMode;
  cheats: Cheats;
  /** General stream. Systems that roll often should fork their own (see combatRng). */
  rng: Rng;
  /** Crit rolls only, forked from the seed at creation, so other randomness never shifts crits. */
  combatRng: Rng;
  /** Enemy AI rolls only (approach offsets, strafe sides, reaction jitter, wave spawn points). */
  aiRng: Rng;
  tuning: Tuning;
  room: Room;
  player: PlayerState;
  /** Spell in each weave slot (LMB, RMB, Q, E). M2 replaces it with compiled weaves. */
  loadout: Loadout;
  /** Live enemies in spawn order (dead ones are removed at the end of each step). */
  enemies: Enemy[];
  /** Live projectiles in spawn order (ended ones are removed at the end of each step). */
  projectiles: Projectile[];
  /**
   * Path costs toward the player's tile for enemies without a straight path (ai/flowField.ts).
   * Its cost array is a pure function of the room and `flow.goalTile`, so only goalTile and
   * builtTick are hashed.
   */
  flow: FlowField;
  /** Arena wave progress; only advances in 'arena' mode (world/waves.ts). Hashed. */
  arena: ArenaState;
  /** Next entity id. Ids start at 1 (0 is the player) and are never reused. */
  nextId: number;
  /** Seconds of hitstop left: while > 0 a step only counts it down (DESIGN §4). */
  hitstopLeft: number;
  /**
   * Live enemies bucketed by position: derived data, rebuilt during every step and not hashed.
   * Query indices refer to `enemies` and are valid until the end of the current step.
   */
  enemyHash: SpatialHash;
  /** What happened during the last step, for render and audio. Cleared each step, never hashed. */
  events: SimEvent[];
  /** Buttons held on the previous tick, for press detection. */
  prevButtons: number;
}

export interface CreateGameOptions {
  seed: number;
  /** Room file text (CONTENT §6). */
  roomText: string;
  tuning?: Tuning;
  /** Spawn the room's `@spawn enemy:` entries (default: true, except in arena mode). */
  spawnRoomEnemies?: boolean;
  /** Default 'sandbox'. */
  mode?: GameMode;
}

export function createGame(opts: CreateGameOptions): GameState {
  const tuning = cloneTuning(opts.tuning);
  const room = buildRoom(parseRoom(opts.roomText));
  const rng = new Rng(opts.seed);
  const combatRng = rng.fork('combat');
  const aiRng = rng.fork('ai');
  const mode = opts.mode ?? 'sandbox';
  const state: GameState = {
    tick: 0,
    seed: opts.seed,
    mode,
    cheats: { god: false },
    rng,
    combatRng,
    aiRng,
    tuning,
    room,
    player: createPlayer(room.spawnX, room.spawnY, tuning),
    loadout: defaultLoadout(),
    enemies: [],
    projectiles: [],
    flow: createFlowField(room),
    arena: createArenaState(tuning, room.level),
    nextId: 1,
    hitstopLeft: 0,
    enemyHash: new SpatialHash(room.width, room.height, SPATIAL_BUCKET_CELLS),
    events: [],
    prevButtons: 0,
  };
  if (opts.spawnRoomEnemies ?? mode !== 'arena') spawnRoomEnemies(state);
  state.enemyHash.rebuild(state.enemies);
  return state;
}
