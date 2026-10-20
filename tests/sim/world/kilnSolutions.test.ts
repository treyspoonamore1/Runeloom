/**
 * Scripted solutions for the Sunken Kiln puzzle rooms (BUILD_PLAN M4 task 10), following
 * data/rooms/SOLUTIONS.md. Each starts a new-game adventure in the room with the runes unlocked by
 * then (regionSolve.ts), runs the script with the world driver (src/sim/bots/script.ts) and
 * asserts the door-open or pickup state. The second half (K7–K9) also has an attempt
 * without the Frost rune that must fail (BUILD_PLAN M4 task 10).
 */
import { afterAll, describe, expect, it } from 'vitest';
import { MAT } from '../../../data/materials';
import { regionRooms } from '../../../data/progression';
import { runScript, setSlotWeave, type GameState, type ScriptCommand } from '../../../src/sim';
import { giveRune } from '../hero/helpers';
import {
  allOn,
  anyOn,
  at,
  BOLT,
  freeze,
  FROST_LOB,
  into,
  keys,
  LOB,
  noFire,
  noneLeft,
  objects,
  prepare,
  solve,
  STRIKE,
  T,
  ticksLog,
} from './regionSolve';

afterAll(() => console.log('solution ticks', JSON.stringify(ticksLog)));

describe('Sunken Kiln puzzle solutions', () => {
  it('K1 (enemies frozen): Bolt[Fire] lights both braziers, the gate opens, on to K2', () => {
    const { state } = prepare('k1', { arrive: 's', weaves: [BOLT, STRIKE, null, null], noAI: true });
    solve('k1', state, [
      { do: 'moveTo', x: T(20), y: T(12) },
      { do: 'cast', slot: 0, at: at(20, 7) },
      { do: 'moveTo', x: T(46), y: T(16) },
      { do: 'cast', slot: 0, at: at(46, 10) },
      { do: 'until', cond: (s) => allOn(s, 'door'), timeout: 3, label: 'gate opens' },
      { do: 'moveTo', x: T(25), y: T(2) },
      { do: 'walk', dirX: 0, dirY: -1, s: 3, until: into(regionRooms.k2) },
    ]);
  });

  it('K2 (enemies frozen): Lob[Fire] over the wall rings lights all three braziers, on to K3', () => {
    const { state } = prepare('k2', { arrive: 's', weaves: [BOLT, STRIKE, LOB, null], noAI: true });
    solve('k2', state, [
      { do: 'moveTo', x: T(24), y: T(28) },
      { do: 'cast', slot: 2, at: at(18, 28) },
      { do: 'moveTo', x: T(9), y: T(10) },
      { do: 'cast', slot: 2, at: at(9, 4) },
      { do: 'moveTo', x: T(47), y: T(19) },
      { do: 'cast', slot: 2, at: at(47, 27) },
      { do: 'until', cond: (s) => allOn(s, 'door'), timeout: 3, label: 'door opens' },
      { do: 'moveTo', x: T(59), y: T(9) },
      { do: 'walk', dirX: 1, dirY: 0, s: 3, until: into(regionRooms.k3) },
    ]);
  });

  it('K2 (enemies frozen): Bolt[Fire] from the same spots lights none of the walled braziers', () => {
    const { state } = prepare('k2', { arrive: 's', weaves: [BOLT, STRIKE, LOB, null], noAI: true });
    solve('k2 bolt', state, [
      { do: 'moveTo', x: T(24), y: T(28) },
      { do: 'cast', slot: 0, at: at(18, 28) },
      { do: 'moveTo', x: T(9), y: T(10) },
      { do: 'cast', slot: 0, at: at(9, 4) },
      { do: 'moveTo', x: T(47), y: T(19) },
      { do: 'cast', slot: 0, at: at(47, 27) },
      { do: 'wait', s: 1 },
    ]);
    expect(anyOn(state, 'brazier')).toBe(false);
  });

  it('K3 (enemies frozen): Lob[Fire] burns the three bramble layers, the chest gives one key, the locked door spends it', () => {
    const { state } = prepare('k3', { arrive: 'w', weaves: [BOLT, STRIKE, LOB, null], noAI: true });
    solve('k3', state, [
      { do: 'moveTo', x: T(11), y: T(17) },
      { do: 'cast', slot: 2, at: at(18, 17) },
      {
        do: 'until',
        cond: (s) => noneLeft(s, MAT.bramble, 17, 7, 20, 28) && noFire(s, 16, 7, 22, 28),
        timeout: 20,
        label: 'layer 1',
      },
      { do: 'moveTo', x: T(22), y: T(17) },
      { do: 'cast', slot: 2, at: at(25, 17) },
      {
        do: 'until',
        cond: (s) => noneLeft(s, MAT.bramble, 24, 7, 27, 28) && noFire(s, 23, 7, 29, 28),
        timeout: 20,
        label: 'layer 2',
      },
      { do: 'moveTo', x: T(30), y: T(17) },
      { do: 'cast', slot: 2, at: at(33, 17) },
      {
        do: 'until',
        cond: (s) => noneLeft(s, MAT.bramble, 31, 7, 41, 28) && noFire(s, 30, 7, 41, 28),
        timeout: 25,
        label: 'inner bramble',
      },
      { do: 'moveTo', x: T(35), y: T(17) },
      { do: 'walk', dirX: 1, dirY: 0, s: 2, until: (s) => keys(s) === 1 },
      { do: 'moveTo', x: T(52), y: T(17) },
      { do: 'walk', dirX: 1, dirY: 0, s: 2, until: (s) => anyOn(s, 'locked_door') },
      { do: 'moveTo', x: T(56), y: T(17) },
      { do: 'walk', dirX: 1, dirY: 0, s: 3, until: into(regionRooms.k4) },
    ]);
    expect(keys(state)).toBe(0);
  });

  it('K4 (enemies frozen): Lob[Fire] on the sump sends fire down both ducts, the barricades burn, Heart Seed taken', () => {
    const { state } = prepare('k4', { arrive: 'w', weaves: [BOLT, STRIKE, LOB, null], noAI: true });
    const seeds = state.hero.heartSeeds;
    solve('k4', state, [
      { do: 'moveTo', x: T(24), y: T(18) },
      { do: 'cast', slot: 2, at: at(32, 18) },
      {
        do: 'until',
        cond: (s) =>
          noneLeft(s, MAT.barricade, 59, 8, 60, 10) &&
          noneLeft(s, MAT.barricade, 51, 31, 53, 31) &&
          noFire(s, 28, 8, 61, 31),
        timeout: 60,
        label: 'barricades burned, ducts out',
      },
      { do: 'moveTo', x: T(52), y: T(34) },
      { do: 'until', cond: (s) => s.hero.heartSeeds === seeds + 1, timeout: 3, label: 'heart seed' },
      { do: 'moveTo', x: T(66), y: T(9) },
      { do: 'walk', dirX: 1, dirY: 0, s: 3, until: into(regionRooms.k5) },
    ]);
  });
  it('K6: the shrine gives Frost, then two Lob[Frost] bursts bridge the pool, on to K7', () => {
    const { state } = prepare('k6', { arrive: 'w', weaves: [BOLT, STRIKE, null, null] });
    const frost = () => state.hero.runes.filter((r) => r.rune === 'frost').length;
    // Frost is the shrine's dungeon item: not owned on arrival, nor after standing around.
    expect(frost()).toBe(0);
    solve('k6 wait', state, [{ do: 'wait', s: 1 }]);
    expect(frost()).toBe(0);
    solve('k6 shrine', state, [
      { do: 'moveTo', x: T(15), y: T(13) },
      { do: 'walk', dirX: 1, dirY: 0, s: 2, until: (s) => allOn(s, 'rune_shrine') },
    ]);
    expect(frost()).toBe(1);
    expect(state.hero.unlockedRunes).toContain('frost');
    // A third Cast (a duplicate drop, as prepare() adds for the other solutions) for Q.
    giveRune(state, 'cast');
    expect(setSlotWeave(state, 2, FROST_LOB).applied).toBe(true);
    solve('k6', state, [
      { do: 'moveTo', x: T(29), y: T(13) },
      freeze(126, 54),
      freeze(136, 54),
      { do: 'moveTo', x: T(37), y: T(13) },
      { do: 'moveTo', x: T(48), y: T(13) },
      { do: 'walk', dirX: 1, dirY: 0, s: 3, until: into(regionRooms.k7) },
    ]);
  });

  it('K7 (enemies frozen): ice bridges to the floating Heart Seed and across the channel, braziers open the door', () => {
    const { state } = prepare('k7', { arrive: 'w', weaves: [BOLT, STRIKE, FROST_LOB, null], noAI: true });
    const seeds = state.hero.heartSeeds;
    solve('k7', state, [
      { do: 'moveTo', x: T(12), y: T(20) },
      freeze(57, 82),
      freeze(66, 82),
      { do: 'moveTo', x: T(17), y: T(20) },
      { do: 'until', cond: (s) => s.hero.heartSeeds === seeds + 1, timeout: 2, label: 'heart seed' },
      { do: 'moveTo', x: T(11), y: T(20) },
      { do: 'moveTo', x: T(12), y: T(12) },
      freeze(56, 50),
      freeze(66, 50),
      freeze(76, 50),
      { do: 'moveTo', x: T(21), y: T(12) },
      freeze(108, 50),
      freeze(118, 50),
      freeze(128, 50),
      { do: 'moveTo', x: T(37), y: T(12) },
      { do: 'moveTo', x: T(45), y: T(8) },
      { do: 'cast', slot: 0, at: at(45, 4) },
      { do: 'moveTo', x: T(45), y: T(17) },
      { do: 'cast', slot: 0, at: at(45, 21) },
      { do: 'until', cond: (s) => allOn(s, 'door'), timeout: 3, label: 'door opens' },
      { do: 'moveTo', x: T(47), y: T(12) },
      { do: 'walk', dirX: 1, dirY: 0, s: 3, until: into(regionRooms.k8) },
    ]);
  });

  it('K8 (enemies frozen): freeze each lane, slide both ice blocks onto the plates, cross, Loom Shard taken', () => {
    const { state } = prepare('k8', { arrive: 'w', weaves: [BOLT, STRIKE, FROST_LOB, null], noAI: true });
    const plate = (ty: number) => (s: GameState) =>
      objects(s, 'pressure_plate').some((o) => o.ty === ty && o.on);
    // Freeze from the lane's east end (Lob reaches 40 cells), then push from the stone behind the block.
    const lane = (ty: number): ScriptCommand[] => [
      { do: 'moveTo', x: T(20), y: T(ty) },
      freeze(92, T(ty)),
      freeze(100, T(ty)),
      freeze(108, T(ty)),
      freeze(116, T(ty)),
      { do: 'moveTo', x: T(12), y: T(ty), tolerance: 0.3 },
      { do: 'wait', s: 0.3 },
      { do: 'walk', dirX: 1, dirY: 0, s: 5, until: plate(ty) },
    ];
    solve('k8', state, [
      ...lane(7),
      ...lane(24),
      { do: 'until', cond: (s) => allOn(s, 'door'), timeout: 3, label: 'door opens' },
      { do: 'moveTo', x: T(20), y: T(15) },
      freeze(92, 64),
      freeze(100, 64),
      freeze(108, 64),
      freeze(115, 64),
      { do: 'moveTo', x: T(35), y: T(15) },
      { do: 'moveTo', x: T(52), y: T(13) },
      { do: 'until', cond: (s) => s.hero.loomShards === 1, timeout: 2, label: 'loom shard' },
      { do: 'moveTo', x: T(56), y: T(15) },
      { do: 'walk', dirX: 1, dirY: 0, s: 3, until: into(regionRooms.k9) },
    ]);
  });

  it('K9 (enemies frozen): melt the ring from the shore, freeze the moat, take the big key, open the big-key door', () => {
    const { state } = prepare('k9', { arrive: 'w', weaves: [BOLT, STRIKE, FROST_LOB, null], noAI: true });
    const westBlock = (s: GameState) =>
      objects(s, 'ice_block').some((o) => o.tx === 49 && o.ty === 19 && o.on);
    const moat: ScriptCommand[] = [freeze(157, 78), freeze(167, 78), freeze(176, 78)];
    solve('k9', state, [
      { do: 'moveTo', x: T(36), y: T(19) },
      { do: 'cast', slot: 0, at: at(49, 19) },
      { do: 'until', cond: westBlock, timeout: 3, label: 'west block melts' },
      ...moat,
      { do: 'moveTo', x: T(47), y: T(19) },
      { do: 'moveTo', x: T(49), y: T(19) },
      { do: 'walk', dirX: 1, dirY: 0, s: 2, until: (s) => s.world.bigKeys.includes('kiln') },
      { do: 'moveTo', x: T(46), y: T(19) },
      { do: 'face', x: 157, y: 78 },
      freeze(176, 78),
      freeze(167, 78),
      freeze(157, 78),
      { do: 'moveTo', x: T(35), y: T(19) },
      { do: 'moveTo', x: T(29), y: T(7) },
      { do: 'walk', dirX: 0, dirY: -1, s: 3, until: (s) => anyOn(s, 'big_key_door') },
      { do: 'moveTo', x: T(29), y: T(3) },
      { do: 'walk', dirX: 0, dirY: -1, s: 3, until: into(regionRooms.k10) },
    ]);
  });
});

describe('the Kiln second half without Frost (BUILD_PLAN M4: "can\'t be solved without Frost")', () => {
  /** Runs each attempt from a fresh copy of the plan, and returns how far the hero got. */
  function attempt(state: GameState, scripts: ScriptCommand[][]): string[] {
    const errors: string[] = [];
    for (const sc of scripts) {
      const r = runScript(state, sc, 30 * 60);
      if (r.error) errors.push(r.error);
    }
    return errors;
  }

  it('K7 (enemies frozen): no way across the channel or onto the Heart Seed, braziers out of bolt range, door shut', () => {
    const { state } = prepare('k7', {
      arrive: 'w',
      weaves: [BOLT, STRIKE, LOB, null],
      noAI: true,
      without: ['frost'],
    });
    expect(state.hero.runes.some((r) => r.rune === 'frost')).toBe(false);
    const seeds = state.hero.heartSeeds;
    const errors = attempt(state, [
      [
        { do: 'moveTo', x: T(12), y: T(12) },
        { do: 'cast', slot: 0, at: at(45, 4) },
        { do: 'cast', slot: 0, at: at(45, 21) },
        { do: 'cast', slot: 2, at: { x: T(12) + 40, y: T(12) } },
        { do: 'wait', s: 2 },
      ],
      [{ do: 'moveTo', x: T(17), y: T(20), timeout: 5 }],
      [{ do: 'moveTo', x: T(37), y: T(12), timeout: 5 }],
    ]);
    expect(errors).toHaveLength(2);
    expect(anyOn(state, 'brazier')).toBe(false);
    expect(anyOn(state, 'door')).toBe(false);
    expect(state.hero.heartSeeds).toBe(seeds);
    expect(state.player.x).toBeLessThan(T(13));
  });

  it('K8 (enemies frozen): a pushed ice block stops at the pool edge, the plates stay up, door shut', () => {
    const { state } = prepare('k8', {
      arrive: 'w',
      weaves: [BOLT, STRIKE, LOB, null],
      noAI: true,
      without: ['frost'],
    });
    const errors = attempt(state, [
      [
        { do: 'moveTo', x: T(12), y: T(7), tolerance: 0.3 },
        { do: 'wait', s: 0.3 },
        { do: 'walk', dirX: 1, dirY: 0, s: 5 },
        { do: 'wait', s: 2 },
      ],
      [{ do: 'moveTo', x: T(35), y: T(15), timeout: 5 }],
    ]);
    expect(errors).toHaveLength(1);
    const block = objects(state, 'ice_block').find((o) => o.ty === 7)!;
    expect(block.tx).toBe(21);
    expect(anyOn(state, 'pressure_plate')).toBe(false);
    expect(anyOn(state, 'door')).toBe(false);
    expect(state.hero.loomShards).toBe(0);
  });

  it('K9 (enemies frozen): the ring melts from the shore, but the chest and the big-key door stay out of reach', () => {
    const { state } = prepare('k9', {
      arrive: 'w',
      weaves: [BOLT, STRIKE, LOB, null],
      noAI: true,
      without: ['frost'],
    });
    const errors = attempt(state, [
      [
        { do: 'moveTo', x: T(36), y: T(19) },
        { do: 'cast', slot: 0, at: at(49, 19) },
        { do: 'wait', s: 1 },
      ],
      [{ do: 'moveTo', x: T(47), y: T(19), timeout: 5 }],
      [
        { do: 'moveTo', x: T(29), y: T(7) },
        { do: 'walk', dirX: 0, dirY: -1, s: 3 },
      ],
    ]);
    expect(errors).toHaveLength(1);
    expect(objects(state, 'ice_block').some((o) => o.on)).toBe(true);
    expect(state.world.bigKeys).toEqual([]);
    expect(anyOn(state, 'big_key_door')).toBe(false);
    expect(state.room.id).toBe(regionRooms.k9);
  });
});
