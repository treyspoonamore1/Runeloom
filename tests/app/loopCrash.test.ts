/** A frame that throws stops the loop and reports it once (app/crash.ts sends the report). */
import { describe, expect, it, vi } from 'vitest';
import { GameLoop } from '../../src/app/loop';
import { NEUTRAL_INPUT } from '../../src/sim';

describe('GameLoop crash', () => {
  it('stops and calls onCrash with the error instead of freezing silently', () => {
    const queue: ((t: number) => void)[] = [];
    vi.stubGlobal('requestAnimationFrame', (f: (t: number) => void) => queue.push(f));
    const boom = new Error('boom');
    let steps = 0;
    const crashes: unknown[] = [];
    const loop = new GameLoop({
      sampleInput: () => NEUTRAL_INPUT,
      step: () => {
        if (++steps === 3) throw boom;
      },
      render: () => {},
      onCrash: (e) => crashes.push(e),
    });
    loop.start();
    for (let t = 1; t <= 10 && queue.length > 0; t++) queue.shift()!(t * 1000);
    expect(crashes).toEqual([boom]);
    expect(queue.length).toBe(0);
    vi.unstubAllGlobals();
  });
});
