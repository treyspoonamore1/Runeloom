import { describe, expect, it } from 'vitest';
import {
  applyElement,
  createGame,
  killEnemy,
  PLAYER_ID,
  spawnEnemy,
  step,
  type GameState,
  type TerrainElement,
} from '../../../src/sim';
import { MAT, OWNER } from '../../../data/materials';
import { inlineRoom, obj, run, runUntil, T, teleport, types } from './worldHelpers';

function hit(s: GameState, element: TerrainElement, x: number, y: number, r = 2): void {
  applyElement(s, {
    element,
    shape: { kind: 'circle', x, y, r },
    owner: OWNER.player,
    sourceId: PLAYER_ID,
    hitDamage: 10,
    durationMult: 1,
  });
}

const solidAt = (s: GameState, x: number, y: number) =>
  s.room.solid[Math.floor(y) * s.room.width + Math.floor(x)];

const BRAZIERS = `@id t/braziers
@level 1
@link D braziers:all
#########
#B.....B#
#...x...#
####D####
#.......#
#########
`;

describe('braziers and braziers:all', () => {
  it('Fire lights a brazier; Frost and Storm do not', () => {
    const s = inlineRoom(BRAZIERS);
    hit(s, 'frost', T(1), T(1));
    hit(s, 'storm', T(1), T(1));
    expect(obj(s, 'brazier').on).toBe(false);
    s.events.length = 0;
    hit(s, 'fire', T(1), T(1));
    expect(obj(s, 'brazier').on).toBe(true);
    expect(types(s)).toContain('brazierLit');
  });

  it('a brazier conducts Storm like metal (M3 material)', () => {
    const s = inlineRoom(BRAZIERS);
    hit(s, 'storm', T(7), T(1));
    expect(s.events.some((e) => e.type === 'metalElectrified')).toBe(true);
    expect(s.grid.charge[T(1) * s.grid.width + T(7)]).toBeGreaterThan(0);
  });

  it('the door opens when every brazier is lit, becomes floor and stays open', () => {
    const s = inlineRoom(BRAZIERS);
    const door = obj(s, 'door');
    expect(door.link).toBe('D');
    expect(solidAt(s, T(4), T(3))).toBe(1);
    expect(s.room.shotSolid[T(3) * s.room.width + T(4)]).toBe(1);
    hit(s, 'fire', T(1), T(1));
    run(s, 2);
    expect(door.on).toBe(false);
    const walk = s.grid.walkVersion;
    hit(s, 'fire', T(7), T(1));
    const seen = runUntil(s, () => door.on, 3);
    expect(door.on).toBe(true);
    expect(seen.map((e) => e.type)).toContain('doorOpened');
    expect(solidAt(s, T(4), T(3))).toBe(0);
    expect(s.grid.ground[T(3) * s.grid.width + T(4)]).toBe(MAT.stone);
    expect(s.grid.walkVersion).toBeGreaterThan(walk);
    expect(s.world.flags['t/braziers']!.opened).toEqual([door.key]);
  });
});

describe('timer:N:braziers:all', () => {
  const ROOM = `@id t/timer
@level 1
@link D timer:2:braziers:all
#########
#B.....B#
#...x...#
####D####
#.......#
#########
`;

  it('a lit brazier goes out after N seconds unless the group completes', () => {
    const s = inlineRoom(ROOM);
    const b = obj(s, 'brazier');
    hit(s, 'fire', T(1), T(1));
    expect(b.timer).toBeCloseTo(2);
    const seen = runUntil(s, () => !b.on, 200);
    expect(b.on).toBe(false);
    expect(s.tick).toBeGreaterThanOrEqual(119);
    expect(seen.map((e) => e.type)).toContain('brazierOut');
    expect(obj(s, 'door').on).toBe(false);
  });

  it('both lit within the time opens the door and they stay lit', () => {
    const s = inlineRoom(ROOM);
    hit(s, 'fire', T(1), T(1));
    run(s, 60);
    hit(s, 'fire', T(7), T(1));
    run(s, 1);
    expect(obj(s, 'door').on).toBe(true);
    run(s, 300);
    expect(obj(s, 'brazier', 0).on).toBe(true);
    expect(obj(s, 'brazier', 1).on).toBe(true);
  });
});

const PUSH = `@id t/push
@level 1
@link D plates:all
##########
#........#
#.x.P.T..#
#........#
#####D####
#........#
##########
`;

describe('push blocks and pressure plates', () => {
  /** Stands west of the block and holds east for `ticks`. */
  function pushEast(s: GameState, ticks: number): void {
    const b = obj(s, 'push_block');
    teleport(s, b.tx * 4 - 1.6, T(b.ty));
    run(s, ticks, { moveX: 1, moveY: 0, aimX: 0, aimY: 0, buttons: 0 });
  }

  it('walking into a block for about 0.4 s pushes it one tile', () => {
    const s = inlineRoom(PUSH);
    const b = obj(s, 'push_block');
    pushEast(s, 20);
    expect(b.tx).toBe(4);
    run(s, 6, { moveX: 1, moveY: 0, aimX: 0, aimY: 0, buttons: 0 });
    expect(b.tx).toBe(5);
    expect(solidAt(s, T(4), T(2))).toBe(0);
    expect(solidAt(s, T(5), T(2))).toBe(1);
  });

  it('a diagonal or weak push does nothing', () => {
    const s = inlineRoom(PUSH);
    const b = obj(s, 'push_block');
    teleport(s, b.tx * 4 - 1.6, T(b.ty));
    run(s, 60, { moveX: 0.5, moveY: 0.5, aimX: 0, aimY: 0, buttons: 0 });
    expect(b.tx).toBe(4);
  });

  it('a block pushed onto a plate presses it, and plates:all opens the door', () => {
    const s = inlineRoom(PUSH);
    const b = obj(s, 'push_block');
    const plate = obj(s, 'pressure_plate');
    const seen = runUntil(s, () => b.tx === 6, 200, { moveX: 1, moveY: 0, aimX: 0, aimY: 0, buttons: 0 });
    expect(seen.filter((e) => e.type === 'blockMoved')).toHaveLength(2);
    run(s, 15);
    expect(plate.on).toBe(true);
    expect(obj(s, 'door').on).toBe(true);
  });

  it("doesn't push into a wall, and the block remembers the floor under it", () => {
    const s = inlineRoom(PUSH);
    const b = obj(s, 'push_block');
    teleport(s, T(b.tx), T(b.ty) + 3.6);
    run(s, 60, { moveX: 0, moveY: -1, aimX: 0, aimY: 0, buttons: 0 });
    expect(b.ty).toBe(1);
    run(s, 60, { moveX: 0, moveY: -1, aimX: 0, aimY: 0, buttons: 0 });
    expect(b.ty).toBe(1);
    expect(s.grid.ground[T(2) * s.grid.width + T(4)]).toBe(MAT.stone);
  });

  it('the player and enemies press plates while standing on them', () => {
    const s = inlineRoom(PUSH);
    const plate = obj(s, 'pressure_plate');
    teleport(s, T(6), T(2));
    run(s, 1);
    expect(plate.on).toBe(true);
    expect(types(s)).toContain('plateChanged');
    teleport(s, T(1), T(1));
    run(s, 1);
    expect(plate.on).toBe(false);
    s.cheats.noAI = true;
    spawnEnemy(s, 'tinderling', T(6), T(2));
    run(s, 1);
    expect(plate.on).toBe(true);
  });
});

describe('ice blocks', () => {
  const ROOM = `@id t/ice
@level 1
############
#..........#
#.x.Iiiii..#
#..........#
############
`;

  it('slides on ice until it leaves the ice or is blocked', () => {
    const s = inlineRoom(ROOM);
    const b = obj(s, 'ice_block');
    teleport(s, 4 * 4 - 1.6, T(2));
    run(s, 26, { moveX: 1, moveY: 0, aimX: 0, aimY: 0, buttons: 0 });
    const seen = runUntil(s, () => b.timer === 0 && b.vx === 0, 120);
    // Pushed onto the first ice tile, it slides over the rest and stops on the first stone tile.
    expect(b.tx).toBe(9);
    expect(seen.some((e) => e.type === 'blockMoved' && e.slide)).toBe(true);
    expect(seen.map((e) => e.type)).toContain('blockStopped');
  });

  it('Fire melts it into shallow water', () => {
    const s = inlineRoom(ROOM);
    const b = obj(s, 'ice_block');
    hit(s, 'fire', T(4), T(2), 1);
    expect(b.on).toBe(true);
    expect(types(s)).toContain('iceBlockMelted');
    expect(s.grid.ground[T(2) * s.grid.width + T(4)]).toBe(MAT.shallow_water);
    expect(solidAt(s, T(4), T(2))).toBe(0);
  });
});

describe('conduit switches, switch:S and @note', () => {
  const ROOM = `@id t/switch
@level 1
@link D switch:S
@note S The Fen isn't woven yet.
#########
#...x...#
#.mMS...#
#.......#
####D####
#.......#
#########
`;

  it('a Storm hit on the switch powers it and opens the door, with its note', () => {
    const s = inlineRoom(ROOM);
    hit(s, 'storm', T(4), T(2), 1);
    const sw = obj(s, 'conduit_switch');
    expect(sw.on).toBe(true);
    const note = s.events.find((e) => e.type === 'note');
    expect(note).toMatchObject({ type: 'note', text: "The Fen isn't woven yet." });
    run(s, 1);
    expect(obj(s, 'door').on).toBe(true);
  });

  it('charge reaching the switch through a metal pylon powers it', () => {
    const s = inlineRoom(ROOM);
    hit(s, 'storm', T(2), T(2), 1);
    expect(obj(s, 'conduit_switch').on).toBe(false);
    run(s, 1);
    expect(obj(s, 'conduit_switch').on).toBe(true);
  });

  it('Fire does not power it', () => {
    const s = inlineRoom(ROOM);
    hit(s, 'fire', T(4), T(2), 1);
    run(s, 2);
    expect(obj(s, 'conduit_switch').on).toBe(false);
  });
});

describe('cleared', () => {
  it('opens when the last enemy dies; a room without enemies is cleared on entry', () => {
    const ROOM = `@id t/cleared
@level 1
@spawn 1 enemy:tinderling
@link D cleared
#########
#...x.1.#
####D####
#.......#
#########
`;
    const s = inlineRoom(ROOM);
    s.cheats.noAI = true;
    run(s, 1);
    expect(obj(s, 'door').on).toBe(false);
    killEnemy(s, s.enemies[0]!, PLAYER_ID, 'hit');
    run(s, 1);
    expect(obj(s, 'door').on).toBe(true);
    const empty = inlineRoom(ROOM.replace('@spawn 1 enemy:tinderling\n', '').replace('.1.', '...'));
    run(empty, 1);
    expect(obj(empty, 'door').on).toBe(true);
  });
});

describe('keys, chests and key doors', () => {
  const ROOM = `@id kiln/t_keys
@level 1
###########
#.k.x...g.#
#.........#
##K#####G##
#.........#
###########
`;

  it('a locked door says so once per touch, opens with a small key and uses it up', () => {
    const s = inlineRoom(ROOM);
    const door = obj(s, 'locked_door');
    teleport(s, T(2), T(2) + 0.2);
    const first = runUntil(s, () => false, 10, { moveX: 0, moveY: 1, aimX: 0, aimY: 0, buttons: 0 });
    expect(first.filter((e) => e.type === 'doorLocked')).toHaveLength(1);
    expect(door.on).toBe(false);
    teleport(s, T(2), T(1) + 2.5);
    run(s, 2, { moveX: 0, moveY: -1, aimX: 0, aimY: 0, buttons: 0 });
    expect(obj(s, 'key_chest').on).toBe(true);
    expect(s.world.keys.kiln).toBe(1);
    teleport(s, T(2), T(2) + 0.2);
    const seen = runUntil(s, () => door.on, 10, { moveX: 0, moveY: 1, aimX: 0, aimY: 0, buttons: 0 });
    expect(door.on).toBe(true);
    expect(seen.map((e) => e.type)).toEqual(expect.arrayContaining(['keyUsed', 'doorOpened']));
    expect(s.world.keys.kiln).toBe(0);
    expect(s.world.flags['kiln/t_keys']!.taken).toContain(obj(s, 'key_chest').key);
  });

  it('the big-key chest gives the dungeon big key, which opens G without being used up', () => {
    const s = inlineRoom(ROOM);
    teleport(s, T(8), T(1) + 2.5);
    run(s, 2, { moveX: 0, moveY: -1, aimX: 0, aimY: 0, buttons: 0 });
    expect(s.world.bigKeys).toEqual(['kiln']);
    teleport(s, T(8), T(2) + 0.2);
    runUntil(s, () => obj(s, 'big_key_door').on, 10, { moveX: 0, moveY: 1, aimX: 0, aimY: 0, buttons: 0 });
    expect(obj(s, 'big_key_door').on).toBe(true);
    expect(s.world.bigKeys).toEqual(['kiln']);
  });
});

describe('pickups and Loom Stones', () => {
  const ROOM = `@id t/pick
@level 1
#########
#.H...L.#
#...x...#
#########
`;

  it('Heart Seeds and Loom Shards are taken on touch, once', () => {
    const s = inlineRoom(ROOM);
    teleport(s, T(2), T(1));
    run(s, 1);
    expect(s.hero.heartSeeds).toBe(1);
    expect(s.events.find((e) => e.type === 'pickup')).toMatchObject({ kind: 'heart_seed', total: 1 });
    run(s, 5);
    expect(s.hero.heartSeeds).toBe(1);
    teleport(s, T(6), T(1));
    run(s, 1);
    expect(s.hero.loomShards).toBe(1);
    expect(s.world.flags['t/pick']!.taken).toHaveLength(2);
  });

  it('a Loom Stone activates on touch and becomes the respawn point', () => {
    const s = inlineRoom(ROOM);
    run(s, 1);
    const stone = obj(s, 'loom_stone');
    expect(stone.on).toBe(true);
    expect(s.world.loomStones).toEqual([`t/pick#${stone.key}`]);
    expect(s.world.respawn).toEqual({ roomId: 't/pick', key: stone.key });
    expect(s.events.find((e) => e.type === 'loomStoneActivated')).toMatchObject({ first: true });
  });
});

describe('objects outside adventure mode', () => {
  it('sandbox games have none, so M3 rooms play as before', () => {
    const s = createGame({ seed: 1, roomText: BRAZIERS });
    expect(s.objects).toEqual([]);
    hit(s, 'fire', T(1), T(1));
    step(s, { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 });
    expect(s.objects).toEqual([]);
  });
});
