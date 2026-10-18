/**
 * Debouncing and staleness for the Loom's DPS readout (DESIGN §5.5). Pure: the timer and the job
 * runner are injected, so tests drive it with fake timers and the browser with a Web Worker.
 *
 * - `request(key)` waits `delay` ms; a newer request inside that window replaces it.
 * - Each started job gets a new id; results carrying an older id are ignored (stale).
 * - Finished results are cached by key, so returning to a weave shows its numbers at once.
 */
import type { ReadoutResult, ReadoutScene } from '../../sim/weave/readout';

export const READOUT_SCENES: readonly ReadoutScene[] = ['dummy_single', 'dummy_pack'];

export interface ReadoutView {
  /** The key being shown (notation|spindle), or null for nothing. */
  key: string | null;
  /** 'waiting': debouncing or running. */
  status: 'idle' | 'waiting' | 'done';
  results: Partial<Record<ReadoutScene, ReadoutResult>>;
}

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface QueueHooks {
  /** Start computing `key` as job `id`. A previous job may still be running; the runner may cancel it. */
  start(key: string, id: number): void;
  /** Called whenever the view changes. */
  change(view: ReadoutView): void;
}

const CACHE_LIMIT = 64;

export class ReadoutQueue {
  view: ReadoutView = { key: null, status: 'idle', results: {} };
  private timer: unknown = null;
  private jobId = 0;
  /** Id of the job whose results are wanted, or 0 when none is running. */
  private liveJob = 0;
  private readonly cache = new Map<string, ReadoutView['results']>();

  constructor(
    private readonly hooks: QueueHooks,
    private readonly timers: Timers,
    readonly delay = 250,
  ) {}

  /** Asks for the readout of `key` (null clears it). Repeating the current key does nothing. */
  request(key: string | null): void {
    if (key === this.view.key) return;
    this.cancelTimer();
    this.liveJob = 0;
    if (key === null) return this.set({ key: null, status: 'idle', results: {} });
    const cached = this.cache.get(key);
    if (cached) return this.set({ key, status: 'done', results: cached });
    this.set({ key, status: 'waiting', results: {} });
    this.timer = this.timers.set(() => {
      this.timer = null;
      this.liveJob = ++this.jobId;
      this.hooks.start(key, this.liveJob);
    }, this.delay);
  }

  /** True while job `id` is the one whose results are wanted. */
  isCurrent(id: number): boolean {
    return id !== 0 && id === this.liveJob;
  }

  /** True when a started job hasn't delivered every scene yet. */
  get busy(): boolean {
    return this.liveJob !== 0;
  }

  /** A result from job `id`. Returns false (and changes nothing) for a stale job. */
  receive(id: number, scene: ReadoutScene, result: ReadoutResult): boolean {
    if (!this.isCurrent(id) || this.view.key === null) return false;
    const results = { ...this.view.results, [scene]: result };
    const done = READOUT_SCENES.every((s) => results[s] !== undefined);
    if (done) {
      this.liveJob = 0;
      this.cache.set(this.view.key, results);
      if (this.cache.size > CACHE_LIMIT) this.cache.delete(this.cache.keys().next().value!);
    }
    this.set({ key: this.view.key, status: done ? 'done' : 'waiting', results });
    return true;
  }

  /** Forgets cached results (e.g. after tuning changes). */
  clearCache(): void {
    this.cache.clear();
  }

  private cancelTimer(): void {
    if (this.timer !== null) this.timers.clear(this.timer);
    this.timer = null;
  }

  private set(v: ReadoutView): void {
    this.view = v;
    this.hooks.change(v);
  }
}

/** The cache key of a readout request. */
export const readoutKey = (notation: string, spindleId: string): string => `${spindleId}|${notation}`;

export function parseReadoutKey(key: string): { spindleId: string; notation: string } {
  const i = key.indexOf('|');
  return { spindleId: key.slice(0, i), notation: key.slice(i + 1) };
}
