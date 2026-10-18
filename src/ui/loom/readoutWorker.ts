/**
 * Web Worker for the Loom's DPS readout (DESIGN §5.5): runs the real sim headlessly through
 * runReadout, one message per scene so the single-target number can show before the pack's.
 */
import { runReadout, type ReadoutResult } from '../../sim/weave/readout';
import type { SpindleId } from '../../../data/spindles';
import { READOUT_SCENES } from './readoutQueue';

export interface ReadoutJob {
  id: number;
  notation: string;
  spindleId: SpindleId;
}

export interface ReadoutReply {
  id: number;
  scene: (typeof READOUT_SCENES)[number];
  result: ReadoutResult;
}

interface WorkerScope {
  onmessage: ((e: MessageEvent<ReadoutJob>) => void) | null;
  postMessage(msg: ReadoutReply): void;
}
const scope = self as unknown as WorkerScope;

scope.onmessage = (e) => {
  const { id, notation, spindleId } = e.data;
  for (const scene of READOUT_SCENES) {
    let result: ReadoutResult;
    try {
      result = runReadout({ notation, spindleId, scene, seconds: 10, runs: 10, seed: 1 });
    } catch (err) {
      result = {
        ok: false,
        error: `The readout failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    scope.postMessage({ id, scene, result });
  }
};
