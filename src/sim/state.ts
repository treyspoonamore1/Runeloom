import { Rng } from './core/rng';
import { buildRoom, parseRoom, type Room } from './world/room';
import { createPlayer, type PlayerState } from './actors/player';
import { spawnRoomEnemies, type Enemy } from './actors/enemies';
import type { Projectile } from './combat/projectiles';
import {
  createWeaveLoadout,
  DEFAULT_LOADOUT,
  legacyLoadout,
  type Loadout,
  type LoadoutSpec,
  type WeaveLoadout,
} from './weave/runtime/loadout';
import type {
  CastRecord,
  PendingSpawn,
  SpellInstance,
  SpellStats,
  TriggerQueueEntry,
} from './weave/runtime/types';
import { SpatialHash } from './core/spatialHash';
import { SPATIAL_BUCKET_CELLS } from './core/constants';
import type { SimEvent } from './events';
import { cloneTuning, type Tuning } from '../../data/tuning';
import { createFlowField, type FlowField } from './ai/flowField';
import { createArenaState, type ArenaState } from './world/waves';
import { createGrid, type Grid } from './grid/grid';
import { createLabState, type LabState } from './world/lab';
import { createHero, refreshHero } from './hero/hero';
import { emptyHeroMods, type HeroMods } from './hero/mods';
import type { HeroState } from './hero/types';
import { createHeroFx, type HeroFxState } from './hero/effects';
import { createWorldState, type RoomSource, type WorldState } from './world/worldState';
import { buildObjects, type WorldObject } from './world/objects';
import type { LootDrop } from './items/loot';

/**
 * How the room plays. 'sandbox': only the room's @spawn enemies, every rune unlimited. 'arena':
 * endless waves of enemies (src/sim/world/waves.ts). 'adventure' (M4): the real game: rooms
 * connect, the hero owns its runes and items, kills give XP and loot, death respawns at a Loom
 * Stone.
 */
export type GameMode = 'sandbox' | 'arena' | 'adventure';

/** Debug toggles that change the simulation. Hashed, so replays record them. */
export interface Cheats {
  /** The player takes no damage (hits still land and show). */
  god: boolean;
  /** Enemy AI frozen: enemies keep whatever velocity and facing they have (tests, debugging). */
  noAI?: boolean;
  /** Spells never cost mana (the DPS readout; the cost is still reported in 'triggerFired'). */
  infiniteMana?: boolean;
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
  /** The chemistry grid (DESIGN §6): materials, fire, charge, water, smoke per cell. */
  grid: Grid;
  /** Chemistry Lab scripts waiting to fire (world/lab.ts). Hashed. */
  lab: LabState;
  /** The character: level, XP, runes, items, passives (hero/types.ts). Hashed; saved. */
  hero: HeroState;
  /** What the hero's build adds up to (hero/mods.ts). Derived by refreshHero; not hashed. */
  heroMods: HeroMods;
  /** Runtime state of passive and Fuse rules: extra weaves' timers, Living Loom's cooldown (hero/effects.ts). Hashed. */
  heroFx: HeroFxState;
  /** Region progress: current room, room flags, keys, Loom Stones (world/worldState.ts). Hashed; saved. */
  world: WorldState;
  /** Puzzle objects and pickups in the current room (world/objects.ts). Hashed. */
  objects: WorldObject[];
  /** Drops lying in the current room (items/loot.ts). Hashed. */
  loot: LootDrop[];
  /** Room file texts by id; the only way the sim loads a room. Not hashed. */
  rooms: RoomSource;
  player: PlayerState;
  /** Spell-runtime stream: Lob branch landing points (and later spell randomness). */
  spellRng: Rng;
  /** Chemistry grid rolls only: fire spread (rule 2) and Storm ignition (rule 14). */
  gridRng: Rng;
  /** Weave slots (LMB, RMB, Q, E), spindle and trigger timers (weave/runtime/loadout.ts). */
  weaves: WeaveLoadout;
  /**
   * LEGACY, derived from `weaves` (not hashed): the M1 spell id per slot where the weave is
   * exactly an M1 spell, for the M1 HUD. Use `weaves` / src/app/loadout.ts instead.
   */
  loadout: Loadout;
  /** Live player spell instances in spawn order (ended ones are removed at the end of each step). */
  spells: SpellInstance[];
  /** Open fires (per-cast spawn caps), while anything of their tree is alive. */
  casts: CastRecord[];
  /** Echo repeats waiting for their delay. */
  pendingSpells: PendingSpawn[];
  /** Events waiting for the next trigger phase (weave/runtime/queue.ts). */
  triggerQueue: TriggerQueueEntry[];
  /** Next CastRecord id (fires counted from 1). */
  nextCastId: number;
  /**
   * DPS readout hook (DESIGN §5.5): when > 0, natural On Dodge, On Hurt and On Crit events are
   * ignored and one of each is synthesized every this many trigger phases (ticks outside
   * hitstop, so ICDs see the same clock), starting with the first. 0 in play.
   */
  triggerForcing: number;
  /** Trigger phases until the next synthesized event while triggerForcing > 0. */
  triggerForcingLeft: number;
  /** Debug counters for the overlay. Not hashed. */
  stats: SpellStats;
  /** Live enemies in spawn order (dead ones are removed at the end of each step). */
  enemies: Enemy[];
  /** Live projectiles in spawn order (ended ones are removed at the end of each step). Enemy shots only since M2. */
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
  /** Room file text (CONTENT §6). Give this, or `rooms` plus `roomId`. */
  roomText?: string;
  /** Room texts by id, for games that change rooms (adventure). */
  rooms?: RoomSource;
  /** Starting room id in `rooms` (ignored when roomText is given). */
  roomId?: string;
  /** The character, e.g. from a save (default: a fresh level 1 hero). */
  hero?: HeroState;
  /** Region progress, e.g. from a save (default: fresh, in the starting room). */
  world?: WorldState;
  tuning?: Tuning;
  /** Spawn the room's `@spawn enemy:` entries (default: true, except in arena mode). */
  spawnRoomEnemies?: boolean;
  /** Default 'sandbox'. */
  mode?: GameMode;
  /** Starting weaves and spindle (default DEFAULT_LOADOUT: Fire Bolt, Strike, Twig). */
  loadout?: LoadoutSpec;
}

export function createGame(opts: CreateGameOptions): GameState {
  const tuning = cloneTuning(opts.tuning);
  const text = opts.roomText ?? opts.rooms?.[opts.roomId ?? ''];
  if (text === undefined) throw new Error(`createGame: no room text (roomId "${opts.roomId ?? ''}")`);
  const room = buildRoom(parseRoom(text));
  const rooms: RoomSource = opts.rooms ?? { [room.id]: text };
  const rng = new Rng(opts.seed);
  const combatRng = rng.fork('combat');
  const aiRng = rng.fork('ai');
  const spellRng = rng.fork('spell');
  const gridRng = rng.fork('grid');
  const mode = opts.mode ?? 'sandbox';
  const weaves = createWeaveLoadout(opts.loadout ?? DEFAULT_LOADOUT, tuning);
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
    grid: createGrid(room),
    lab: createLabState(),
    hero: opts.hero ?? createHero(),
    heroMods: emptyHeroMods(),
    heroFx: createHeroFx(),
    world: opts.world ?? createWorldState(room.id),
    objects: [],
    loot: [],
    rooms,
    player: createPlayer(room.spawnX, room.spawnY, tuning),
    spellRng,
    gridRng,
    weaves,
    loadout: legacyLoadout(weaves),
    spells: [],
    casts: [],
    pendingSpells: [],
    triggerQueue: [],
    nextCastId: 1,
    triggerForcing: 0,
    triggerForcingLeft: 0,
    stats: { spells: 0, dropped: 0, evicted: 0, fires: 0 },
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
  refreshHero(state);
  state.objects = buildObjects(state);
  if (opts.spawnRoomEnemies ?? mode !== 'arena') spawnRoomEnemies(state);
  state.enemyHash.rebuild(state.enemies);
  return state;
}
