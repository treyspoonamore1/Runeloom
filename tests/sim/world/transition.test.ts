import { describe, expect, it, vi } from 'vitest';

const rewards = vi.hoisted(() => ({ cleared: [] as string[] }));
vi.mock('../../../src/sim/hero/rewards', () => ({
  onRoomCleared: (_state: unknown, roomId: string) => rewards.cleared.push(roomId),
}));

import {
  applyElement,
  arrivalPoint,
  buildRoom,
  hashState,
  killEnemy,
  parseRoom,
  PLAYER_ID,
  runScript,
  type GameState,
  type InputFrame,
} from '../../../src/sim';
import { MAT, OWNER } from '../../../data/materials';
import { adventure, inlineRoom, obj, run, runUntil, T, teleport } from './worldHelpers';

const EAST: InputFrame = { moveX: 1, moveY: 0, aimX: 0, aimY: 0, buttons: 0 };
const WEST: InputFrame = { moveX: -1, moveY: 0, aimX: 0, aimY: 0, buttons: 0 };

/** Walks the player out of test/world_a through its east exit. */
function aToB(s: GameState): void {
  runUntil(s, (st) => st.room.id === 'test/world_b', 300, EAST);
}

describe('edge exits', () => {
  it('walking out east arrives just inside the west exit of the next room', () => {
    const s = adventure('test/world_a');
    const seen = runUntil(s, (st) => st.room.id === 'test/world_b', 300, EAST);
    expect(s.room.id).toBe('test/world_b');
    expect(s.world.roomId).toBe('test/world_b');
    // world_b's west exits are tiles (0, 2) and (0, 3): centered on them, 2.5 cells in.
    expect(s.player.x).toBeCloseTo(2.5);
    expect(s.player.y).toBeCloseTo(12);
    expect(s.player.faceX).toBe(1);
    const enter = seen.filter((e) => e.type === 'roomEnter');
    expect(enter).toEqual([
      {
        type: 'roomEnter',
        id: 'test/world_b',
        name: 'Test Ford',
        level: 2,
        arrival: 'edge',
        firstVisit: true,
      },
    ]);
    expect(s.world.pending).toBeNull();
    expect(s.enemies.length).toBe(2);
  });

  it('and back again, onto the east edge, as a second visit', () => {
    const s = adventure('test/world_a');
    aToB(s);
    const seen = runUntil(s, (st) => st.room.id === 'test/world_a', 300, WEST);
    expect(s.room.id).toBe('test/world_a');
    expect(s.player.x).toBeCloseTo(40 - 2.5);
    expect(s.player.y).toBeCloseTo(12);
    expect(seen.find((e) => e.type === 'roomEnter')).toMatchObject({ firstVisit: false });
  });

  it('standing on an exit tile facing into the room does not leave', () => {
    const s = adventure('test/world_a');
    teleport(s, 40 - 1.6, 10);
    s.player.faceX = -1;
    s.player.faceY = 0;
    run(s, 30);
    expect(s.room.id).toBe('test/world_a');
  });

  it('arrival picks the opening nearest to where the player left', () => {
    const room = buildRoom(
      parseRoom(`@id t/two
#####
<...#
#...#
#...#
<...#
#####
`),
    );
    expect(arrivalPoint(room, 'w', 0.1, 1.5)).toEqual({ x: 2.5, y: 6 });
    expect(arrivalPoint(room, 'w', 0.9, 1.5)).toEqual({ x: 2.5, y: 18 });
    expect(arrivalPoint(room, 'e', 0.5, 1.5)).toBeNull();
  });

  it('loot left on the floor is collected on the way out', () => {
    const s = adventure('test/world_a');
    s.loot.push({ id: s.nextId++, x: 10, y: 10, age: 0, content: { kind: 'scrap', amount: 3 } });
    aToB(s);
    expect(s.loot).toEqual([]);
    expect(s.hero.threadScrap).toBe(3);
  });
});

describe('what rooms remember', () => {
  const A = `@id t/a
@level 1
@exit e t/b
@link D braziers:all
##########
#B...""..#
#..x.....>
###D######
#..H.....#
##########
`;
  const B = `@id t/b
@level 1
@exit w t/a
#######
#.....#
<.....#
#######
`;

  it('terrain resets on re-entry; open doors, taken pickups and Loom Stones stay', () => {
    const s = inlineRoom(A, { 't/b': B });
    applyElement(s, {
      element: 'fire',
      shape: { kind: 'circle', x: T(1), y: T(1), r: 2 },
      owner: OWNER.player,
      sourceId: PLAYER_ID,
      hitDamage: 10,
      durationMult: 1,
    });
    run(s, 1);
    expect(obj(s, 'door').on).toBe(true);
    teleport(s, T(3), T(4));
    run(s, 1);
    expect(s.hero.heartSeeds).toBe(1);
    // Burn the grass down to ash.
    applyElement(s, {
      element: 'fire',
      shape: { kind: 'circle', x: T(5.5), y: T(1), r: 4 },
      owner: OWNER.player,
      sourceId: PLAYER_ID,
      hitDamage: 10,
      durationMult: 1,
    });
    run(s, 200);
    expect(s.grid.ground[T(1) * s.grid.width + T(5)]).toBe(MAT.ash);
    teleport(s, T(3), T(2));
    runUntil(s, (st) => st.room.id === 't/b', 300, EAST);
    expect(s.room.id).toBe('t/b');
    runUntil(s, (st) => st.room.id === 't/a', 300, WEST);
    expect(s.room.id).toBe('t/a');
    expect(s.grid.ground[T(1) * s.grid.width + T(5)]).toBe(MAT.grass);
    expect(obj(s, 'door').on).toBe(true);
    expect(s.room.solid[T(3) * s.room.width + T(3)]).toBe(0);
    expect(obj(s, 'brazier').on).toBe(true);
    expect(obj(s, 'heart_seed').on).toBe(true);
    expect(obj(s, 'loom_stone').on).toBe(true);
    teleport(s, T(3), T(4));
    run(s, 2);
    expect(s.hero.heartSeeds).toBe(1);
  });
});

describe('cleared rooms and first-clear rewards', () => {
  it('fires once when the last enemy dies; the room stays empty on re-entry', () => {
    rewards.cleared.length = 0;
    const s = adventure('test/world_a');
    expect(rewards.cleared).toEqual(['test/world_a']);
    aToB(s);
    s.cheats.noAI = true;
    for (const e of s.enemies) killEnemy(s, e, PLAYER_ID, 'hit');
    run(s, 1);
    expect(s.world.flags['test/world_b']).toMatchObject({ cleared: true, rewardsPaid: true });
    expect(s.events.find((e) => e.type === 'roomCleared')).toMatchObject({ id: 'test/world_b', first: true });
    expect(rewards.cleared).toEqual(['test/world_a', 'test/world_b']);
    run(s, 10);
    runUntil(s, (st) => st.room.id === 'test/world_a', 300, WEST);
    runUntil(s, (st) => st.room.id === 'test/world_b', 300, EAST);
    expect(s.room.id).toBe('test/world_b');
    expect(s.enemies).toEqual([]);
    expect(rewards.cleared).toEqual(['test/world_a', 'test/world_b']);
  });
});

describe('determinism', () => {
  it('the same run through a transition gives the same hash twice', () => {
    const go = () => {
      const s = adventure('test/world_a', {}, 7);
      const r = runScript(s, [
        { do: 'walk', dirX: 1, dirY: 0, s: 3, until: (st) => st.room.id === 'test/world_b' },
        { do: 'cast', slot: 0, at: { x: T(5), y: T(3) } },
        { do: 'wait', s: 2 },
        { do: 'walk', dirX: -1, dirY: 0, s: 3, until: (st) => st.room.id === 'test/world_a' },
        { do: 'wait', s: 1 },
      ]);
      expect(r.error).toBeUndefined();
      return hashState(s);
    };
    expect(go()).toBe(go());
  });
});
