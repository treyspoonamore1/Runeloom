import { describe, expect, it } from 'vitest';
import { createAdventure, hashState, runFrames, runScript, type GameState, type ScriptCommand } from '../../../src/sim';
import { adventure, obj, ROOMS, T } from '../world/worldHelpers';

const doorOpen = (s: GameState) => s.objects.some((o) => o.kind === 'door' && o.on);

/** test/puzzle_block: push the block onto the plate, walk around it through the door. */
const BLOCK: ScriptCommand[] = [
  { do: 'moveTo', x: T(4), y: T(2) },
  { do: 'walk', dirX: 1, dirY: 0, s: 8, until: (s) => obj(s, 'push_block').tx === 9 },
  { do: 'until', cond: doorOpen, timeout: 2, label: 'the plate opens the door' },
  { do: 'moveTo', x: T(10), y: T(1) },
  { do: 'moveTo', x: T(11), y: T(2) },
  { do: 'walk', dirX: 1, dirY: 0, s: 3, until: (s) => s.room.id === 'test/puzzle_braziers' },
];

/** test/puzzle_braziers: light both braziers with Fire Bolt, take the Loom Shard behind the door. */
const BRAZIERS: ScriptCommand[] = [
  { do: 'moveTo', x: T(6), y: T(2) },
  { do: 'cast', slot: 0, at: { x: T(3), y: T(1) } },
  { do: 'cast', slot: 0, at: { x: T(9), y: T(1) } },
  { do: 'until', cond: doorOpen, timeout: 3, label: 'both braziers open the door' },
  { do: 'moveTo', x: T(6), y: T(5) },
];

describe('script driver', () => {
  it('solves the block-and-plate room and the two-brazier room', () => {
    const s = adventure('test/puzzle_block');
    const r = runScript(s, [...BLOCK, ...BRAZIERS]);
    expect(r.error).toBeUndefined();
    expect(r.ok).toBe(true);
    expect(s.room.id).toBe('test/puzzle_braziers');
    expect(s.hero.loomShards).toBe(1);
    expect(s.world.flags['test/puzzle_block']!.opened).toHaveLength(1);
    expect(s.world.flags['test/puzzle_braziers']!.opened).toHaveLength(1);
  });

  it('its frames replay to the same state', () => {
    const s = adventure('test/puzzle_block');
    const r = runScript(s, BLOCK);
    const again = runFrames(r.frames, '', {
      seed: 1,
      mode: 'adventure',
      createState: () => createAdventure({ seed: 1, rooms: ROOMS, startRoomId: 'test/puzzle_block' }),
    });
    expect(again.hash).toBe(hashState(s));
  });

  it('solves the timed braziers before they go out', () => {
    const s = adventure('test/puzzle_timer');
    const r = runScript(s, [
      { do: 'cast', slot: 0, at: { x: T(1), y: T(1) } },
      { do: 'cast', slot: 0, at: { x: T(9), y: T(1) } },
      { do: 'until', cond: doorOpen, timeout: 3 },
      { do: 'moveTo', x: T(5), y: T(5) },
    ]);
    expect(r.error).toBeUndefined();
    expect(s.hero.heartSeeds).toBe(1);
  });

  it('slides the ice block onto the plate', () => {
    const s = adventure('test/puzzle_ice');
    const r = runScript(s, [
      { do: 'moveTo', x: T(3), y: T(2) },
      { do: 'walk', dirX: 1, dirY: 0, s: 3, until: (st) => obj(st, 'ice_block').tx > 4 },
      { do: 'until', cond: doorOpen, timeout: 3, label: 'the block reaches the plate' },
    ]);
    expect(r.error).toBeUndefined();
    expect(obj(s, 'ice_block').tx).toBe(11);
  });

  it('reports the command that timed out', () => {
    const s = adventure('test/puzzle_block');
    const r = runScript(s, [
      { do: 'wait', s: 0.1 },
      { do: 'until', cond: doorOpen, timeout: 1, label: 'door' },
    ]);
    expect(r.ok).toBe(false);
    expect(r.failedAt).toBe(1);
    expect(r.error).toBe('command 1 (until): timed out after 1 s: door');
    expect(r.ticks).toBe(6 + 60);
  });

  it('reports an unreachable moveTo', () => {
    const s = adventure('test/puzzle_braziers');
    const r = runScript(s, [{ do: 'moveTo', x: T(6), y: T(5), timeout: 2 }]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/didn't reach \(26, 22\) in 2 s/);
  });

  it('stops at maxTicks', () => {
    const s = adventure('test/puzzle_block');
    const r = runScript(s, [{ do: 'wait', s: 10 }], 30);
    expect(r).toMatchObject({ ok: false, ticks: 30 });
    expect(r.error).toMatch(/ran out of ticks/);
  });

  it('dodges and faces', () => {
    const s = adventure('test/puzzle_block');
    const x0 = s.player.x;
    const r = runScript(s, [
      { do: 'face', x: 0, y: T(2) },
      { do: 'dodge', dirX: 1, dirY: 0 },
    ]);
    expect(r.ok).toBe(true);
    expect(s.player.x).toBeGreaterThan(x0 + 3);
    expect(r.frames[0]!.aimX).toBe(0);
  });
});
