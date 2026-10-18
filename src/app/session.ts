import { createGame, step, type GameState, type InputFrame } from '../sim';
import { roomText } from './rooms';
import { cloneTuning, type Tuning } from '../../data/tuning';

export interface SessionOptions {
  seed: number;
  roomId: string;
  sceneId: string;
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
  /** Every input frame stepped since the last reset, for F9 replays. */
  frames: InputFrame[] = [];
  /** Tuning at the last reset; replays start from it. */
  startTuning: Tuning;
  private resetListeners: Array<(s: GameState) => void> = [];

  constructor(opts: SessionOptions) {
    this.seed = opts.seed;
    this.roomId = opts.roomId;
    this.sceneId = opts.sceneId;
    this.state = createGame({ seed: opts.seed, roomText: roomText(opts.roomId) });
    this.startTuning = cloneTuning(this.state.tuning);
  }

  step(input: InputFrame): void {
    this.frames.push({ ...input });
    step(this.state, input);
  }

  reset(opts: { seed?: number; roomId?: string } = {}): void {
    if (opts.seed !== undefined) this.seed = opts.seed >>> 0;
    if (opts.roomId !== undefined) this.roomId = opts.roomId;
    this.state = createGame({ seed: this.seed, roomText: roomText(this.roomId), tuning: this.state.tuning });
    this.frames = [];
    this.startTuning = cloneTuning(this.state.tuning);
    for (const fn of this.resetListeners) fn(this.state);
  }

  onReset(fn: (s: GameState) => void): void {
    this.resetListeners.push(fn);
  }
}
