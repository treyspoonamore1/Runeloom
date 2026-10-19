import {
  createGame,
  DEFAULT_LOADOUT,
  loadoutSpecOf,
  step,
  type Cheats,
  type LoadoutEdit,
  type LoadoutSpec,
  type GameMode,
  type GameState,
  type InputFrame,
  type SimEvent,
  type TimedHeroEdit,
  type SaveData,
  makeSave,
} from '../sim';
import { roomTexts } from './rooms';
import type { SceneDef } from './scenes';
import { cloneTuning, type Tuning } from '../../data/tuning';

export interface SessionOptions {
  seed: number;
  roomId: string;
  sceneId: string;
  mode?: GameMode;
}

/**
 * Owns the live GameState plus the input log for replays. Resetting creates a
 * new GameState (new seed or room) but keeps the current tuning values.
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
   * Character edits since the last reset (src/app/hero.ts sendHeroEdit), applied between ticks
   * like Loom edits; replays apply them at the same ticks, in the same order relative to Loom
   * edits (TimedHeroEdit.after). They don't mark the session edited.
   */
  heroEdits: TimedHeroEdit[] = [];
  /**
   * Adventure mode: the game at the last reset as a save, so replays can rebuild it (loading a
   * save, or a new game, creates the state outside `createGame`). Null in other modes. Whoever
   * replaces `state` with an adventure game calls `markAdventureStart()`.
   */
  startSave: SaveData | null = null;
  /**
   * Sim events from every step since the last drainEvents(), in order. A frame can run several
   * steps (or none), so render and audio drain this once per frame instead of reading state.events.
   */
  pendingEvents: SimEvent[] = [];
  /** True once something outside `step` changed the state (console cheats) since the last reset. */
  edited = false;
  private resetListeners: Array<(s: GameState) => void> = [];

  constructor(opts: SessionOptions) {
    this.seed = opts.seed;
    this.roomId = opts.roomId;
    this.sceneId = opts.sceneId;
    this.mode = opts.mode ?? 'sandbox';
    this.state = createGame({ seed: opts.seed, rooms: roomTexts, roomId: opts.roomId, mode: this.mode });
    this.startTuning = cloneTuning(this.state.tuning);
  }

  step(input: InputFrame): void {
    this.frames.push({ ...input });
    step(this.state, input);
    for (const e of this.state.events) this.pendingEvents.push(e);
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
    this.startLoadout = loadoutSpecOf(this.state.weaves);
    this.state = createGame({
      seed: this.seed,
      rooms: roomTexts,
      roomId: this.roomId,
      tuning: this.state.tuning,
      mode: this.mode,
      loadout: this.startLoadout,
    });
    this.state.cheats = cheats;
    this.startCheats = { ...cheats };
    this.frames = [];
    this.loadoutEdits = [];
    this.heroEdits = [];
    this.startSave = null;
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

  /**
   * Records a character edit already applied to the state between ticks (and queues the events
   * it caused). Does not mark the session edited.
   */
  recordHeroEdit(edit: TimedHeroEdit): void {
    this.heroEdits.push(edit);
    for (const e of this.state.events) this.pendingEvents.push(e);
    this.state.events.length = 0;
  }

  /**
   * Call right after putting a fresh adventure game in `state` (new game, loaded save, reset):
   * starts a new recording from it, so F9 replays rebuild the game from `startSave`.
   */
  markAdventureStart(): void {
    this.mode = this.state.mode;
    this.seed = this.state.seed;
    this.frames = [];
    this.loadoutEdits = [];
    this.heroEdits = [];
    this.pendingEvents = [];
    this.edited = false;
    this.startCheats = { ...this.state.cheats };
    this.startTuning = cloneTuning(this.state.tuning);
    this.startSave = makeSave(this.state);
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
