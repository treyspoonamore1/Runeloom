import { describe, expect, it } from 'vitest';
import { CommandRegistry } from '../../src/ui/console/commands';
import { registerM1Commands, resolveKind, cursorPoint, MAX_SPAWN, type M1Env } from '../../src/ui/console/m1';
import { findSpawnSpots } from '../../src/ui/console/placement';
import { createGame, isSolidCell, type GameMode, type GameState } from '../../src/sim';
import arenaText from '../../data/rooms/test/arena.txt?raw';

function fake(opts: { mode?: GameMode; mouse?: { x: number; y: number } } = {}) {
  const state: GameState = createGame({
    seed: 1,
    roomText: arenaText,
    mode: opts.mode ?? 'arena',
    spawnRoomEnemies: false,
  });
  let edited = 0;
  const env: M1Env = {
    session: { state, markEdited: () => void edited++ },
    // 1 px = 1 cell, so a mouse at (100, 60) is the cell (100, 60).
    renderer: { screenToWorld: (sx, sy) => ({ x: sx, y: sy }) },
    input: { mouse: opts.mouse ?? { x: 100, y: 60 } },
  };
  const reg = new CommandRegistry<M1Env>();
  registerM1Commands(reg);
  return { state, env, reg, edits: () => edited };
}

describe('resolveKind', () => {
  it('accepts exact ids, unique prefixes and unique substrings', () => {
    expect(resolveKind('tinderling')).toBe('tinderling');
    expect(resolveKind('EMBER')).toBe('ember_archer');
    expect(resolveKind('archer')).toBe('ember_archer');
    expect(() => resolveKind('goblin')).toThrow(/Unknown enemy/);
    expect(() => resolveKind(undefined)).toThrow(/Usage/);
  });
});

describe('spawn', () => {
  it('spawns n enemies around the cursor and marks the session edited', () => {
    const f = fake();
    const r = f.reg.execute('spawn tinderling 5', f.env);
    expect(r.ok).toBe(true);
    expect(f.state.enemies).toHaveLength(5);
    expect(f.edits()).toBe(1);
    for (const e of f.state.enemies) {
      expect(Math.hypot(e.x - 100, e.y - 60)).toBeLessThan(10);
      expect(e.kind).toBe('tinderling');
    }
  });

  it('defaults to one enemy and rejects bad counts and kinds without changing state', () => {
    const f = fake();
    expect(f.reg.execute('spawn dummy', f.env).ok).toBe(true);
    expect(f.state.enemies).toHaveLength(1);
    for (const bad of [
      'spawn tinderling 0',
      'spawn tinderling 2.5',
      `spawn tinderling ${MAX_SPAWN + 1}`,
      'spawn tinderling x',
      'spawn goblin',
      'spawn',
    ]) {
      expect(f.reg.execute(bad, f.env).ok, bad).toBe(false);
    }
    expect(f.state.enemies).toHaveLength(1);
    expect(f.edits()).toBe(1);
  });

  it('moves spots out of walls when the cursor is inside one, and never overlaps bodies', () => {
    const f = fake({ mouse: { x: 0.5, y: 0.5 } }); // the room's corner wall
    f.reg.execute('spawn shieldbearer 6', f.env);
    expect(f.state.enemies).toHaveLength(6);
    for (const e of f.state.enemies) {
      expect(isSolidCell(f.state.room, Math.floor(e.x), Math.floor(e.y))).toBe(false);
      for (const o of f.state.enemies)
        if (o !== e) expect(Math.hypot(e.x - o.x, e.y - o.y)).toBeGreaterThanOrEqual(e.radius + o.radius);
    }
  });

  it('falls back to a point ahead of the player when the mouse has not moved', () => {
    const f = fake({ mouse: { x: 0, y: 0 } });
    const p = cursorPoint(f.env);
    expect(p.x).toBeGreaterThan(f.state.player.x);
    f.reg.execute('spawn tinderling 2', f.env);
    expect(f.state.enemies).toHaveLength(2);
  });
});

describe('findSpawnSpots', () => {
  it('returns fewer spots when the room is full rather than looping forever', () => {
    const f = fake();
    const spots = findSpawnSpots(f.state.room, 100, 60, 5000, 1);
    expect(spots.length).toBeGreaterThan(10);
    expect(spots.length).toBeLessThan(5000);
  });
});

describe('killall', () => {
  it('removes all enemies and marks the session edited', () => {
    const f = fake();
    f.reg.execute('spawn tinderling 3', f.env);
    const r = f.reg.execute('killall', f.env);
    expect(r.lines[0]).toContain('3');
    expect(f.state.enemies).toHaveLength(0);
    expect(f.edits()).toBe(2);
  });
});

describe('god', () => {
  it('toggles, accepts on/off and prints the state', () => {
    const f = fake();
    expect(f.reg.execute('god', f.env).lines[0]).toContain('ON');
    expect(f.state.cheats.god).toBe(true);
    expect(f.reg.execute('god', f.env).lines[0]).toContain('OFF');
    expect(f.reg.execute('god on', f.env).ok).toBe(true);
    expect(f.reg.execute('god on', f.env).ok).toBe(true);
    expect(f.state.cheats.god).toBe(true);
    expect(f.reg.execute('god maybe', f.env).ok).toBe(false);
    expect(f.edits()).toBe(4);
  });
});

describe('wave', () => {
  it('validates the argument and the scene', () => {
    const f = fake();
    for (const bad of ['wave', 'wave 0', 'wave 1.5', 'wave abc'])
      expect(f.reg.execute(bad, f.env).ok, bad).toBe(false);
    const sandbox = fake({ mode: 'sandbox' });
    expect(sandbox.reg.execute('wave 2', sandbox.env).lines[0]).toContain('arena');
    expect(f.edits()).toBe(0);
  });
});
