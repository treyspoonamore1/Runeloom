/**
 * Runs DPS readouts in a Web Worker, debounced (ReadoutQueue). A request that arrives while a job
 * is still running terminates that worker and starts a fresh one, so stale work never delays the
 * numbers the player is looking at.
 */
import { signal } from '@preact/signals';
import type { SpindleId } from '../../../data/spindles';
import { parseReadoutKey, READOUT_SCENES, ReadoutQueue, type ReadoutView } from './readoutQueue';
import type { ReadoutJob, ReadoutReply } from './readoutWorker';

export interface ReadoutClient {
  readonly view: { readonly value: ReadoutView };
  request(key: string | null): void;
}

export function createReadoutClient(): ReadoutClient {
  const view = signal<ReadoutView>({ key: null, status: 'idle', results: {} });
  let worker: Worker | null = null;
  let running = false;

  const fail = (id: number, error: string) => {
    for (const scene of READOUT_SCENES) queue.receive(id, scene, { ok: false, error });
    running = false;
  };

  const spawn = (): Worker | null => {
    try {
      const w = new Worker(new URL('./readoutWorker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<ReadoutReply>) => {
        const { id, scene, result } = e.data;
        queue.receive(id, scene, result);
        if (!queue.busy) running = false;
      };
      w.onerror = (e) => {
        e.preventDefault();
        if (currentId) fail(currentId, `The readout worker failed: ${e.message || 'unknown error'}`);
      };
      return w;
    } catch {
      return null;
    }
  };

  let currentId = 0;
  const queue = new ReadoutQueue(
    {
      start(key, id) {
        currentId = id;
        if (running && worker) {
          worker.terminate();
          worker = null;
        }
        worker ??= spawn();
        if (!worker) return fail(id, 'The DPS readout needs Web Workers, which this browser blocked.');
        const { notation, spindleId } = parseReadoutKey(key);
        running = true;
        const job: ReadoutJob = { id, notation, spindleId: spindleId as SpindleId };
        worker.postMessage(job);
      },
      change(v) {
        view.value = v;
      },
    },
    { set: (fn, ms) => window.setTimeout(fn, ms), clear: (h) => window.clearTimeout(h as number) },
  );

  return { view, request: (key) => queue.request(key) };
}
