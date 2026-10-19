import {
  cloneWorld,
  createAdventure,
  createGame,
  DEFAULT_LOADOUT,
  NEW_GAME_LOADOUT,
  loadoutSpecOf,
  step,
  type Cheats,
  type LoadoutEdit,
  type LoadoutSpec,
  type GameMode,
  type GameState,
  type InputFrame,
  type SimEvent,
  type WorldState,
} from '../sim';
import type { HeroState } from '../sim/hero/types';
import { roomTexts } from './rooms';
import { adventureStartRoom, type SceneDef } from './scenes';
import { cloneTuning, type Tuning } from '../../data/tuning';

export interface SessionOptions {
  seed: number;
  roomId: string;
  sceneId: string;
  mode?: GameMode;
}

/** A fresh game for a session: adventure games through createAdventure, the rest through createGame. */
function newState(
  seed: number,
  roomId: string,
  mode: GameMode,
  tuning?: Tuning,
  loadout?: LoadoutSpec,
): GameState {
  if (mode === 'adventure')
    return createAdventure({
      seed,
      rooms: roomTexts,
      startRoomId: adventureStartRoom(roomTexts, roomId),
      tuning,
    });
  return createGame({ seed, rooms: roomTexts, roomId, tuning, mode, loadout });
}

/**
 * Owns the live GameState plus the input log for replays. Resetting creates a
 * new GameState (new seed or room) but keeps the current tuning values. In adventure mode a
 * reset starts a new game (the new-game hero and weaves) in the scene's start room.
 */
export class Session {
  state: GameState;
  seed: number;
  roomId: string;
  /** The scene being played (src/app/scenes.ts); switchScene changes it. */
  sceneId: string;
  mode: GameMode;
  /** Every input frame stepped since the last reset, for F9 replays. */
  frames: InputFrame[] = [];
  /** Tuning at the last reset; replays start from it. */
  startTuning: Tuning;
  /** Cheats at the last reset; replays start from them. */
  startCheats: Cheats = { god: false };
  /** Weaves and spindle at the last reset; a reset keeps the current ones. Replays start from them. */
  startLoadout: LoadoutSpec = DEFAULT_LOADOUT;
  /**
   * Loom edits since the last reset (src/app/loadout.ts), each applied between ticks at
   * `state.tick === tick`. Replays apply them at the same ticks; they don't mark the session edited.
   */
  loadoutEdits: LoadoutEdit[] = [];
  /**
   * Sim events from every step since the last drainEvents(), in order. A frame can run several
   * steps (or none), so render and audio drain this once per frame instead of reading state.events.
   */
  pendingEvents: SimEvent[] = [];
  /** True once something outside `step` changed the state (console cheats) since the last reset. */
  edited = false;
  /** Adventure mode: the hero and world at the last reset (a replay starts from them). Null otherwise. */
  startHero: HeroState | null = null;
  startWorld: WorldState | null = null;
  private resetListeners: Array<(s: GameState) => void> = [];
  private roomListeners: Array<(s: GameState) => void> = [];
  private lastRoom: GameState['room'];

  constructor(opts: SessionOptions) {
    this.seed = opts.seed;
    this.roomId = opts.roomId;
    this.sceneId = opts.sceneId;
    this.mode = opts.mode ?? 'sandbox';
    this.state = newState(opts.seed, opts.roomId, this.mode);
    this.lastRoom = this.state.room;
    this.startTuning = cloneTuning(this.state.tuning);
    this.rememberStart();
  }

  step(input: InputFrame): void {
    this.syncRoom();
    this.frames.push({ ...input });
    step(this.state, input);
    for (const e of this.state.events) this.pendingEvents.push(e);
    this.syncRoom();
  }

  /**
   * Tells room listeners when the player is in a different room than last time (an exit,
   * respawn, rest or fast travel). Runs around every step; call it after applying an edit that
   * can change rooms between ticks (HeroEdit 'travel' and 'rest').
   */
  syncRoom(): void {
    if (this.state.room === this.lastRoom) return;
    this.lastRoom = this.state.room;
    for (const fn of this.roomListeners) fn(this.state);
  }

  /** Called with the state whenever the room changes without a reset (see syncRoom). */
  onRoomChange(fn: (s: GameState) => void): void {
    this.roomListeners.push(fn);
  }

  private rememberStart(): void {
    const adventure = this.state.mode === 'adventure';
    // The room an adventure actually started in (the scene's room may stand in for the region's).
    if (adventure) this.roomId = this.state.room.id;
    this.startHero = adventure ? (JSON.parse(JSON.stringify(this.state.hero)) as HeroState) : null;
    this.startWorld = adventure ? cloneWorld(this.state.world) : null;
  }

  /** Returns the events collected since the last call and clears them. */
  drainEvents(): SimEvent[] {
    const out = this.pendingEvents;
    this.pendingEvents = [];
    return out;
  }

  reset(opts: { seed?: number; roomId?: string; mode?: GameMode } = {}): void {
    if (opts.seed !== undefined) this.seed = opts.seed >>> 0;
    if (opts.roomId !== undefined) this.roomId = opts.roomId;
    if (opts.mode !== undefined) this.mode = opts.mode;
    const cheats = { ...this.state.cheats };
    this.startLoadout = this.mode === 'adventure' ? NEW_GAME_LOADOUT : loadoutSpecOf(this.state.weaves);
    this.state = newState(this.seed, this.roomId, this.mode, this.state.tuning, this.startLoadout);
    this.lastRoom = this.state.room;
    this.rememberStart();
    this.state.cheats = cheats;
    this.startCheats = { ...cheats };
    this.frames = [];
    this.loadoutEdits = [];
    this.pendingEvents = [];
    this.edited = false;
    this.startTuning = cloneTuning(this.state.tuning);
    for (const fn of this.resetListeners) fn(this.state);
  }

  /**
   * Call after the console or a tool changes sim state outside `step`: replays will warn, and any
   * events that change emitted (e.g. deaths from killall) are queued for render and audio.
   */
  markEdited(): void {
    this.edited = true;
    for (const e of this.state.events) this.pendingEvents.push(e);
    this.state.events.length = 0;
  }

  /**
   * Records a Loom edit already applied to the state between ticks, and queues any events it
   * caused (a cancelled cast) for render and audio. Does not mark the session edited.
   */
  recordLoadoutEdit(edit: LoadoutEdit): void {
    this.loadoutEdits.push(edit);
    for (const e of this.state.events) this.pendingEvents.push(e);
    this.state.events.length = 0;
  }

  /** Resets into another scene's room and mode (the pause menu's place picker). */
  switchScene(scene: SceneDef): void {
    this.sceneId = scene.id;
    this.reset({ roomId: scene.roomId, mode: scene.mode ?? 'sandbox' });
  }

  onReset(fn: (s: GameState) => void): void {
    this.resetListeners.push(fn);
  }
}
