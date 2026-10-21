/**
 * Scripted solutions for the Emberwood puzzle rooms (BUILD_PLAN M4 task 10), following
 * data/rooms/SOLUTIONS.md. Each starts a new-game adventure in the room with the runes unlocked by
 * then (regionSolve.ts), runs the script with the world driver (src/sim/bots/script.ts) and
 * asserts the door-open or pickup state.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { MAT } from '../../../data/materials';
import { regionRooms } from '../../../data/progression';
import { step, type GameState } from '../../../src/sim';
import { CampaignNav } from '../../../src/sim/bots/campaignNav';
import {
  allOn,
  anyOn,
  at,
  BOLT,
  into,
  LOB,
  noFire,
  noneLeft,
  prepare,
  solve,
  STRIKE,
  SWATH,
  T,
  ticksLog,
} from './regionSolve';

afterAll(() => console.log('solution ticks', JSON.stringify(ticksLog)));

describe('Emberwood puzzle solutions', () => {
  it('E1 (enemies frozen): Bolt[Fire] burns the bramble wall, the east exit leads to E2', () => {
    const { state } = prepare('e1', {
      arrive: null,
      weaves: ['Cast > Bolt[Fire]', 'Cast > Strike[]'],
      noAI: true,
    });
    solve('e1', state, [
      { do: 'moveTo', x: T(40), y: T(13) },
      { do: 'cast', slot: 0, at: at(47, 12) },
      {
        do: 'until',
        cond: (s) => noneLeft(s, MAT.bramble, 43, 10, 46, 16) && noFire(s, 43, 10, 46, 16),
        timeout: 15,
        label: 'bramble gone',
      },
      { do: 'moveTo', x: T(46), y: T(12) },
      { do: 'walk', dirX: 1, dirY: 0, s: 3, until: (s) => s.room.id === regionRooms.e2 },
    ]);
    expect(state.room.id).toBe(regionRooms.e2);
  });
  it('E2 (enemies frozen): Swath[Fire] opens the bramble pocket, the Loom Shard is taken', () => {
    const { state } = prepare('e2', { arrive: 'w', weaves: [BOLT, STRIKE, SWATH, null], noAI: true });
    solve('e2', state, [
      { do: 'moveTo', x: T(3), y: T(21) },
      { do: 'cast', slot: 2, at: at(3, 26) },
      {
        do: 'until',
        cond: (s) => noneLeft(s, MAT.bramble, 2, 23, 4, 24) && noFire(s, 1, 22, 5, 28),
        timeout: 10,
        label: 'plug burned',
      },
      { do: 'moveTo', x: T(3), y: T(27) },
      { do: 'until', cond: (s) => s.hero.loomShards === 1, timeout: 3, label: 'shard taken' },
    ]);
    expect(state.hero.loomShards).toBe(1);
  });

  it('E3 (enemies frozen): Swath[Fire] from the east bank drops the bridge into the river', () => {
    const { state } = prepare('e3', { arrive: 'w', weaves: [BOLT, STRIKE, SWATH, null], noAI: true });
    const cut = (s: GameState) =>
      [...Array(13).keys()].some(
        (i) =>
          noneLeft(s, MAT.wood, 21 + i, 12, 21 + i, 13) &&
          s.grid.ground[12 * 4 * s.grid.width + (21 + i) * 4] === MAT.deep_water,
      );
    solve('e3', state, [
      { do: 'moveTo', x: T(34), y: T(12) },
      { do: 'cast', slot: 2, at: { x: T(28), y: T(12) - 1 } },
      { do: 'cast', slot: 2, at: { x: T(28), y: T(13) } },
      { do: 'moveTo', x: T(37), y: T(12) },
      { do: 'until', cond: cut, timeout: 20, label: 'a bridge column is gone' },
    ]);
    expect(cut(state)).toBe(true);
  });

  it('E3 (AI on, god mode): once the bridge drops, the Tinderlings still on the west bank stay there', () => {
    const { state } = prepare('e3', { arrive: 'w', weaves: [BOLT, STRIKE, SWATH, null], god: true });
    const tinderlings = () => state.enemies.filter((e) => !e.dead && e.kind === 'tinderling');
    const cut = (s: GameState) =>
      [...Array(13).keys()].some((i) => noneLeft(s, MAT.wood, 21 + i, 12, 21 + i, 13));
    solve('e3 chase', state, [
      { do: 'moveTo', x: T(34), y: T(12) },
      { do: 'cast', slot: 2, at: { x: T(28), y: T(12) - 1 } },
      { do: 'cast', slot: 2, at: { x: T(28), y: T(13) } },
      { do: 'moveTo', x: T(40), y: T(12) },
      { do: 'until', cond: cut, timeout: 20, label: 'a bridge column is gone' },
    ]);
    const westIds = tinderlings()
      .filter((e) => e.x < T(21))
      .map((e) => e.id);
    const crossed = tinderlings().length - westIds.length;
    solve('e3 chase wait', state, [{ do: 'wait', s: 15 }]);
    const stillWest = tinderlings().filter((e) => westIds.includes(e.id));
    expect(stillWest.every((e) => e.x < T(21))).toBe(true);
    expect(westIds.length).toBeGreaterThan(0);
    // How much of the pack the drop cuts off (reported; the wood's 6 s fuse lets the front runners through).
    ticksLog['e3 tinderlings cut off'] = westIds.length;
    ticksLog['e3 tinderlings across'] = crossed;
  });

  it('E4 (enemies frozen): Bolt[Fire] burns the crate wall (the barrel blows), the Heart Seed is taken', () => {
    const { state } = prepare('e4', { arrive: 'n', weaves: [BOLT, STRIKE, null, null], noAI: true });
    const seeds = state.hero.heartSeeds;
    solve('e4', state, [
      { do: 'moveTo', x: T(14), y: T(29) },
      { do: 'cast', slot: 0, at: at(12, 29) },
      { do: 'moveTo', x: T(19), y: T(29) },
      {
        do: 'until',
        cond: (s) => noneLeft(s, MAT.crate, 11, 26, 12, 29) && noFire(s, 7, 25, 13, 31),
        timeout: 25,
        label: 'crates gone',
      },
      { do: 'moveTo', x: T(8), y: T(29) },
      { do: 'until', cond: (s) => s.hero.heartSeeds === seeds + 1, timeout: 3, label: 'heart seed taken' },
    ]);
    expect(state.hero.heartSeeds).toBe(seeds + 1);
    expect(noneLeft(state, MAT.oil_barrel, 10, 27, 10, 27)).toBe(true);
  });

  it('E5 (god mode): the player crosses the grass field under archer fire to the east exit', () => {
    const { state } = prepare('e5', { arrive: 'w', weaves: [BOLT, STRIKE, null, null], god: true });
    solve('e5', state, [
      { do: 'moveTo', x: T(35), y: T(19) },
      { do: 'moveTo', x: T(70), y: T(19) },
      { do: 'walk', dirX: 1, dirY: 0, s: 3, until: into(regionRooms.e6) },
    ]);
    expect(state.room.id).toBe(regionRooms.e6);
  });

  it('E6 (campaign bot fights in god mode): the garden door opens when the room is cleared, Heart Seed taken', () => {
    const { state } = prepare('e6', { arrive: 'w', weaves: [BOLT, STRIKE, null, null], god: true });
    expect(anyOn(state, 'door')).toBe(false);
    let t = 0;
    const nav = new CampaignNav();
    for (; t < 240 * 60 && state.enemies.some((e) => !e.dead); t++) {
      step(state, nav.input(state));
      if (state.enemies.some((e) => !e.dead)) expect(anyOn(state, 'door')).toBe(false);
    }
    ticksLog['e6 fight'] = t;
    expect(state.enemies.filter((e) => !e.dead)).toEqual([]);
    const seeds = state.hero.heartSeeds;
    solve('e6', state, [
      { do: 'until', cond: (s) => allOn(s, 'door'), timeout: 2, label: 'door opens' },
      { do: 'moveTo', x: T(57), y: T(20) },
      { do: 'moveTo', x: T(59), y: T(25) },
      { do: 'until', cond: (s) => s.hero.heartSeeds === seeds + 1, timeout: 3, label: 'heart seed taken' },
    ]);
  });

  it('E7 (enemies frozen): three braziers inside 10 s open the heartwood door, Loom Shard taken', () => {
    const { state } = prepare('e7', { arrive: 's', weaves: [BOLT, STRIKE, LOB, null], noAI: true });
    let firstLit = -1;
    let opened = -1;
    const r = solve('e7', state, [
      { do: 'moveTo', x: T(10), y: T(19) },
      { do: 'cast', slot: 0, at: at(4, 5) },
      {
        do: 'until',
        cond: (s) => {
          if (anyOn(s, 'brazier') && firstLit < 0) firstLit = s.tick;
          return firstLit >= 0;
        },
        timeout: 2,
      },
      { do: 'moveTo', x: T(13), y: T(22) },
      { do: 'cast', slot: 2, at: at(22, 25) },
      { do: 'moveTo', x: T(35), y: T(19) },
      { do: 'cast', slot: 0, at: at(41, 5) },
      {
        do: 'until',
        cond: (s) => {
          if (allOn(s, 'door')) opened = s.tick;
          return opened >= 0;
        },
        timeout: 3,
        label: 'door opens',
      },
      { do: 'moveTo', x: T(22), y: T(16) },
      { do: 'until', cond: (s) => s.hero.loomShards === 1, timeout: 3 },
    ]);
    expect((opened - firstLit) / 60).toBeLessThan(10);
    ticksLog['e7 first light to door'] = opened - firstLit;
    void r;
  });

  it('E7 (enemies frozen): the door stays shut when the last brazier is lit after 10 s', () => {
    const { state } = prepare('e7', { arrive: 's', weaves: [BOLT, STRIKE, LOB, null], noAI: true });
    solve('e7 slow', state, [
      { do: 'moveTo', x: T(10), y: T(19) },
      { do: 'cast', slot: 0, at: at(4, 5) },
      { do: 'moveTo', x: T(13), y: T(22) },
      { do: 'cast', slot: 2, at: at(22, 25) },
      { do: 'wait', s: 10 },
      { do: 'moveTo', x: T(35), y: T(19) },
      { do: 'cast', slot: 0, at: at(41, 5) },
      { do: 'wait', s: 2 },
    ]);
    expect(anyOn(state, 'door')).toBe(false);
  });
});
