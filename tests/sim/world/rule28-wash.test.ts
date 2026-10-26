/** Rule 28 (M8, DESIGN §6.3): a Tide footprint washes push and ice blocks one tile. */
import { describe, expect, it } from 'vitest';
import { applyElement, PLAYER_ID, type ElementApplication, type GameState } from '../../../src/sim';
import { MAT, OWNER } from '../../../data/materials';
import { inlineRoom, obj, run, T } from './worldHelpers';

function tide(s: GameState, shape: ElementApplication['shape'], extra: Partial<ElementApplication> = {}) {
  s.events.length = 0;
  applyElement(s, {
    element: 'tide',
    shape,
    owner: OWNER.player,
    sourceId: PLAYER_ID,
    hitDamage: 0,
    durationMult: 1,
    ...extra,
  });
  return [...s.events];
}

const ROOM = `@id t/wash
@level 1
###########
#x........#
#..P...I..#
#.........#
###########
`;

describe('rule 28: Tide washes blocks', () => {
  it('rule 28: a directed Tide footprint washes a push block one tile along the spell direction', () => {
    const s = inlineRoom(ROOM);
    const ev = tide(
      s,
      { kind: 'strip', x: T(1), y: T(2), dirX: 1, dirY: 0, length: 12, width: 3 },
      {
        dirX: 1,
        dirY: 0,
        spellId: 7,
      },
    );
    const b = obj(s, 'push_block');
    expect([b.tx, b.ty]).toEqual([4, 2]);
    expect(ev.map((e) => e.type)).toContain('blockWashed');
    expect(s.grid.ground[T(2) * s.grid.width + T(3)]).not.toBe(MAT.object); // the old tile is floor again
    // Once per spell instance.
    run(s, 30);
    tide(s, { kind: 'circle', x: T(4) - 4, y: T(2), r: 6 }, { dirX: 1, dirY: 0, spellId: 7 });
    expect(obj(s, 'push_block').tx).toBe(4);
    tide(s, { kind: 'circle', x: T(4) - 4, y: T(2), r: 6 }, { dirX: 1, dirY: 0, spellId: 8 });
    expect(obj(s, 'push_block').tx).toBe(5);
  });

  it('rule 28: without a direction (Nova, Lob, Orb) it washes away from the footprint center', () => {
    const s = inlineRoom(ROOM);
    tide(s, { kind: 'circle', x: T(3), y: T(2) - 3, r: 4 }, { spellId: 1 }); // center north of the block
    const b = obj(s, 'push_block');
    expect([b.tx, b.ty]).toEqual([3, 3]);
  });

  it('rule 28: a block whose tile beyond is not free stays', () => {
    const s = inlineRoom(ROOM);
    tide(s, { kind: 'circle', x: T(3), y: T(2) + 3, r: 4 }, { spellId: 1 }); // pushes north into row 1
    expect(obj(s, 'push_block').ty).toBe(1);
    run(s, 30);
    tide(s, { kind: 'circle', x: T(3), y: T(1) + 3, r: 4 }, { spellId: 2 }); // row 0 is wall
    expect(obj(s, 'push_block').ty).toBe(1);
  });

  it('rule 28 with Glaze: an ice block washed onto a Tide-then-Frost ice path slides to its end; the path returns to stone under it', () => {
    const s = inlineRoom(ROOM);
    const path = { kind: 'strip' as const, x: T(8) - 2, y: T(2), dirX: 1, dirY: 0, length: 8, width: 3.5 };
    tide(s, path);
    applyElement(s, {
      element: 'frost',
      shape: path,
      owner: OWNER.player,
      sourceId: PLAYER_ID,
      hitDamage: 0,
      durationMult: 1,
    });
    const g = s.grid;
    expect(g.ground[T(2) * g.width + T(8)]).toBe(MAT.ice);
    expect(g.borrowed[T(2) * g.width + T(8)]).toBe(1);
    // Wash the ice block (tile 7) east onto the path.
    tide(s, { kind: 'circle', x: T(6), y: T(2), r: 3 }, { spellId: 3 });
    run(s, 60);
    const b = obj(s, 'ice_block');
    expect(b.tx).toBe(9); // slid to the wall
    expect(b.timer).toBe(0);
    // Under the block the cells are still borrowed ice (hidden in `cover`).
    const under = T(2) * g.width + T(9);
    expect(g.ground[under]).toBe(MAT.object);
    expect(g.cover[under]).toBe(MAT.ice + 1);
    expect(g.under[under]).toBe(MAT.stone);
    // The path ends: the cells around return to stone, and the block now rests on stone.
    for (let i = 0; i < g.timer.length; i++) if (g.borrowed[i] === 1) g.timer[i] = 1;
    run(s, 4);
    expect(g.ground[T(2) * g.width + T(8)]).toBe(MAT.stone);
    expect(g.ground[under]).toBe(MAT.object);
    expect(g.cover[under]).toBe(0);
    expect(g.borrowed[under]).toBe(0);
    expect(g.under[under]).toBe(MAT.stone);
  });

  it('rule 28: a block resting on borrowed water keeps it borrowed; moved off early, the water is still there and still goes', () => {
    const s = inlineRoom(ROOM);
    const g = s.grid;
    tide(s, { kind: 'circle', x: T(4), y: T(2), r: 2 }); // flood tile 4 (not the block's tile)
    tide(s, { kind: 'circle', x: T(2), y: T(2), r: 3 }, { spellId: 4 }); // wash the block (tile 3) east onto it
    expect(obj(s, 'push_block').tx).toBe(4);
    const i = T(2) * g.width + T(4);
    expect(g.cover[i]).toBe(MAT.shallow_water + 1);
    run(s, 30);
    tide(s, { kind: 'circle', x: T(3), y: T(2), r: 3 }, { spellId: 5 }); // and on east again
    expect(obj(s, 'push_block').tx).toBe(5);
    expect(g.ground[i]).toBe(MAT.shallow_water);
    expect(g.borrowed[i]).toBe(1);
    run(s, 10 * 60);
    expect(g.ground[i]).toBe(MAT.stone);
  });
});

describe('rule 24 on objects: Tide and braziers (DESIGN §6.5)', () => {
  const BRAZ = `@id t/tbraz
@level 1
@link D braziers:all
#########
#x.B.B..#
####D####
#.......#
#########
`;
  const fire = (s: GameState, x: number) =>
    applyElement(s, {
      element: 'fire',
      shape: { kind: 'circle', x, y: T(1), r: 2 },
      owner: OWNER.player,
      sourceId: PLAYER_ID,
      hitDamage: 0,
      durationMult: 1,
    });

  it('rule 24: a lit brazier goes out under Tide, unless its group already opened its door', () => {
    const s = inlineRoom(BRAZ);
    fire(s, T(3));
    expect(obj(s, 'brazier', 0).on).toBe(true);
    const ev = tide(s, { kind: 'circle', x: T(3), y: T(1), r: 2 });
    expect(obj(s, 'brazier', 0).on).toBe(false);
    expect(ev.map((e) => e.type)).toContain('brazierOut');
    fire(s, T(3));
    fire(s, T(5));
    run(s, 1);
    expect(obj(s, 'door').on).toBe(true);
    tide(s, { kind: 'circle', x: T(4), y: T(1), r: 6 });
    expect(obj(s, 'brazier', 0).on).toBe(true);
    expect(obj(s, 'brazier', 1).on).toBe(true);
  });
});
