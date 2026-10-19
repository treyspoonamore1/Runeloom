import { describe, expect, it } from 'vitest';
import { AIR, MAT, OWNER, SURFACE } from '../../../data/materials';
import { labStations } from '../../../data/lab';
import {
  createGame,
  isOiled,
  isWet,
  NEUTRAL_INPUT,
  runStation,
  SIM_HZ,
  stationArea,
  step,
  type Enemy,
  type GameState,
  type SimEvent,
} from '../../../src/sim';
import { loadRoomText } from '../../../tools/lib/rooms';

/**
 * BUILD_PLAN M3 acceptance backbone: every Chemistry Lab station (data/lab.ts), run on its own in
 * the lab room, shows its rule's visible effect within its stated time (the time in its label,
 * else 3 s, plus when its script acts).
 */

const labText = loadRoomText('test/lab');

/** What a check can look at: the station's cells (station-relative), its entities and every event so far. */
interface Ctx {
  s: GameState;
  /** Grid index of station-relative cell (x, y). */
  at(x: number, y: number): number;
  /** Grid index of the cell under room position (x, y). */
  under(x: number, y: number): number;
  /** Number of cells in the station-relative inclusive rectangle where `pred` holds. */
  cells(x0: number, y0: number, x1: number, y1: number, pred: (i: number) => boolean): number;
  /** Enemies the station spawned (dead ones included), in spawn order. */
  spawned: Enemy[];
  events: SimEvent[];
}

interface Expect {
  /** Seconds (after running the station) by which the check must hold. */
  within: number;
  check(c: Ctx): boolean;
  what: string;
}

const g = (c: Ctx) => c.s.grid;
const ofType = <T extends SimEvent['type']>(c: Ctx, type: T) =>
  c.events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
const hitIds = (c: Ctx, type: 'chargeHit' | 'arc') =>
  new Set(
    type === 'chargeHit' ? ofType(c, 'chargeHit').map((e) => e.target) : ofType(c, 'arc').map((e) => e.to),
  );

/** One entry per station, in data/lab.ts order. */
const expected: Expect[] = [
  { within: 1, what: 'the grass at the hit burns', check: (c) => g(c).fire[c.at(12, 8)]! > 0 },
  {
    within: 3,
    what: 'fire spreads 8+ cells along the grass',
    check: (c) => c.cells(10, 4, 23, 11, (i) => g(c).fire[i]! > 0 || g(c).ground[i] === MAT.ash) > 0,
  },
  {
    within: 7,
    what: 'the bridge burns into deep water (6 s)',
    check: (c) => g(c).ground[c.at(12, 12)] === MAT.deep_water,
  },
  {
    within: 7,
    what: 'the wooden floor burns away into a pit (6 s)',
    check: (c) => g(c).ground[c.at(12, 10)] === MAT.pit,
  },
  {
    within: 8,
    what: 'crates burn to ash and the barricade to stone (4 s after it catches at 1.5 s)',
    check: (c) =>
      c.cells(4, 4, 11, 11, (i) => g(c).ground[i] === MAT.crate) === 0 &&
      c.cells(16, 4, 19, 11, (i) => g(c).ground[i] === MAT.barricade) === 0,
  },
  {
    within: 1.5,
    what: 'steam over shallow and deep water',
    check: (c) => g(c).air[c.at(6, 10)] === AIR.steam && g(c).air[c.at(18, 10)] === AIR.steam,
  },
  { within: 1, what: 'the ice melts', check: (c) => g(c).ground[c.at(12, 10)] === MAT.shallow_water },
  {
    within: 2,
    what: 'an ice bridge forms, then melts back into deep water',
    check: (c) =>
      ofType(c, 'iceFormed').length > 0 && g(c).ground[c.at(12, 12)] === MAT.deep_water && c.s.tick > 60,
  },
  {
    within: 1,
    what: 'the oil burns hot',
    check: (c) => g(c).fire[c.at(6, 6)] === 255 && g(c).surface[c.at(6, 6)] === SURFACE.oil,
  },
  {
    within: 1.5,
    what: 'oil burns on the water',
    check: (c) => c.cells(4, 4, 19, 11, (i) => g(c).fire[i]! > 0 && g(c).ground[i] === MAT.shallow_water) > 0,
  },
  { within: 1, what: 'the water freezes', check: (c) => g(c).ground[c.at(12, 10)] === MAT.ice },
  {
    within: 1,
    what: 'an ice bridge you can walk on (8 s)',
    check: (c) => g(c).ground[c.at(12, 8)] === MAT.ice_bridge && c.s.room.solid[c.at(12, 8)] === 0,
  },
  {
    within: 2.5,
    what: 'frost puts the whole fire out (fuel kept) and it relights',
    check: (() => {
      // The patch must be fully out (no fire anywhere in it) at some point between frost and relight.
      let wasOut = false;
      return (c: Ctx) => {
        if (
          c.s.tick > SIM_HZ &&
          c.s.tick < 2 * SIM_HZ &&
          c.cells(4, 4, 19, 15, (i) => g(c).fire[i]! > 0) === 0
        )
          wasOut = true;
        const i = c.at(12, 10);
        return wasOut && c.s.tick >= 2 * SIM_HZ && g(c).fire[i]! > 0 && ofType(c, 'cellIgnited').length >= 2;
      };
    })(),
  },
  { within: 1, what: 'the mud dries to dirt', check: (c) => g(c).ground[c.at(12, 10)] === MAT.dirt },
  {
    within: 1.2,
    what: 'the water is charged and both dummies in it are hit',
    check: (c) => g(c).charge[c.at(21, 6)]! > 0 && hitIds(c, 'chargeHit').size === 2,
  },
  {
    within: 1.2,
    what: 'the metal is charged; the dummy on it is hit, the one on stone is not',
    check: (c) =>
      g(c).charge[c.at(18, 14)]! > 0 &&
      hitIds(c, 'chargeHit').has(c.spawned[0]!.id) &&
      !hitIds(c, 'chargeHit').has(c.spawned[1]!.id),
  },
  {
    within: 1.2,
    what: 'charge crosses from water to metal: both dummies hit',
    check: (c) => g(c).charge[c.at(18, 12)]! > 0 && hitIds(c, 'chargeHit').size === 2,
  },
  {
    within: 3,
    what: 'Storm ignites some dry grass',
    check: (c) => c.cells(4, 4, 19, 15, (i) => g(c).fire[i]! > 0) > 0,
  },
  {
    within: 0.2,
    what: 'the dummy in the water is Wet, the one on stone is not',
    check: (c) => isWet(c.spawned[0]!) && !isWet(c.spawned[1]!),
  },
  {
    within: 3,
    what: 'the dummy catches fire from the burning grass at terrain-fire DPS',
    check: (c) => c.spawned[0]!.ailments.ignite.timeLeft > 0 && c.spawned[0]!.ailments.ignite.dps > 0,
  },
  {
    within: 0.2,
    what: 'the dummy on oil is Oiled, the one on stone is not',
    check: (c) => isOiled(c.spawned[0]!) && !isOiled(c.spawned[1]!),
  },
  {
    within: 3,
    what: 'the Oiled dummy is Ignited and burns at twice its Ignite rate',
    check: (c) => {
      const d = c.spawned[0]!;
      const dots = ofType(c, 'dot').filter((e) => e.target === d.id);
      if (!isOiled(d) || d.ailments.ignite.timeLeft <= 0 || dots.length === 0) return false;
      // A full 0.5 s 'dot' report: 2 × dps × 0.5.
      return dots.some((e) => Math.abs(e.amount - d.ailments.ignite.dps) < 1e-6);
    },
  },
  {
    within: 1.2,
    what: 'the shocked wet dummy arcs to all four wet neighbors',
    check: (c) => hitIds(c, 'arc').size === 4,
  },
  {
    within: 1.4,
    what: 'the frozen Shieldbearer shatters and its frost freezes the water',
    check: (c) =>
      ofType(c, 'death').some((e) => e.shattered) &&
      g(c).ground[c.at(10, 7)] === MAT.ice_bridge &&
      g(c).ground[c.at(7, 10)] === MAT.ice,
  },
  {
    within: 1,
    what: 'the burning Tinderling lights enemy-owned grass as it runs',
    check: (c) => c.cells(0, 4, 23, 19, (i) => g(c).fire[i]! > 0 && g(c).owner[i] === OWNER.enemy) >= 3,
  },
  { within: 1.5, what: 'fire dries the mud', check: (c) => g(c).ground[c.at(12, 10)] === MAT.dirt },
  {
    within: 10,
    what: 'the ice bridge breaks and the dummy falls back to safe ground (10 s)',
    check: (c) => {
      const d = c.spawned[0]!;
      return ofType(c, 'fell').length === 1 && c.s.room.solid[c.under(d.x, d.y)] === 0;
    },
  },
  {
    within: 3,
    what: 'placed fire on stone spreads into the grass',
    check: (c) => c.cells(12, 4, 23, 19, (i) => g(c).fire[i]! > 0 && g(c).ground[i] === MAT.grass) > 0,
  },
  {
    within: 2,
    what: 'the barrel explodes, burning the crates and hitting the dummy',
    check: (c) =>
      ofType(c, 'explosion').length === 1 &&
      ofType(c, 'hit').some((e) => e.target === c.spawned[0]!.id && e.damageType === 'fire'),
  },
  {
    within: 3,
    what: 'the grass burns and fire on the river steams',
    check: (c) => c.cells(0, 0, 7, 19, (i) => g(c).fire[i]! > 0) > 0 && g(c).air[c.at(12, 2)] === AIR.steam,
  },
  {
    within: 2,
    what: 'the slick is charged (both dummies hit), then the oil burns on the water',
    check: (c) => hitIds(c, 'chargeHit').size === 2 && g(c).fire[c.at(12, 12)]! > 0,
  },
  {
    within: 4,
    what: 'the oil fuse burns to the keg and it explodes',
    check: (c) => ofType(c, 'explosion').length === 1,
  },
];

describe('Chemistry Lab stations (all of data/lab.ts)', () => {
  it('has an expectation for every station', () => {
    expect(expected).toHaveLength(labStations.length);
    expect(labStations).toHaveLength(32);
  });

  labStations.forEach((station, index) => {
    const exp = expected[index]!;
    it(`#${index} ${station.label}: ${exp.what} within ${exp.within} s`, () => {
      const s = createGame({ seed: 1, roomText: labText });
      const area = stationArea(station);
      const before = s.nextId;
      const events: SimEvent[] = [];
      runStation(s, index);
      events.push(...s.events);
      const spawned = s.enemies.filter((e) => e.id >= before);
      const ctx: Ctx = {
        s,
        at: (x, y) => (area.y0 + Math.floor(y)) * s.grid.width + area.x0 + Math.floor(x),
        under: (x, y) => Math.floor(y) * s.grid.width + Math.floor(x),
        cells: (x0, y0, x1, y1, pred) => {
          let n = 0;
          for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++) if (pred((area.y0 + y) * s.grid.width + area.x0 + x)) n++;
          return n;
        },
        spawned,
        events,
      };
      let ok = false;
      let t = 0;
      for (; t <= exp.within * SIM_HZ && !ok; t++) {
        step(s, NEUTRAL_INPUT);
        events.push(...s.events);
        ok = exp.check(ctx);
      }
      expect(ok, `${station.label}: ${exp.what}`).toBe(true);
    });
  });
});
