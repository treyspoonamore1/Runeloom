/**
 * M8 phase 1 task 1 (BUILD_PLAN): the room format additions (CONTENT §6): legend `f`, `Q`, `Y`;
 * headers `@fog`, `@wind`, `@pulse`; link conditions `timer:N:switch:S` and `vanes:all`; and that
 * rooms from before M8 parse and play exactly as before.
 */
import { describe, expect, it } from 'vitest';
import {
  applyElement,
  buildRoom,
  createGame,
  hashState,
  parseLinkCondition,
  parseRoom,
  PLAYER_ID,
  step,
  NEUTRAL_INPUT,
  type GameState,
  type TerrainElement,
} from '../../../src/sim';
import { AIR, MAT, OWNER } from '../../../data/materials';
import { isFogCell } from '../../../src/sim/grid/grid';
import { checkRooms } from '../../../tools/lib/roomChecks';
import { ROOMS, inlineRoom, obj, run, T } from './worldHelpers';

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

describe('M8 headers', () => {
  const room = (headers: string) => parseRoom(`@id t/h\n${headers}\n...\n...\n`);

  it('@fog adds rectangles (corners inclusive, in any order); @wind and @pulse parse', () => {
    const h = room('@fog 0 0 1 1\n@fog 2 1 2 0\n@wind ne\n@pulse 2.5').header;
    expect(h.fog).toEqual([
      { tx0: 0, ty0: 0, tx1: 1, ty1: 1 },
      { tx0: 2, ty0: 0, tx1: 2, ty1: 1 },
    ]);
    expect(h.wind).toBe(2);
    expect(h.pulse).toBe(2.5);
    for (const [name, dir] of [
      ['e', 1],
      ['n', 3],
      ['w', 5],
      ['s', 7],
      ['se', 8],
    ] as const)
      expect(room(`@wind ${name}`).header.wind).toBe(dir);
  });

  it('bad M8 headers are errors with their line', () => {
    expect(() => room('@fog 0 0 1')).toThrow(/line 2: @fog needs 4/);
    expect(() => room('@fog 0 0 1 -1')).toThrow(/@fog takes four tile coordinates/);
    expect(() => room('@wind up')).toThrow(/@wind takes one of/);
    expect(() => room('@pulse 0')).toThrow(/@pulse takes a positive/);
    expect(() => room('@look kiln')).toThrow(/@look takes fen or foundry/);
  });

  it('@look names the region look (rift chunks built from Fen rooms)', () => {
    expect(room('@look fen').header.look).toBe('fen');
    expect(room('@look foundry').header.look).toBe('foundry');
    expect(room('@wind e').header.look).toBeUndefined();
  });

  it('rooms without M8 headers parse to the same header as before M8 (no new keys)', () => {
    for (const [id, text] of Object.entries(ROOMS)) {
      const h = parseRoom(text).header;
      if (['@fog', '@wind', '@pulse', '@look'].some((k) => text.includes(k))) continue;
      expect(Object.keys(h).sort(), id).toEqual(
        ['clearOnExit', 'exits', 'id', 'level', 'links', 'name', 'notes', 'spawns'].sort(),
      );
    }
  });

  it('@fog puts fog in the air layer and the fogMask over its tiles, not on walls', () => {
    const s = createGame({
      seed: 1,
      roomText: '@id t/fog\n@fog 1 0 2 1\n####\n#..#\n#..#\n####\n',
      spawnRoomEnemies: false,
    });
    const g = s.grid;
    const at = (x: number, y: number) => y * g.width + x;
    expect(g.air[at(5, 5)]).toBe(AIR.fog);
    expect(isFogCell(g, at(5, 5))).toBe(true);
    expect(g.air[at(1, 5)]).toBe(AIR.none); // tile 0: outside the rectangle
    expect(isFogCell(g, at(1, 5))).toBe(false);
    expect(isFogCell(g, at(5, 1))).toBe(true); // a wall tile inside the rectangle
    expect(g.air[at(5, 1)]).toBe(AIR.none);
    // Fog is permanent: it doesn't time out.
    for (let k = 0; k < 400; k++) step(s, NEUTRAL_INPUT);
    expect(g.air[at(5, 5)]).toBe(AIR.fog);
  });

  it("smoke and steam replace fog while they last, then it's back", () => {
    const s = createGame({ seed: 1, roomText: '@id t/fog2\n@fog 0 0 2 0\n.~.\n', spawnRoomEnemies: false });
    const g = s.grid;
    const i = 1 * g.width + 6; // shallow water
    hit(s, 'fire', 6.5, 1.5, 0.5); // rule 4: steam
    expect(g.air[i]).toBe(AIR.steam);
    for (let k = 0; k < 3 * 61; k++) step(s, NEUTRAL_INPUT);
    expect(g.air[i]).toBe(AIR.fog);
  });

  it('@wind sets the grid room wind; rooms without it have none', () => {
    const windy = createGame({ seed: 1, roomText: '@id t/w\n@wind w\n...\n', spawnRoomEnemies: false });
    expect(windy.grid.wind).toBe(5);
    const calm = createGame({ seed: 1, roomText: '@id t/c\n...\n', spawnRoomEnemies: false });
    expect(calm.grid.wind).toBe(0);
  });

  it('@pulse makes every pylon pulse world-owned charge on its interval, glowing first', () => {
    const s = createGame({
      seed: 1,
      roomText: '@id t/p\n@pulse 2\n.....\n.mMm.\n.....\n',
      spawnRoomEnemies: false,
    });
    const g = s.grid;
    const pylon = 1 * 4 * g.width + 2 * 4; // a cell of the M tile... tile (2,1)
    const seen: string[] = [];
    let chargedAt = -1;
    for (let k = 0; k < 6 * 60 && chargedAt < 0; k++) {
      step(s, NEUTRAL_INPUT);
      for (const e of s.events) if (e.type === 'pylonGlow' || e.type === 'pylonPulse') seen.push(e.type);
      if (g.charge[pylon + 1 * g.width]! > 0 && chargedAt < 0) chargedAt = g.tick;
    }
    expect(chargedAt).toBe(40); // 2 s of grid ticks
    expect(seen[0]).toBe('pylonGlow');
    expect(seen).toContain('pylonPulse');
    expect(g.owner[pylon + 1 * g.width]).toBe(OWNER.world);
  });
});

describe('M8 legend', () => {
  it('f is a lit furnace vent whose under is itself; Q and Y are solid objects on their ground', () => {
    const s = inlineRoom('@id t/leg\n@level 1\n#######\n#x.f..#\n#.Q.Y.#\n#######\n');
    const g = s.grid;
    const vent = T(1) * g.width + T(3);
    expect(g.ground[vent]).toBe(MAT.vent_lit);
    expect(g.under[vent]).toBe(MAT.vent_lit);
    expect(s.room.solid[vent]).toBe(1);
    expect(s.room.shotSolid[vent]).toBe(0); // blocks movement, not projectiles
    expect(obj(s, 'sealed_switch').on).toBe(false);
    expect(obj(s, 'wind_vane').on).toBe(false);
    expect(g.ground[T(2) * g.width + T(2)]).toBe(MAT.object);
    expect(s.room.solid[T(2) * g.width + T(4)]).toBe(1);
  });
});

describe('M8 link conditions', () => {
  it('parses timer:N:switch:S and vanes:all', () => {
    expect(parseLinkCondition('timer:6:switch:S')).toEqual({ kind: 'switch', seconds: 6 });
    expect(parseLinkCondition('switch:S')).toEqual({ kind: 'switch', seconds: 0 });
    expect(parseLinkCondition('vanes:all')).toEqual({ kind: 'vanes' });
    expect(parseLinkCondition('timer:0:switch:S')).toBeNull();
    expect(parseLinkCondition('timer:4:switch:Q')).toBeNull();
  });

  const SEALED = `@id t/sealed
@level 1
@link D switch:S
#########
#...x...#
#.mmQ...#
#.......#
####D####
#.......#
#########
`;

  it('a sealed switch ignores spell hits; charge on a touching cell powers it and counts for switch:S', () => {
    const s = inlineRoom(SEALED);
    hit(s, 'storm', T(4), T(2), 1.5);
    run(s, 2);
    expect(obj(s, 'sealed_switch').on).toBe(false);
    hit(s, 'storm', T(2), T(2), 1);
    run(s, 1);
    expect(obj(s, 'sealed_switch').on).toBe(true);
    run(s, 1);
    expect(obj(s, 'door').on).toBe(true);
  });

  const TIMED = `@id t/timed
@level 1
@link D timer:3:switch:S
#############
#...x.......#
#.mS.....Qm.#
#...........#
######D######
#...........#
#############
`;

  it('timer:N:switch:S: a switch unlatches N s after it was powered unless the group completes', () => {
    const s = inlineRoom(TIMED);
    hit(s, 'storm', T(3), T(2), 1);
    expect(obj(s, 'conduit_switch').on).toBe(true);
    run(s, 3 * 60 - 1);
    expect(obj(s, 'conduit_switch').on).toBe(true);
    run(s, 1);
    expect(obj(s, 'conduit_switch').on).toBe(false);
    expect(s.events.some((e) => e.type === 'switchOff')).toBe(true);
    // Both within the time: the door opens and the switches stay powered.
    hit(s, 'storm', T(3), T(2), 1);
    run(s, 60);
    hit(s, 'storm', T(10), T(2), 1); // the metal beside the sealed switch
    run(s, 2);
    expect(obj(s, 'door').on).toBe(true);
    run(s, 4 * 60);
    expect(obj(s, 'conduit_switch').on).toBe(true);
    expect(obj(s, 'sealed_switch').on).toBe(true);
  });

  it('the validator accepts Q for switch:S and wants a Y for vanes:all, and @fog inside the map', () => {
    const rooms = new Map([
      ['t/a', parseRoom('@id t/a\n@link D switch:S\n@link D vanes:all\n@fog 0 0 9 0\n#D#\n#Q#\n')],
    ]);
    const res = checkRooms(rooms, { isEnemy: () => true, isPack: () => true });
    expect(res.errors.join('\n')).toMatch(/vanes:all: no 'Y' in the grid/);
    expect(res.errors.join('\n')).toMatch(/@fog 0 0 9 0: outside/);
    expect(res.errors.join('\n')).not.toMatch(/switch:S/);
  });
});

describe('rooms from before M8', () => {
  it('build the same rooms and grids, and the grid has no M8 state', () => {
    for (const [id, text] of Object.entries(ROOMS)) {
      if (
        /@(fog|wind|pulse)\b/.test(text) ||
        /[fQY]/.test(
          text
            .split('\n')
            .filter((l) => !l.startsWith('@'))
            .join(''),
        )
      )
        continue;
      const room = buildRoom(parseRoom(text));
      const s = createGame({ seed: 1, roomText: text, spawnRoomEnemies: false });
      expect(s.grid.wind, id).toBe(0);
      expect(
        s.grid.fogMask.some((b) => b !== 0),
        id,
      ).toBe(false);
      expect(room.width, id).toBe(s.grid.width);
    }
  });

  it('a grid with no M8 state hashes as it did before M8 (wet hashed as its low bytes)', () => {
    const s = createGame({ seed: 1, roomText: '@id t/hh\n..."\n', spawnRoomEnemies: false });
    const h0 = hashState(s);
    s.grid.wet[3] = 7;
    const h1 = hashState(s);
    expect(h1).not.toBe(h0);
    s.grid.wet[3] = 7 + 256; // a high byte is hashed too
    expect(hashState(s)).not.toBe(h1);
    s.grid.wet[3] = 0;
    expect(hashState(s)).toBe(h0);
    s.grid.borrowed[2] = 1;
    expect(hashState(s)).not.toBe(h0);
    s.grid.borrowed[2] = 0;
    s.grid.gustTimer[2] = 4;
    expect(hashState(s)).not.toBe(h0);
  });
});
