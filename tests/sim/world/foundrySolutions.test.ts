/**
 * Scripted solutions for the Drowned Foundry puzzle rooms (BUILD_PLAN M8 phase 1 task 10,
 * data/rooms/SOLUTIONS.md), as fenSolutions.test.ts does for the overworld: each solution reaches
 * its door, chest or pickup, and each puzzle room has an attempt without its first needed element
 * that fails. G7's Windward Cache (Gale) is here too, with the other after-the-dungeon-item tests.
 *
 * TODO(chemistry merge): the Tide and Gale tests are `it.skip` until the chemistry agent's Tide
 * (DESIGN §6.5: rules 24, 27, 28, 30, borrowed terrain) and Gale gusts (§6.6, wind vanes) are merged
 * and RUNTIME_SHIPS includes M8 (the weaves with Tide or Gale don't compile before that).
 */
import { afterAll, describe, expect, it } from 'vitest';
import { MAT } from '../../../data/materials';
import { fenRooms } from '../../../data/progression';
import type { GameState, ScriptCommand } from '../../../src/sim';
import {
  allOn,
  anyOn,
  attempts,
  BOLT_FIRE,
  BOLT_STORM,
  cast,
  fenTicks,
  into,
  LOB_FIRE,
  LOB_FROST,
  LOB_STORM,
  objects,
  powered,
  prepareFen,
  solveFen,
  STRIKE,
  T,
} from './fenSolve';

afterAll(() => console.log('foundry solution ticks', JSON.stringify(fenTicks)));

const NO_STORM = [BOLT_FIRE, STRIKE, LOB_FIRE, LOB_FROST];
const keys = (s: GameState): number => s.world.keys['foundry'] ?? 0;

/** True when no cell of tiles (tx0..tx1, ty0..ty1) is still `mat`. */
function noneLeft(s: GameState, mat: number, tx0: number, ty0: number, tx1: number, ty1: number): boolean {
  const g = s.grid;
  for (let cy = ty0 * 4; cy < (ty1 + 1) * 4; cy++)
    for (let cx = tx0 * 4; cx < (tx1 + 1) * 4; cx++) if (g.ground[cy * g.width + cx] === mat) return false;
  return true;
}

/** True when nothing burns in tiles (tx0..tx1, ty0..ty1). */
function noFire(s: GameState, tx0: number, ty0: number, tx1: number, ty1: number): boolean {
  const g = s.grid;
  for (let cy = ty0 * 4; cy < (ty1 + 1) * 4; cy++)
    for (let cx = tx0 * 4; cx < (tx1 + 1) * 4; cx++) if (g.fire[cy * g.width + cx]! > 0) return false;
  return true;
}

describe('Drowned Foundry puzzle solutions (first half)', () => {
  it('F1: one Storm hit in the moat powers the switch on each bank; the door opens on the stair north', () => {
    const s = prepareFen('f1', { arrive: 'w', weaves: [BOLT_FIRE, STRIKE, LOB_STORM, LOB_FROST] });
    solveFen('f1', s, [
      { do: 'moveTo', x: T(21), y: T(10) },
      cast(2, T(18), T(7)),
      { do: 'until', cond: (st) => powered(st) === 2, timeout: 2, label: 'both switches' },
      { do: 'until', cond: (st) => allOn(st, 'door'), timeout: 2, label: 'door opens' },
      { do: 'moveTo', x: T(45), y: T(1) },
      { do: 'walk', dirX: 0, dirY: -1, s: 3, until: into(fenRooms.f2) },
    ]);
    // The east alcove stays sealed behind its lit vents.
    expect(objects(s, 'loot_chest').every((o) => !o.on)).toBe(true);
  });

  it('F2: the sump touches two pump housings; with the main pump struck within 3 s, all three wake', () => {
    const s = prepareFen('f2', { arrive: 's', weaves: [BOLT_FIRE, BOLT_STORM, LOB_STORM, LOB_FROST] });
    solveFen('f2', s, [
      { do: 'moveTo', x: T(22), y: T(18) },
      cast(2, T(23), T(25)),
      cast(1, T(22), T(2)),
      { do: 'until', cond: (st) => allOn(st, 'door'), timeout: 2, label: 'door opens' },
      { do: 'moveTo', x: T(40), y: T(2) },
      { do: 'walk', dirX: 0, dirY: -1, s: 3, until: into(fenRooms.f3) },
    ]);
  });

  it('F2: struck more than 3 s apart, the first pumps stall again and the door stays shut', () => {
    const s = prepareFen('f2', { arrive: 's', weaves: [BOLT_FIRE, BOLT_STORM, LOB_STORM, LOB_FROST] });
    solveFen('f2 slow', s, [
      { do: 'moveTo', x: T(22), y: T(18) },
      cast(2, T(23), T(25)),
      { do: 'until', cond: (st) => powered(st) === 2, timeout: 2, label: 'the sump wakes two' },
      { do: 'wait', s: 3.5 },
      cast(1, T(22), T(2)),
      { do: 'wait', s: 1 },
    ]);
    expect(powered(s)).toBe(1);
    expect(anyOn(s, 'door')).toBe(false);
  });

  it('F3: freeze each cooling lane, slide both ice blocks onto the plates; the vault gives the small key', () => {
    const s = prepareFen('f3', { arrive: 's', weaves: [BOLT_FIRE, STRIKE, LOB_STORM, LOB_FROST] });
    const plate = (ty: number) => (st: GameState) =>
      objects(st, 'pressure_plate').some((o) => o.ty === ty && o.on);
    const lane = (ty: number): ScriptCommand[] => [
      { do: 'moveTo', x: T(12), y: T(ty) },
      cast(3, 56, T(ty)),
      cast(3, 64, T(ty)),
      cast(3, 72, T(ty)),
      cast(3, 80, T(ty)),
      { do: 'moveTo', x: T(12), y: T(ty - 1) },
      { do: 'moveTo', x: T(7), y: T(ty - 1) },
      { do: 'moveTo', x: T(7), y: T(ty), tolerance: 0.3 },
      { do: 'wait', s: 0.3 },
      { do: 'walk', dirX: 1, dirY: 0, s: 6, until: plate(ty) },
    ];
    solveFen('f3', s, [
      ...lane(8),
      ...lane(22),
      { do: 'until', cond: (st) => allOn(st, 'door'), timeout: 3, label: 'vault opens' },
      { do: 'moveTo', x: T(43), y: T(15) },
      { do: 'walk', dirX: 1, dirY: 0, s: 2, until: (st) => keys(st) === 1 },
      { do: 'moveTo', x: T(54), y: T(15) },
      { do: 'walk', dirX: 1, dirY: 0, s: 3, until: into(fenRooms.f4) },
    ]);
    expect(keys(s)).toBe(1);
  });

  it('F4: Lob Fire on the oil channel; it runs across the slag pit and burns the barricade; Heart Seed; F3 key opens the Belfry door', () => {
    const s = prepareFen('f4', { arrive: 'w', weaves: [BOLT_FIRE, STRIKE, LOB_STORM, LOB_FIRE] });
    s.world.keys['foundry'] = 1; // F3's small key
    const seeds = s.hero.heartSeeds;
    solveFen('f4', s, [
      { do: 'moveTo', x: T(29), y: T(15) },
      cast(3, T(34), T(12)),
      {
        do: 'until',
        cond: (st) => noneLeft(st, MAT.barricade, 50, 6, 50, 6) && noFire(st, 33, 5, 50, 13),
        timeout: 30,
        label: 'barricade burned, channel out',
      },
      { do: 'moveTo', x: T(54), y: T(6) },
      { do: 'until', cond: (st) => st.hero.heartSeeds === seeds + 1, timeout: 2, label: 'heart seed' },
      { do: 'moveTo', x: T(53), y: T(21) },
      { do: 'walk', dirX: 1, dirY: 0, s: 2, until: (st) => anyOn(st, 'locked_door') },
      { do: 'moveTo', x: T(58), y: T(21) },
      { do: 'walk', dirX: 1, dirY: 0, s: 3, until: into(fenRooms.f5) },
    ]);
    expect(keys(s)).toBe(0);
  });

  it('F5: the Belfry door opens once the mini-boss falls (`cleared`), on to the Tide Shrine', () => {
    const s = prepareFen('f5', {
      arrive: 'w',
      weaves: [BOLT_FIRE, STRIKE, LOB_STORM, LOB_FIRE],
      killAll: true,
    });
    solveFen('f5', s, [
      { do: 'until', cond: (st) => allOn(st, 'door'), timeout: 2, label: 'door opens' },
      { do: 'moveTo', x: T(24), y: T(9) },
      { do: 'walk', dirX: 1, dirY: 0, s: 3, until: into(fenRooms.f6) },
    ]);
  });
});

describe('the Foundry without its element (CONTENT §13 "Needs")', () => {
  it('F1 without Storm: the switches stay dark and the door shut', () => {
    const s = prepareFen('f1', { arrive: 'w', weaves: NO_STORM, without: ['storm'] });
    const errors = attempts(s, [
      [
        { do: 'moveTo', x: T(21), y: T(10) },
        cast(0, T(21), T(8)),
        cast(2, T(18), T(7)),
        cast(3, T(24), T(7)),
        { do: 'wait', s: 2 },
      ],
      [{ do: 'moveTo', x: T(45), y: T(1), timeout: 8 }],
    ]);
    expect(errors).toHaveLength(1);
    expect(powered(s)).toBe(0);
    expect(anyOn(s, 'door')).toBe(false);
  });

  it('F2 without Storm: no pump wakes', () => {
    const s = prepareFen('f2', { arrive: 's', weaves: NO_STORM, without: ['storm'] });
    const errors = attempts(s, [
      [
        { do: 'moveTo', x: T(22), y: T(18) },
        cast(2, T(23), T(25)),
        cast(0, T(22), T(2)),
        cast(3, T(17), T(24)),
        { do: 'wait', s: 2 },
      ],
      [{ do: 'moveTo', x: T(40), y: T(0), timeout: 8 }],
    ]);
    expect(errors).toHaveLength(1);
    expect(powered(s)).toBe(0);
    expect(anyOn(s, 'door')).toBe(false);
  });

  it('F3 without Frost: a pushed ice block stops at the pool edge, the plates stay up, no key', () => {
    const s = prepareFen('f3', {
      arrive: 's',
      weaves: [BOLT_FIRE, STRIKE, LOB_STORM, LOB_FIRE],
      without: ['frost'],
    });
    const errors = attempts(s, [
      [
        { do: 'moveTo', x: T(7), y: T(8), tolerance: 0.3 },
        { do: 'wait', s: 0.3 },
        { do: 'walk', dirX: 1, dirY: 0, s: 5 },
        { do: 'wait', s: 1 },
      ],
      [{ do: 'moveTo', x: T(43), y: T(15), timeout: 8 }],
    ]);
    expect(errors).toHaveLength(1);
    expect(objects(s, 'ice_block').find((o) => o.ty === 8)!.tx).toBe(12);
    expect(anyOn(s, 'pressure_plate')).toBe(false);
    expect(keys(s)).toBe(0);
  });

  // Storm's spark (rule 14: 15% per dry flammable cell, oil included) is an igniter too, so this
  // attempt has neither Fire nor Storm (notes/m8-rooms-decisions.md).
  it('F4 without Fire (or a Storm spark): the barricade holds and the Heart Seed vault stays closed', () => {
    const s = prepareFen('f4', {
      arrive: 'w',
      weaves: [BOLT_FIRE.replace('Fire', 'Frost'), STRIKE, LOB_FROST, null],
      without: ['fire', 'storm'],
    });
    const seeds = s.hero.heartSeeds;
    const errors = attempts(s, [
      [
        { do: 'moveTo', x: T(29), y: T(15) },
        cast(2, T(34), T(12)),
        cast(0, T(34), T(10)),
        { do: 'wait', s: 2 },
      ],
      [{ do: 'moveTo', x: T(54), y: T(6), timeout: 10 }],
    ]);
    expect(errors).toHaveLength(1);
    expect(noneLeft(s, MAT.barricade, 50, 6, 50, 6)).toBe(false);
    expect(s.hero.heartSeeds).toBe(seeds);
  });
});

describe('the Foundry with Tide, and the Windward Cache with Gale', () => {
  // TODO(chemistry merge): enable once Tide (rules 24, 27, 28, 30) lands and RUNTIME_SHIPS has M8.
  it.skip('F6: the shrine gives Tide (the item get); Tide douses the 2-tile vent wall; walk through before it relights', () => {
    const s = prepareFen('f6', { arrive: 'w', weaves: [BOLT_FIRE, STRIKE, LOB_STORM, LOB_FROST] });
    const tide = () => s.hero.runes.filter((r) => r.rune === 'tide').length;
    expect(tide()).toBe(0);
    solveFen('f6 shrine', s, [
      { do: 'moveTo', x: T(15), y: T(12) },
      { do: 'walk', dirX: 1, dirY: 0, s: 2, until: (st) => allOn(st, 'rune_shrine') },
    ]);
    expect(tide()).toBe(1);
    expect(s.hero.runes.find((r) => r.rune === 'tide')!.level).toBe(10);
    expect(s.events.some((e) => e.type === 'elementUnlocked' && e.rune === 'tide')).toBe(true);
  });

  it.skip('F6: Lob[Tide] on the vents opens a 10 s gap; the player walks east through it', () => {
    const s = prepareFen('f6', {
      arrive: 'w',
      weaves: [BOLT_FIRE, STRIKE, 'Cast > Lob[Tide]', LOB_FROST],
      extra: ['tide'],
    });
    solveFen('f6', s, [
      { do: 'moveTo', x: T(35), y: T(12) },
      cast(2, T(39) + 2, T(12) + 2),
      { do: 'moveTo', x: T(45), y: T(12) },
      { do: 'walk', dirX: 1, dirY: 0, s: 3, until: into(fenRooms.f7) },
    ]);
  });

  it.skip('F7: douse each of the three fire walls in turn and go through before it relights', () => {
    const s = prepareFen('f7', { arrive: 'w', weaves: [BOLT_FIRE, STRIKE, 'Cast > Lob[Tide]', LOB_STORM] });
    solveFen('f7', s, [
      { do: 'moveTo', x: T(20), y: T(10) },
      cast(2, T(24), T(10) + 2),
      { do: 'moveTo', x: T(26), y: T(10) },
      cast(2, T(29), T(10) + 2),
      { do: 'moveTo', x: T(31), y: T(10) },
      cast(2, T(34), T(10) + 2),
      { do: 'moveTo', x: T(36), y: T(10) },
      { do: 'moveTo', x: T(62), y: T(10) },
      { do: 'walk', dirX: 1, dirY: 0, s: 3, until: into(fenRooms.f8) },
    ]);
  });

  it.skip('F8 east door (Floodline): Swath[Tide, Lingering] paints water from the pool to the dais; Storm the pool', () => {
    const s = prepareFen('f8', {
      arrive: 'w',
      weaves: [BOLT_FIRE, STRIKE, LOB_STORM, 'Cast > Swath[Tide, Lingering]'],
    });
    solveFen('f8 east', s, [
      { do: 'moveTo', x: T(40) + 1, y: T(15) },
      cast(3, T(47), T(15)),
      { do: 'moveTo', x: T(43), y: T(15) },
      cast(3, T(47), T(15)),
      { do: 'moveTo', x: T(38), y: T(18) },
      cast(2, T(36), T(15)),
      {
        do: 'until',
        cond: (st) => objects(st, 'door').some((o) => o.link === 'D' && o.on),
        timeout: 3,
        label: 'east door',
      },
      { do: 'moveTo', x: T(58), y: T(15) },
      { do: 'walk', dirX: 1, dirY: 0, s: 3, until: into(fenRooms.f9) },
    ]);
  });

  it.skip('F8 vault: douse the row of vents, Storm its near end; the grates carry the charge to the switch', () => {
    const s = prepareFen('f8', { arrive: 'w', weaves: [BOLT_FIRE, STRIKE, LOB_STORM, 'Cast > Lob[Tide]'] });
    solveFen('f8 vault', s, [
      { do: 'moveTo', x: T(11), y: T(27) },
      cast(3, T(14), T(27)),
      cast(3, T(17), T(27)),
      cast(3, T(19), T(27)),
      cast(2, T(13), T(27)),
      {
        do: 'until',
        cond: (st) => objects(st, 'door').some((o) => o.link === 'd' && o.on),
        timeout: 3,
        label: 'vault door',
      },
      { do: 'moveTo', x: T(27), y: T(29) },
      { do: 'until', cond: (st) => st.hero.loomShards === 1, timeout: 3, label: 'Loom Shard' },
    ]);
  });

  it.skip('F9: Tide fills a stretch of the chasm, Frost freezes it; cross to the big key', () => {
    const s = prepareFen('f9', { arrive: 'w', weaves: [BOLT_FIRE, STRIKE, 'Cast > Lob[Tide]', LOB_FROST] });
    solveFen('f9 key', s, [
      { do: 'moveTo', x: T(25), y: T(13) },
      cast(2, T(27), T(13)),
      cast(3, T(27), T(13)),
      { do: 'moveTo', x: T(30), y: T(13) },
      { do: 'moveTo', x: T(50), y: T(13) },
      { do: 'walk', dirX: 1, dirY: 0, s: 2, until: (st) => st.world.bigKeys.includes('foundry') },
    ]);
  });

  it.skip('F9 Heart Seed: Glaze the lane (Swath[Tide, Frost]), wash the ice block east with a Lob[Tide] behind it', () => {
    const s = prepareFen('f9', {
      arrive: 'w',
      weaves: [BOLT_FIRE, STRIKE, 'Cast > Lob[Tide]', 'Cast > Swath[Tide, Frost]'],
    });
    const seeds = s.hero.heartSeeds;
    solveFen('f9 seed', s, [
      { do: 'moveTo', x: T(7), y: T(27) },
      cast(3, T(4), T(27)),
      cast(3, T(11), T(27)),
      { do: 'moveTo', x: T(7), y: T(24) },
      cast(2, T(3), T(27)),
      {
        do: 'until',
        cond: (st) => objects(st, 'pressure_plate').every((o) => o.on),
        timeout: 3,
        label: 'plate',
      },
      { do: 'moveTo', x: T(19), y: T(24) },
      { do: 'moveTo', x: T(20), y: T(28) },
      { do: 'until', cond: (st) => st.hero.heartSeeds === seeds + 1, timeout: 2, label: 'heart seed' },
    ]);
  });

  it.skip('F1 alcove: Tide douses the vent wall; the chest holds a Fuse part and currency', () => {
    const s = prepareFen('f1', {
      arrive: 'w',
      weaves: [BOLT_FIRE, STRIKE, LOB_STORM, 'Cast > Lob[Tide]'],
      extra: ['tide'],
    });
    const parts = s.hero.parts.length;
    solveFen('f1 alcove', s, [
      { do: 'moveTo', x: T(41), y: T(24) },
      cast(3, T(43) + 2, T(24)),
      { do: 'moveTo', x: T(46), y: T(24) },
      { do: 'walk', dirX: 1, dirY: 0, s: 2, until: (st) => objects(st, 'loot_chest').every((o) => o.on) },
    ]);
    expect(s.hero.parts.length).toBe(parts + 1);
  });

  // TODO(chemistry merge): enable once Gale gusts spin wind vanes (DESIGN §6.6).
  it.skip('G7 Windward Cache: a Gale gust spins the vane; the cache gives a Pattern Seed', () => {
    const s = prepareFen('g7', {
      arrive: 's',
      weaves: [BOLT_FIRE, 'Cast > Strike[Gale]', LOB_STORM, LOB_FIRE],
      extra: ['gale'],
    });
    const seeds = s.hero.patternSeeds;
    solveFen('g7 cache', s, [
      { do: 'moveTo', x: T(41), y: T(10) },
      cast(1, T(41), T(7)),
      {
        do: 'until',
        cond: (st) => objects(st, 'door').some((o) => o.link === 'd' && o.on),
        timeout: 3,
        label: 'cache door',
      },
      { do: 'moveTo', x: T(40), y: T(4) },
      { do: 'until', cond: (st) => st.hero.patternSeeds === seeds + 1, timeout: 2, label: 'Pattern Seed' },
    ]);
  });
});

describe('the Foundry without Tide, and the cache without Gale', () => {
  const NO_TIDE = [BOLT_FIRE, STRIKE, LOB_STORM, LOB_FROST];

  it('F1 alcove without Tide: Fire, Frost and Storm leave the vents lit; the chest stays shut', () => {
    const s = prepareFen('f1', { arrive: 'w', weaves: NO_TIDE });
    const errors = attempts(s, [
      [
        { do: 'moveTo', x: T(40), y: T(24) },
        cast(0, T(44), T(24)),
        cast(2, T(43), T(24)),
        cast(3, T(43), T(25)),
        { do: 'wait', s: 2 },
      ],
      [{ do: 'moveTo', x: T(46), y: T(24), timeout: 8 }],
    ]);
    expect(errors).toHaveLength(1);
    expect(objects(s, 'loot_chest').every((o) => !o.on)).toBe(true);
  });

  it('F6 without Tide: the vent wall holds (the shrine is still reachable)', () => {
    const s = prepareFen('f6', { arrive: 'w', weaves: NO_TIDE });
    const errors = attempts(s, [
      [
        { do: 'moveTo', x: T(36), y: T(12) },
        cast(3, T(39), T(12)),
        cast(2, T(39), T(13)),
        { do: 'wait', s: 2 },
      ],
      [{ do: 'moveTo', x: T(45), y: T(12), timeout: 8 }],
    ]);
    expect(errors).toHaveLength(1);
    expect(s.room.id).toBe(fenRooms.f6);
  });

  it('F7 without Tide: the first fire wall holds', () => {
    const s = prepareFen('f7', { arrive: 'w', weaves: NO_TIDE, without: ['tide'] });
    const errors = attempts(s, [
      [{ do: 'moveTo', x: T(21), y: T(10) }, cast(3, T(24), T(10)), { do: 'wait', s: 1 }],
      [{ do: 'moveTo', x: T(26), y: T(10), timeout: 8 }],
    ]);
    expect(errors).toHaveLength(1);
  });

  it('F8 without Tide: Storm on the pool never reaches the dais across bare stone, nor the switch behind lit vents', () => {
    const s = prepareFen('f8', { arrive: 'w', weaves: NO_TIDE, without: ['tide'] });
    solveFen('f8 no tide', s, [
      { do: 'moveTo', x: T(41), y: T(18) },
      cast(2, T(37), T(15)),
      cast(2, T(45), T(15)),
      { do: 'moveTo', x: T(11), y: T(26) },
      cast(2, T(13), T(27)),
      cast(2, T(19), T(27)),
      { do: 'wait', s: 2 },
    ]);
    expect(powered(s)).toBe(0);
    expect(anyOn(s, 'door')).toBe(false);
  });

  it('F9 without Tide: the chasm stays a pit (Frost does nothing to it) and the lane block cannot be pushed', () => {
    const s = prepareFen('f9', { arrive: 'w', weaves: NO_TIDE, without: ['tide'] });
    const errors = attempts(s, [
      [{ do: 'moveTo', x: T(25), y: T(13) }, cast(3, T(27), T(13)), { do: 'wait', s: 1 }],
      [{ do: 'moveTo', x: T(30), y: T(13), timeout: 6 }],
      [
        { do: 'moveTo', x: T(7), y: T(27) },
        { do: 'moveTo', x: T(5), y: T(27), timeout: 4 },
        { do: 'walk', dirX: -1, dirY: 0, s: 2 },
      ],
    ]);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(s.world.bigKeys).toEqual([]);
    expect(objects(s, 'ice_block')[0]!.tx).toBe(4);
    expect(anyOn(s, 'pressure_plate')).toBe(false);
  });

  it('G7 cache without Gale: Fire, Frost and Storm never spin the vane', () => {
    const s = prepareFen('g7', { arrive: 's', weaves: [BOLT_FIRE, STRIKE, LOB_STORM, LOB_FROST] });
    solveFen('g7 no gale', s, [
      { do: 'moveTo', x: T(41), y: T(10) },
      cast(0, T(41), T(7)),
      cast(2, T(41), T(8)),
      cast(3, T(42), T(8)),
      { do: 'wait', s: 2 },
    ]);
    expect(anyOn(s, 'wind_vane')).toBe(false);
    expect(objects(s, 'door').some((o) => o.link === 'd' && o.on)).toBe(false);
  });
});
