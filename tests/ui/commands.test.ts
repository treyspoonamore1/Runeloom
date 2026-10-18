import { describe, expect, it } from 'vitest';
import { CommandRegistry, parseLine } from '../../src/ui/console/commands';
import { registerBuiltins, type ConsoleEnv } from '../../src/ui/console/builtins';

function fakeEnv() {
  const calls: string[] = [];
  const env = {
    session: {
      seed: 1,
      state: { tick: 7, tuning: { player: { moveSpeed: 99 } } },
      reset: (o: unknown) => calls.push(`reset ${JSON.stringify(o)}`),
    },
    loop: { timescale: 1, paused: false, stepOnce: () => calls.push('step') },
    roomIds: () => ['test/a', 'test/b'],
    saveReplay: () => calls.push('replay'),
    refreshTuning: () => calls.push('refresh'),
    clearOutput: () => {},
  };
  return { env: env as unknown as ConsoleEnv, calls, raw: env };
}

function reg() {
  const r = new CommandRegistry<ConsoleEnv>();
  registerBuiltins(r);
  return r;
}

describe('parseLine', () => {
  it('splits words and honours quotes', () => {
    expect(parseLine('  weave 1 "a b"  c ')).toEqual(['weave', '1', 'a b', 'c']);
    expect(parseLine('')).toEqual([]);
  });
});

describe('registry', () => {
  it('reports unknown commands', () => {
    const r = reg().execute('frobnicate', fakeEnv().env);
    expect(r.ok).toBe(false);
    expect(r.lines[0]).toContain('Unknown command "frobnicate"');
  });

  it('help lists commands and describes one', () => {
    const r = reg();
    const all = r.execute('help', fakeEnv().env).lines.join('\n');
    for (const n of ['seed', 'room', 'timescale', 'spawn']) expect(all).toContain(n);
    expect(r.execute('help seed', fakeEnv().env).lines[0]).toContain('seed <n>');
    expect(r.execute('help nope', fakeEnv().env).ok).toBe(false);
  });

  it('tab completes names', () => {
    const r = reg();
    expect(r.complete('tim').text).toBe('timescale ');
    expect(r.complete('re').candidates).toEqual(['replay', 'reset', 'resume']);
    expect(r.complete('re').text).toBe('re');
    expect(r.complete('p').text).toBe('pause ');
    expect(r.complete('zzz').candidates).toEqual([]);
  });

  it('seed validates and resets', () => {
    const r = reg();
    const f = fakeEnv();
    expect(r.execute('seed x', f.env).ok).toBe(false);
    expect(r.execute('seed -3', f.env).ok).toBe(false);
    f.raw.session.seed = 5;
    // hashing needs a real state; a fake state is not hashable, so only check dispatch.
    r.execute('seed 5', f.env);
    expect(f.calls).toContain('reset {"seed":5}');
  });

  it('room lists known ids on error', () => {
    const r = reg();
    const f = fakeEnv();
    const bad = r.execute('room nope', f.env);
    expect(bad.ok).toBe(false);
    expect(bad.lines[0]).toContain('test/a, test/b');
    expect(r.execute('room test/b', f.env).ok).toBe(true);
    expect(f.calls).toContain('reset {"roomId":"test/b"}');
  });

  it('timescale is range checked', () => {
    const r = reg();
    const f = fakeEnv();
    expect(r.execute('timescale 5', f.env).ok).toBe(false);
    expect(r.execute('timescale 0.01', f.env).ok).toBe(false);
    expect(r.execute('timescale 0.5', f.env).ok).toBe(true);
    expect(f.raw.loop.timescale).toBe(0.5);
  });

  it('step needs pause', () => {
    const r = reg();
    const f = fakeEnv();
    expect(r.execute('step 3', f.env).ok).toBe(false);
    r.execute('pause', f.env);
    expect(f.raw.loop.paused).toBe(true);
    r.execute('step 3', f.env);
    expect(f.calls.filter((c) => c === 'step')).toHaveLength(3);
    r.execute('resume', f.env);
    expect(f.raw.loop.paused).toBe(false);
  });

  it('tuning reset restores defaults in place', () => {
    const f = fakeEnv();
    const live = f.raw.session.state.tuning;
    reg().execute('tuning reset', f.env);
    expect(f.raw.session.state.tuning).toBe(live);
    expect(live.player.moveSpeed).toBe(26);
    expect(f.calls).toContain('refresh');
  });

  it('stubs name their milestone', () => {
    expect(reg().execute('give fire', fakeEnv().env).lines[0]).toContain('M2');
  });

  it('allows later milestones to register commands', () => {
    const r = reg();
    r.register({ name: 'ping', summary: 'pong', run: () => 'pong' });
    expect(r.execute('ping', fakeEnv().env).lines).toEqual(['pong']);
  });
});
