/** CONTENT §2 reference weaves 15–18 (M8): their behavior and terrain assertions (BUILD_PLAN M8 acceptance). */
import { describe, expect, it } from 'vitest';
import {
  applyElement,
  applyIgnite,
  Button,
  createGame,
  DT,
  isIgnited,
  PLAYER_ID,
  referenceWeaves,
  spawnEnemy,
  type GameState,
  type SimEvent,
} from '../../../src/sim';
import { labStations } from '../../../data/lab';
import { loadRoomText } from '../../../tools/lib/rooms';
import { dummy, idx, MAT, ofType, OWNER, place, room, run, weaves } from './helpers';

const REF = (n: number) => referenceWeaves.find((w) => w.n === n)!.notation;
const LMB = Button.Cast1;

function cast(s: GameState, aim: [number, number]): SimEvent[] {
  const t = s.weaves.slots[0]!.program!.castTime;
  const n = Math.ceil((t * 0.25 - 1e-9) / DT);
  return [...run(s, n, LMB, aim), ...run(s, 1, 0, aim)];
}

/** Cells of the swath strip from (20, 40) east: x 21..33, y 39..40. */
const STRIP = [21, 25, 29, 33].map((x) => [x, 40] as const);

describe('reference weaves 15–18 (CONTENT §2, M8)', () => {
  it('#15 Floodline: the 14×3 strip on stone is borrowed shallow water for 15 s, then stone; Storm on one end charges it all', () => {
    const s = room('.');
    weaves(s, [REF(15)]);
    cast(s, [60, 40]);
    for (const [x, y] of STRIP) {
      const i = idx(s, x, y);
      expect(s.grid.ground[i], `x ${x}`).toBe(MAT.shallow_water);
      expect(s.grid.borrowed[i]).toBe(1);
      expect(s.grid.timer[i]).toBeGreaterThanOrEqual(298); // 15 s, less the grid ticks of the cast
      expect(s.grid.timer[i]).toBeLessThanOrEqual(300);
    }
    applyElement(s, {
      element: 'storm',
      shape: { kind: 'circle', x: 33.5, y: 40, r: 1 },
      owner: OWNER.player,
      sourceId: PLAYER_ID,
      hitDamage: 10,
      durationMult: 1,
    });
    for (const [x, y] of STRIP) expect(s.grid.charge[idx(s, x, y)], `x ${x}`).toBeGreaterThan(0);
    run(s, 15 * 60 - 30);
    expect(s.grid.ground[idx(s, 25, 40)]).toBe(MAT.shallow_water);
    run(s, 40);
    for (const [x, y] of STRIP) expect(s.grid.ground[idx(s, x, y)]).toBe(MAT.stone);
  });

  it('#16 Glaze: the strip becomes water then ice (slot order); the ice lasts 15 s and returns to stone, not water', () => {
    const s = room('.');
    weaves(s, [REF(16)]);
    cast(s, [60, 40]);
    for (const [x, y] of STRIP) {
      expect(s.grid.ground[idx(s, x, y)], `x ${x}`).toBe(MAT.ice);
      expect(s.grid.borrowed[idx(s, x, y)]).toBe(1);
    }
    run(s, 15 * 60 - 30);
    expect(s.grid.ground[idx(s, 25, 40)]).toBe(MAT.ice);
    run(s, 40);
    for (const [x, y] of STRIP) expect(s.grid.ground[idx(s, x, y)]).toBe(MAT.stone);
  });

  it('#16 Glaze: an ice block washed onto it slides (the Lab bay with an ice block)', () => {
    const s = createGame({ seed: 1, roomText: loadRoomText('test/lab'), spawnRoomEnemies: false });
    const bay = labStations.findIndex((st) => st.rule === 28);
    const { tx, ty } = labStations[bay]!.rect;
    const x0 = tx * 4;
    const y0 = ty * 4;
    weaves(s, [REF(16)]);
    // Stand at the east end of the ice block's lane, on a tile line, and Glaze westward.
    place(s, x0 + 22, y0 + 18);
    cast(s, [x0, y0 + 18]);
    expect(s.grid.ground[idx(s, x0 + 9, y0 + 18)]).toBe(MAT.ice);
    place(s, x0 + 12, y0 + 6); // out of the lane
    applyElement(s, {
      element: 'tide',
      shape: { kind: 'circle', x: x0 + 2, y: y0 + 18, r: 3 },
      owner: OWNER.player,
      sourceId: PLAYER_ID,
      hitDamage: 0,
      durationMult: 1,
    });
    run(s, 90);
    const ice = s.objects.find((o) => o.kind === 'ice_block')!;
    expect(ice.tx).toBeGreaterThanOrEqual(tx + 4);
    expect(ice.timer).toBe(0);
  });

  /**
   * #17 measured (notes/m8-chem-decisions.md): the 2 s, 12-cell cone burns out its own cells by
   * 1.5 s with or without Gale, so the gain is in how fast the fire leaves the Strike's arc:
   * 1.67× the cells past the arc after 1 s, 1.25× after 2 s (6 seeds). CONTENT's "about twice in
   * 2 s" is flagged to the designer; these ranges pin today's numbers.
   */
  it('#17 Fan the Flames: on grass, the gust drives the fire downwind of the Strike faster; knockback 6', () => {
    const burnt = (notation: string, seconds: number) => {
      let n = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const s = createGame({
          seed,
          roomText: `@id t/fan\n${Array.from({ length: 12 }, () => '"'.repeat(16)).join('\n')}\n`,
          spawnRoomEnemies: false,
        });
        place(s, 10, 24);
        s.cheats.noAI = true;
        weaves(s, [notation]);
        cast(s, [40, 24]);
        run(s, seconds * 60);
        for (let y = 0; y < 48; y++)
          for (let x = 16; x < 64; x++) {
            const i = idx(s, x, y);
            if (s.grid.fire[i]! > 0 || s.grid.ground[i] === MAT.ash) n++;
          }
      }
      return n;
    };
    const r1 = burnt(REF(17), 1) / burnt('Cast > Strike[Fire]', 1);
    const r2 = burnt(REF(17), 2) / burnt('Cast > Strike[Fire]', 2);
    expect(r1).toBeGreaterThan(1.5);
    expect(r1).toBeLessThan(2.5);
    expect(r2).toBeGreaterThan(1.15);
    expect(r2).toBeLessThan(r1);
    const s = room('.');
    weaves(s, [REF(17)]);
    expect(s.weaves.slots[0]!.program!.root.knockback).toBe(6);
  });

  it('#18 Downpour: burning grass in the burst goes out and does not relight for 10 s; enemies are Wet; a burning Tar Hulk fuse goes out', () => {
    const s = room('"', 30, 20, 20, 40);
    s.cheats.god = true;
    const hulk = spawnEnemy(s, 'tar_hulk', 50, 40);
    hulk.terrain.oiledLeft = 30;
    const near = dummy(s, 53, 43);
    applyElement(s, {
      element: 'fire',
      shape: { kind: 'circle', x: 50, y: 40, r: 5 },
      owner: OWNER.enemy,
      sourceId: PLAYER_ID,
      hitDamage: 0,
      durationMult: 1,
    });
    applyIgnite(s, hulk, 5, 3, PLAYER_ID);
    run(s, 2);
    expect(hulk.special.fuseLeft).toBeGreaterThan(0);
    weaves(s, [REF(18)]);
    let ev: SimEvent[] = [];
    for (let t = 0; t < 120 && ofType(ev, 'spellEnd').length === 0; t++) ev = [...ev, ...run(s, 1)];
    const land = ofType(ev, 'spellEnd')[0]!;
    expect(Math.hypot(land.x - hulk.x, land.y - hulk.y)).toBeLessThan(3);
    ev = [...ev, ...run(s, 2)];
    expect(ofType(ev, 'hulkFuseOut')).toHaveLength(1);
    expect(isIgnited(hulk)).toBe(false);
    expect(hulk.terrain.wetLeft).toBeGreaterThan(0);
    expect(near.terrain.wetLeft).toBeGreaterThan(0);
    const c = idx(s, land.x, land.y);
    expect(s.grid.fire[c]).toBe(0);
    expect(s.grid.wet[c]).toBeGreaterThan(150);
    // Fire again, a few seconds later: the soaked grass doesn't catch.
    weaves(s, []); // no more Pulses
    run(s, 4 * 60);
    applyElement(s, {
      element: 'fire',
      shape: { kind: 'circle', x: land.x, y: land.y, r: 2 },
      owner: OWNER.player,
      sourceId: PLAYER_ID,
      hitDamage: 0,
      durationMult: 1,
    });
    expect(s.grid.fire[c]).toBe(0);
  });
});
