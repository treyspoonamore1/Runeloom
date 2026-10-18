import { expect, test } from '@playwright/test';
import { referenceWeaves, runReadout, type ReadoutInput } from '../../src/sim';

/**
 * The Loom runs the readout in a Web Worker (DESIGN §5.5). The same input must give the same
 * numbers there as in Node (the CLI), so this runs runReadout in a module worker served by Vite.
 */
test.describe('DPS readout in a Web Worker', () => {
  test('matches Node exactly', async ({ page }) => {
    await page.goto('/?scene=room&paused=1');
    const inputs: ReadoutInput[] = [10, 13, 12].map((n) => ({
      notation: referenceWeaves.find((w) => w.n === n)!.notation,
      spindleId: 'heartwood',
      scene: 'dummy_pack',
      seconds: 10,
      runs: 3,
      seed: 5,
    }));
    const inWorker = await page.evaluate(async (list) => {
      const src = `import { runReadout } from '${location.origin}/src/sim/weave/readout.ts';
        self.onmessage = (e) => self.postMessage(e.data.map((i) => runReadout(i)));`;
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      const worker = new Worker(url, { type: 'module' });
      const out = await new Promise((resolve, reject) => {
        worker.onmessage = (e) => resolve(e.data);
        worker.onerror = (e) => reject(new Error(e.message));
        worker.postMessage(list);
      });
      worker.terminate();
      return out;
    }, inputs);
    expect(inWorker).toEqual(inputs.map((i) => runReadout(i)));
  });
});
