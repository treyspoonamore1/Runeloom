/**
 * Scripted solutions for the Drowned Foundry puzzle rooms (BUILD_PLAN M8 phase 1 task 10,
 * data/rooms/SOLUTIONS.md), as fenSolutions.test.ts does for the overworld: each solution reaches
 * its door, chest or pickup, and each puzzle room has an attempt without its first needed element
 * that fails. G7's Windward Cache (Gale) is here too, with the other after-the-dungeon-item tests.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { MAT } from '../../../data/materials';
import { fenRooms } from '../../../data/progression';
import type { GameState } from '../../../src/sim';
import { fenOverworldSteps as O } from '../../../src/sim/bots/fenPuzzles';
import { foundrySteps as F } from '../../../src/sim/bots/foundryPuzzles';
import {
  anyOn,
  attempts,
  BOLT_FIRE,
  BOLT_STORM,
  cast,
  fenTicks,
  LOB_FIRE,
  LOB_FROST,
  LOB_STORM,
  objects,
  powered,
  prepareFen,
  solveFen,
  solveStep,
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

describe('Drowned Foundry puzzle solutions (first half)', () => {
  it('F1: one Storm hit in the moat powers the switch on each bank; the door opens on the stair north', () => {
    const s = solveStep('f1', 'w', F.f1);
    // The east alcove stays sealed behind its lit vents.
    expect(objects(s, 'loot_chest').every((o) => !o.on)).toBe(true);
  });

  it('F2: the sump touches two pump housings; with the main pump struck within 3 s, all three wake', () => {
    solveStep('f2', 's', F.f2);
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
    const s = solveStep('f3', 's', F.f3);
    expect(keys(s)).toBe(1);
  });

  it('F4: Lob Fire on the oil channel; it runs across the slag pit and burns the barricade; Heart Seed; F3 key opens the Belfry door', () => {
    const s = prepareFen('f4', { arrive: 'w', weaves: F.f4.weaves });
    s.world.keys['foundry'] = 1; // F3's small key
    solveFen(F.f4.name, s, F.f4.script(s));
    expect(keys(s)).toBe(0);
  });

  it('F5: the Belfry door opens once the mini-boss falls (`cleared`), on to the Tide Shrine', () => {
    solveStep('f5', 'w', F.f5, { killAll: true });
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
  it('F6: the shrine gives Tide (the item get); Tide douses the 2-tile vent wall; walk through before it relights', () => {
    const s = prepareFen('f6', { arrive: 'w', weaves: F.f6Shrine.weaves });
    const tide = () => s.hero.runes.filter((r) => r.rune === 'tide').length;
    expect(tide()).toBe(0);
    solveFen(F.f6Shrine.name, s, F.f6Shrine.script(s));
    expect(tide()).toBe(1);
    expect(s.hero.runes.find((r) => r.rune === 'tide')!.level).toBe(10);
    expect(s.events.some((e) => e.type === 'elementUnlocked' && e.rune === 'tide')).toBe(true);
  });

  it('F6: Lob[Tide] on the vents opens a 10 s gap; the player walks east through it', () => {
    solveStep('f6', 'w', F.f6, { extra: ['tide'] });
  });

  it('F7: douse each of the three fire walls in turn and go through before it relights', () => {
    solveStep('f7', 'w', F.f7);
  });

  it('F8 east door (Floodline): Swath[Tide, Lingering] paints water from the pool to the dais; Storm the pool', () => {
    solveStep('f8', 'w', F.f8East);
  });

  it('F8 vault: douse the row of vents, Storm its near end; the grates carry the charge to the switch', () => {
    const s = solveStep('f8', 'w', F.f8Vault);
    expect(s.hero.loomShards).toBe(1);
  });

  it("F8 north: with F9's big key the big-key door opens on the Glass Eye", () => {
    const s = prepareFen('f8', { arrive: 'w', weaves: F.f8North.weaves });
    s.world.bigKeys.push('foundry');
    solveFen(F.f8North.name, s, F.f8North.script(s));
    expect(s.room.id).toBe(fenRooms.f10);
  });

  it('F9: Tide fills a stretch of the chasm, Frost freezes it; cross to the big key', () => {
    solveStep('f9', 'w', F.f9Key);
  });

  it('F9 Heart Seed: Glaze the walled lane over its wall (Lob[Tide], then Lob[Frost]), wash the ice block east with a Lob[Tide] behind it', () => {
    solveStep('f9', 'w', F.f9Seed);
  });

  it('F1 alcove: Tide douses the vent wall; the chest holds a Fuse part and currency', () => {
    const s = prepareFen('f1', { arrive: 'w', weaves: F.f1Alcove.weaves, extra: ['tide'] });
    const parts = s.hero.parts.length;
    solveFen(F.f1Alcove.name, s, F.f1Alcove.script(s));
    expect(s.hero.parts.length).toBe(parts + 1);
  });

  it('G7 Windward Cache: a Gale gust spins the vane; the cache gives a Pattern Seed', () => {
    solveStep('g7', 's', O.g7Cache, { extra: ['gale'] });
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

  it('F9 without Tide: the chasm stays a pit (Frost does nothing to it), and Frost alone on the walled lane leaves the plate up', () => {
    const s = prepareFen('f9', { arrive: 'w', weaves: NO_TIDE, without: ['tide'] });
    const errors = attempts(s, [
      [{ do: 'moveTo', x: T(25), y: T(13) }, cast(3, T(27), T(13)), { do: 'wait', s: 1 }],
      [{ do: 'moveTo', x: T(30), y: T(13), timeout: 6 }],
      [{ do: 'moveTo', x: T(7), y: T(24) }, cast(3, 23, T(27)), cast(3, 31, T(27)), { do: 'wait', s: 1 }],
    ]);
    expect(errors).toHaveLength(1);
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
