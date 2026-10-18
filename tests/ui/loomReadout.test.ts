import { describe, expect, it } from 'vitest';
import { parseReadoutKey, readoutKey, ReadoutQueue, type ReadoutView } from '../../src/ui/loom/readoutQueue';
import type { ReadoutResult } from '../../src/sim/weave/readout';

/** A manual clock: timers fire only when advanced. */
function fakeTimers() {
  let now = 0;
  let next = 1;
  const pending = new Map<number, { at: number; fn: () => void }>();
  return {
    timers: {
      set: (fn: () => void, ms: number) => {
        pending.set(next, { at: now + ms, fn });
        return next++;
      },
      clear: (h: unknown) => void pending.delete(h as number),
    },
    advance(ms: number) {
      now += ms;
      for (const [h, t] of [...pending]) {
        if (t.at <= now) {
          pending.delete(h);
          t.fn();
        }
      }
    },
    count: () => pending.size,
  };
}

const ok = (dps: number): ReadoutResult => ({
  ok: true,
  dps,
  hitDps: dps,
  dotDps: 0,
  dpsByType: { physical: 0, fire: dps, frost: 0, storm: 0 },
  hitsPerSecond: 1,
  firesPerSecond: 1,
  manaSpentPerSecond: 5,
  manaRefundPerSecond: 0,
  instancesPerFire: 1,
  droppedPerFire: 0,
  perRunDps: [dps],
  notes: [],
});

function setup() {
  const clock = fakeTimers();
  const started: Array<[string, number]> = [];
  const views: ReadoutView[] = [];
  const q = new ReadoutQueue(
    { start: (k, id) => started.push([k, id]), change: (v) => views.push(v) },
    clock.timers,
    250,
  );
  return { q, clock, started, views };
}

describe('ReadoutQueue', () => {
  it('debounces: only the last request within 250 ms starts', () => {
    const { q, clock, started } = setup();
    q.request('a');
    clock.advance(100);
    q.request('b');
    clock.advance(200);
    expect(started).toEqual([]);
    clock.advance(50);
    expect(started).toEqual([['b', 1]]);
    expect(q.view).toMatchObject({ key: 'b', status: 'waiting' });
  });

  it('ignores results from stale jobs and finishes when both scenes arrive', () => {
    const { q, clock, started } = setup();
    q.request('a');
    clock.advance(250);
    q.request('b');
    clock.advance(250);
    expect(started.map((s) => s[1])).toEqual([1, 2]);
    expect(q.receive(1, 'dummy_single', ok(10))).toBe(false);
    expect(q.receive(2, 'dummy_single', ok(20))).toBe(true);
    expect(q.view.status).toBe('waiting');
    expect(q.busy).toBe(true);
    q.receive(2, 'dummy_pack', ok(80));
    expect(q.view.status).toBe('done');
    expect(q.busy).toBe(false);
    expect(q.view.results.dummy_pack).toEqual(ok(80));
  });

  it('serves cached results at once and repeats nothing for the same key', () => {
    const { q, clock, started, views } = setup();
    q.request('a');
    clock.advance(250);
    q.receive(1, 'dummy_single', ok(1));
    q.receive(1, 'dummy_pack', ok(2));
    q.request('b');
    q.request('a');
    expect(q.view).toMatchObject({ key: 'a', status: 'done' });
    const n = views.length;
    q.request('a');
    expect(views.length).toBe(n);
    clock.advance(1000);
    expect(started).toEqual([['a', 1]]);
  });

  it('clears, cancelling a pending request', () => {
    const { q, clock, started } = setup();
    q.request('a');
    q.request(null);
    clock.advance(1000);
    expect(started).toEqual([]);
    expect(q.view).toEqual({ key: null, status: 'idle', results: {} });
    expect(clock.count()).toBe(0);
  });

  it('round-trips keys', () => {
    const k = readoutKey('Cast > Bolt[Fire] { OnHit > Nova[Fire]; OnExpire > Lob[Fire] }', 'twig');
    expect(parseReadoutKey(k)).toEqual({
      spindleId: 'twig',
      notation: 'Cast > Bolt[Fire] { OnHit > Nova[Fire]; OnExpire > Lob[Fire] }',
    });
  });
});
