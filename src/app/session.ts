import {
  createGame,
  step,
  type Cheats,
  type GameMode,
  type GameState,
  type InputFrame,
  type SimEvent,
} from '../sim';
import { roomText } from './rooms';
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
  readonly sceneId: string;
  mode: GameMode;
  /** Every input frame stepped since the last reset, for F9 replays. */
  frames: InputFrame[] = [];
  /** Tuning at the last reset; replays start from it. */
  startTuning: Tuning;
  /** Cheats at the last reset; replays start from them. */
  startCheats: Cheats = { god: false };
  /**
   * Sim events from every step since the last drainEvents(), in order. A frame can run several
   * steps (or none), so render and audio drain this once per frame instead of reading state.events.
   */
  pendingEvents: SimEvent[] = [];
  private resetListeners: Array<(s: GameState) => void> = [];

  constructor(opts: SessionOptions) {
    this.seed = opts.seed;
    this.roomId = opts.roomId;
    this.sceneId = opts.sceneId;
    this.mode = opts.mode ?? 'sandbox';
    this.state = createGame({ seed: opts.seed, roomText: roomText(opts.roomId), mode: this.mode });
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
    this.state = createGame({
      seed: this.seed,
      roomText: roomText(this.roomId),
      tuning: this.state.tuning,
      mode: this.mode,
    });
    this.state.cheats = cheats;
    this.startCheats = { ...cheats };
    this.frames = [];
    this.pendingEvents = [];
    this.startTuning = cloneTuning(this.state.tuning);
    for (const fn of this.resetListeners) fn(this.state);
  }

  onReset(fn: (s: GameState) => void): void {
    this.resetListeners.push(fn);
  }
}
