import { afterEach, describe, expect, it } from 'vitest';
import { applyHeroEdit } from '../../../src/sim/hero/edits';
import {
  buildRegionMap,
  createAdventure,
  createWorldState,
  killEnemy,
  killPlayer,
  PLAYER_ID,
  type GameState,
  type InputFrame,
} from '../../../src/sim';
import { bossKinds } from '../../../data/progression';
import { adventure, obj, ROOMS, run, runUntil, T, teleport } from './worldHelpers';

const EAST: InputFrame = { moveX: 1, moveY: 0, aimX: 0, aimY: 0, buttons: 0 };
const SOUTH: InputFrame = { moveX: 0, moveY: 1, aimX: 0, aimY: 0, buttons: 0 };

function toB(s: GameState): void {
  runUntil(s, (st) => st.room.id === 'test/world_b', 300, EAST);
  expect(s.room.id).toBe('test/world_b');
}

describe('createAdventure', () => {
  it('starts at the start room Loom Stone, which becomes the respawn point', () => {
    const s = adventure('test/world_a');
    expect(s.mode).toBe('adventure');
    expect(s.room.id).toBe('test/world_a');
    expect([s.player.x, s.player.y]).toEqual([T(3), T(2)]);
    expect(s.weaves.slots.map((w) => w.notation)).toEqual([
      'Cast > Bolt[Fire]',
      'Cast > Strike[]',
      null,
      null,
    ]);
    run(s, 1);
    expect(s.world.respawn).toEqual({ roomId: 'test/world_a', key: 'loom_stone@3,2' });
  });

  it('a save starts at its respawn Loom Stone', () => {
    const world = createWorldState('test/world_c');
    world.respawn = { roomId: 'test/world_c', key: 'loom_stone@2,2' };
    world.loomStones = ['test/world_c#loom_stone@2,2'];
    const s = createAdventure({ seed: 1, rooms: ROOMS, world });
    expect(s.room.id).toBe('test/world_c');
    expect([s.player.x, s.player.y]).toEqual([T(2), T(2)]);
    expect(obj(s, 'loom_stone').on).toBe(true);
  });
});

describe('death and respawn', () => {
  it('respawns at the respawn Loom Stone with full life and mana, and rooms repopulate', () => {
    const s = adventure('test/world_a');
    run(s, 1);
    toB(s);
    s.cheats.noAI = true;
    killEnemy(s, s.enemies[0]!, PLAYER_ID, 'hit');
    killEnemy(s, s.enemies[1]!, PLAYER_ID, 'hit');
    run(s, 1);
    expect(s.world.flags['test/world_b']!.cleared).toBe(true);
    s.player.mana = 1;
    killPlayer(s);
    const seen = runUntil(s, (st) => st.room.id === 'test/world_a', 200);
    expect(seen.map((e) => e.type)).toEqual(expect.arrayContaining(['playerRespawn', 'roomEnter']));
    expect(s.room.id).toBe('test/world_a');
    expect([s.player.x, s.player.y]).toEqual([T(3), T(2)]);
    expect(s.player.dead).toBe(false);
    expect(s.player.life).toBe(s.player.maxLife);
    expect(s.player.mana).toBe(s.player.maxMana);
    expect(s.world.flags['test/world_b']!.cleared).toBe(false);
    expect(s.world.flags['test/world_b']!.rewardsPaid).toBe(true);
  });
});

describe('rest', () => {
  it('at a Loom Stone: full life and mana, rooms repopulate, terrain resets', () => {
    const s = adventure('test/world_a');
    run(s, 1);
    s.world.flags['test/world_b'] = {
      visited: true,
      cleared: true,
      rewardsPaid: true,
      opened: [],
      taken: [],
    };
    s.player.life = 5;
    s.player.mana = 0;
    expect(applyHeroEdit(s, { kind: 'rest' })).toBeNull();
    expect(s.player.life).toBe(s.player.maxLife);
    expect(s.player.mana).toBe(s.player.maxMana);
    expect(s.world.flags['test/world_b']!.cleared).toBe(false);
    expect(s.events.map((e) => e.type)).toEqual(expect.arrayContaining(['roomEnter', 'rested']));
    toB(s);
    expect(s.enemies.length).toBe(2);
  });

  it('away from a Loom Stone it is refused', () => {
    const s = adventure('test/world_a');
    run(s, 1);
    teleport(s, T(7), T(4));
    expect(applyHeroEdit(s, { kind: 'rest' })).toMatch(/not at an activated Loom Stone/);
  });
});

describe('fast travel', () => {
  it('between activated Loom Stones only, from one', () => {
    const s = adventure('test/world_a');
    run(s, 1);
    expect(applyHeroEdit(s, { kind: 'travel', roomId: 'test/world_c', key: 'loom_stone@2,2' })).toMatch(
      /not an activated Loom Stone/,
    );
    teleport(s, T(4), T(3));
    runUntil(s, (st) => st.room.id === 'test/world_c', 400, SOUTH);
    expect(s.room.id).toBe('test/world_c');
    expect(applyHeroEdit(s, { kind: 'travel', roomId: 'test/world_a', key: 'loom_stone@3,2' })).toMatch(
      /not at an activated Loom Stone/,
    );
    teleport(s, T(2), T(2));
    run(s, 1);
    expect(s.world.loomStones).toEqual(['test/world_a#loom_stone@3,2', 'test/world_c#loom_stone@2,2']);
    expect(applyHeroEdit(s, { kind: 'travel', roomId: 'test/world_a', key: 'loom_stone@3,2' })).toBeNull();
    expect(s.room.id).toBe('test/world_a');
    expect([s.player.x, s.player.y]).toEqual([T(3), T(2)]);
    expect(s.world.respawn).toEqual({ roomId: 'test/world_a', key: 'loom_stone@3,2' });
  });
});

describe('boss rooms', () => {
  const kinds = bossKinds as string[];
  afterEach(() => {
    const i = kinds.indexOf('shieldbearer');
    if (i >= 0) kinds.splice(i, 1);
  });

  it('clear when the boss dies, remember it, and never repopulate', () => {
    kinds.push('shieldbearer');
    const s = adventure('test/world_d');
    s.cheats.noAI = true;
    const boss = s.enemies.find((e) => e.kind === 'shieldbearer')!;
    run(s, 1);
    expect(s.world.flags['test/world_d']!.cleared).toBe(false);
    killEnemy(s, boss, PLAYER_ID, 'hit');
    run(s, 1);
    expect(s.world.bossesDefeated).toEqual(['shieldbearer']);
    expect(s.world.flags['test/world_d']!.cleared).toBe(true);
    expect(s.enemies.some((e) => !e.dead && e.kind === 'tinderling')).toBe(true);
    killPlayer(s);
    runUntil(s, (st) => st.events.some((e) => e.type === 'roomEnter'), 200);
    expect(s.world.flags['test/world_d']!.cleared).toBe(true);
    expect(s.enemies).toEqual([]);
  });
});

describe('region map', () => {
  it('lays out the connected rooms from their exits, stably', () => {
    const s = adventure('test/world_a');
    run(s, 1);
    const map = buildRegionMap(s);
    const at = Object.fromEntries(map.nodes.map((n) => [n.id, [n.x, n.y]]));
    expect(at).toEqual({
      'test/world_a': [0, 0],
      'test/world_b': [1, 0],
      'test/world_c': [0, 1],
      'test/world_d': [2, 0],
    });
    const a = map.nodes.find((n) => n.id === 'test/world_a')!;
    expect(a).toMatchObject({ name: 'Test Glade', level: 1, visited: true, current: true, region: 'test' });
    expect(a.loomStones).toEqual([{ key: 'loom_stone@3,2', tx: 3, ty: 2, active: true }]);
    expect(map.bounds).toEqual({ minX: 0, minY: 0, maxX: 2, maxY: 1 });
    toB(s);
    const again = Object.fromEntries(buildRegionMap(s).nodes.map((n) => [n.id, [n.x, n.y]]));
    expect(again).toEqual(at);
  });
});
