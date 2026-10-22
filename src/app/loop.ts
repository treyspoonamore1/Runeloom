import { DT, type InputFrame } from '../sim';

export interface FrameStats {
  fps: number;
  /** Wall-clock ms for the last frame. */
  frameMs: number;
  /** Average ms per sim tick over the last second. */
  simMs: number;
  /** Ticks stepped in the last frame. */
  ticks: number;
}

export interface LoopHooks {
  sampleInput(): InputFrame;
  step(input: InputFrame): void;
  /** alpha in [0, 1): how far between the last two ticks to interpolate. */
  render(alpha: number, frameDt: number): void;
  onFrame?(stats: FrameStats): void;
  /** A frame threw: the loop has stopped (the game is frozen); report it. */
  onCrash?(error: unknown): void;
}

const MAX_FRAME_DT = 0.25;
const MAX_TICKS_PER_FRAME = 10;

/** Fixed-timestep loop with an accumulator (CLAUDE.md rule 2). */
export class GameLoop {
  timescale = 1;
  paused = false;
  readonly stats: FrameStats = { fps: 0, frameMs: 0, simMs: 0, ticks: 0 };
  private acc = 0;
  private last = 0;
  private running = false;
  private fpsFrames = 0;
  private fpsTime = 0;
  private simTimeSum = 0;
  private simTickSum = 0;

  constructor(private readonly hooks: LoopHooks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
  }

  /** Steps exactly one tick, for frame-by-frame debugging while paused. */
  stepOnce(): void {
    this.hooks.step(this.hooks.sampleInput());
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    try {
      this.runFrame(now);
    } catch (e) {
      this.running = false;
      this.hooks.onCrash?.(e);
      return;
    }
    requestAnimationFrame(this.frame);
  };

  private runFrame(now: number): void {
    const realDt = Math.min((now - this.last) / 1000, MAX_FRAME_DT);
    this.last = now;
    let ticks = 0;
    if (!this.paused) {
      this.acc += realDt * this.timescale;
      while (this.acc >= DT && ticks < MAX_TICKS_PER_FRAME) {
        const t0 = performance.now();
        this.hooks.step(this.hooks.sampleInput());
        this.simTimeSum += performance.now() - t0;
        this.simTickSum++;
        this.acc -= DT;
        ticks++;
      }
      if (ticks === MAX_TICKS_PER_FRAME) this.acc = 0;
    }
    this.hooks.render(this.paused ? 0 : this.acc / DT, realDt);

    this.fpsFrames++;
    this.fpsTime += realDt;
    if (this.fpsTime >= 1) {
      this.stats.fps = this.fpsFrames / this.fpsTime;
      this.stats.simMs = this.simTickSum > 0 ? this.simTimeSum / this.simTickSum : 0;
      this.fpsFrames = 0;
      this.fpsTime = 0;
      this.simTimeSum = 0;
      this.simTickSum = 0;
    }
    this.stats.frameMs = realDt * 1000;
    this.stats.ticks = ticks;
    this.hooks.onFrame?.(this.stats);
  }
}
