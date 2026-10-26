/**
 * Scripted solutions for the Glasswater Fen overworld puzzle rooms (BUILD_PLAN M8 phase 1 task 10,
 * data/rooms/SOLUTIONS.md): each starts in the room with a tier 8 character's runes (fenSolve.ts),
 * runs the script with the world driver (src/sim/bots/script.ts) and asserts the door, chest or
 * pickup. Each puzzle room also has an attempt without the first element its CONTENT §13 "Needs"
 * column lists, which must fail. The Foundry's are in foundrySolutions.test.ts.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { fenRooms } from '../../../data/progression';
import { ScriptDriver, step, type GameState, type ScriptCommand } from '../../../src/sim';
import { fenOverworldSteps as O } from '../../../src/sim/bots/fenPuzzles';
import {
  anyOn,
  attempts,
  BOLT_FIRE,
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
  solveStep,
  STRIKE,
  T,
} from './fenSolve';

afterAll(() => console.log('fen solution ticks', JSON.stringify(fenTicks)));

/** Slots: 0 LMB Bolt[Fire], 1 RMB Strike, 2 Q Lob[Storm], 3 E Lob[Fire] or Lob[Frost]. */
const WEAVES = [BOLT_FIRE, STRIKE, LOB_STORM, LOB_FIRE];
const WEAVES_FROST = [BOLT_FIRE, STRIKE, LOB_STORM, LOB_FROST];
const STORM = 2;
const WEAVES_NO_STORM = [BOLT_FIRE, STRIKE, LOB_FIRE, LOB_FROST];

/**
 * Runs `script` and counts the pylon pulses that hurt the player: each 'pylonPulse' starts a round,
 * and a round counts once if any charge from it (a 'chargeHit' on the player) lands before the next.
 */
function pulsesTaken(
  s: GameState,
  script: ScriptCommand[],
): { rounds: number; pulses: number; error?: string } {
  const d = new ScriptDriver(script);
  let pulses = 0;
  const hurt = new Set<number>();
  for (let t = 0; t < 90 * 60; t++) {
    const f = d.next(s);
    if (!f) break;
    step(s, f);
    for (const e of s.events) {
      if (e.type === 'pylonPulse') pulses = Math.max(pulses, Math.floor(s.grid.tick / 40));
      if (e.type === 'chargeHit' && e.target === 'player') hurt.add(Math.floor(s.grid.tick / 40));
    }
  }
  return { rounds: hurt.size, pulses, error: d.error };
}

describe('Glasswater Fen puzzle solutions', () => {
  it('G1: one Storm hit anywhere in the glass pond reaches the switch on its post; the east gate opens', () => {
    solveStep('g1', 's', O.g1);
  });

  it('G3: the joint pool hands charge to both walkways; Fire melts the ice plug; the third switch wakes; the vault gives a Loom Shard', () => {
    solveStep('g3', 'w', O.g3);
  });

  it('G4: freezing a path across the pulsing glass takes no pulse damage (ice does not conduct)', () => {
    const s = prepareFen('g4', { arrive: 's', weaves: O.g4Crossing.weaves });
    const r = pulsesTaken(s, O.g4Crossing.script(s));
    expect(r.error).toBeUndefined();
    expect(r.pulses).toBeGreaterThanOrEqual(2);
    expect(r.rounds).toBe(0);
  });

  it('G4: wading the heron canal round the lake takes at least 5 pulses', () => {
    const s = prepareFen('g4', { arrive: 's', weaves: WEAVES_FROST });
    const r = pulsesTaken(s, [
      { do: 'moveTo', x: T(31), y: T(2), timeout: 40 },
      { do: 'moveTo', x: T(31), y: T(1) },
      { do: 'walk', dirX: 0, dirY: -1, s: 3, until: into(fenRooms.g5) },
    ]);
    expect(r.error).toBeUndefined();
    expect(r.rounds).toBeGreaterThanOrEqual(5);
  });

  it('G4: an ice bridge out to the islet ringed by deep water reaches the Heart Seed', () => {
    solveStep('g4', 's', O.g4Seed);
  });

  it('G5: three switches in the fog, each on its own pool, all within 12 s; the Loom Shard behind burnt bramble', () => {
    const s = prepareFen('g5', { arrive: 's', weaves: WEAVES });
    solveFen(O.g5Shard.name, s, O.g5Shard.script(s));
    expect(s.hero.loomShards).toBe(1);
    solveFen(O.g5.name, s, O.g5.script(s));
  });

  it('G5: a switch woken more than 12 s before the last sleeps again; the door stays shut', () => {
    const s = prepareFen('g5', { arrive: 's', weaves: WEAVES });
    solveFen('g5 slow', s, [
      { do: 'moveTo', x: T(39), y: T(21) },
      cast(STORM, T(42), T(24)),
      { do: 'until', cond: (st) => powered(st) === 1, timeout: 2, label: 'first switch' },
      { do: 'wait', s: 12.5 },
      { do: 'moveTo', x: T(19), y: T(15) },
      cast(STORM, T(16), T(12)),
      { do: 'moveTo', x: T(30), y: T(10) },
      cast(STORM, T(31), T(7)),
      { do: 'wait', s: 1 },
    ]);
    expect(powered(s)).toBe(2);
    expect(anyOn(s, 'door')).toBe(false);
  });

  it('G7: four braziers lit within 15 s (two across the black pool) open the vault on the Heart Seed', () => {
    const s = solveStep('g7', 's', O.g7);
    // The Windward Cache stays shut: it wants a wind vane, and nothing here blows.
    expect(objects(s, 'door').some((o) => o.link === 'd' && o.on)).toBe(false);
  });

  it('G8: Storm on one span of the broken bridge crosses the water gap to the other; the sluice gate opens', () => {
    solveStep('g8', 'w', O.g8);
  });
});

describe('the Fen without its element (CONTENT §13 "Needs")', () => {
  it('G1 without Storm: Fire and Frost on the pond and the switch do nothing; the gate stays shut', () => {
    const s = prepareFen('g1', { arrive: 's', weaves: WEAVES_NO_STORM, without: ['storm'] });
    const errors = attempts(s, [
      [
        { do: 'moveTo', x: T(25), y: T(13) },
        cast(0, T(31), T(13)),
        cast(2, T(29), T(13)),
        cast(3, T(30), T(14)),
        { do: 'wait', s: 2 },
      ],
      [{ do: 'moveTo', x: T(50), y: T(7), timeout: 8 }],
    ]);
    expect(errors).toHaveLength(1);
    expect(powered(s)).toBe(0);
    expect(anyOn(s, 'door')).toBe(false);
    expect(s.room.id).toBe(fenRooms.g1);
  });

  it('G3 without Storm: the plug melts, but no switch wakes and the vault stays shut', () => {
    const s = prepareFen('g3', { arrive: 'w', weaves: WEAVES_NO_STORM, without: ['storm'] });
    const errors = attempts(s, [
      [
        { do: 'moveTo', x: T(39), y: T(23) },
        cast(2, T(41), T(25)),
        { do: 'wait', s: 1 },
        cast(0, T(41), T(21)),
        { do: 'moveTo', x: T(24), y: T(18) },
        cast(3, T(24), T(15)),
        cast(0, T(12), T(10)),
        { do: 'wait', s: 2 },
      ],
      [{ do: 'moveTo', x: T(50), y: T(17), timeout: 8 }],
    ]);
    expect(errors).toHaveLength(1);
    expect(objects(s, 'ice_block').every((o) => o.on)).toBe(true);
    expect(powered(s)).toBe(0);
    expect(anyOn(s, 'door')).toBe(false);
    expect(s.hero.loomShards).toBe(0);
  });

  it('G4 without Frost: the Heart Seed is out of reach across deep water', () => {
    const s = prepareFen('g4', { arrive: 's', weaves: WEAVES, without: ['frost'] });
    const seeds = s.hero.heartSeeds;
    const errors = attempts(s, [[{ do: 'moveTo', x: T(47), y: T(11), timeout: 8 }]]);
    expect(errors).toHaveLength(1);
    expect(s.hero.heartSeeds).toBe(seeds);
  });

  it('G5 without Storm: Fire on the pools burns fog, not switches; the east door stays shut', () => {
    const s = prepareFen('g5', { arrive: 's', weaves: WEAVES_NO_STORM, without: ['storm'] });
    const errors = attempts(s, [
      [
        { do: 'moveTo', x: T(39), y: T(21) },
        cast(2, T(42), T(24)),
        cast(0, T(42), T(25)),
        { do: 'moveTo', x: T(19), y: T(15) },
        cast(2, T(16), T(12)),
        { do: 'moveTo', x: T(30), y: T(10) },
        cast(2, T(31), T(7)),
        { do: 'wait', s: 2 },
      ],
      [{ do: 'moveTo', x: T(54), y: T(16), timeout: 8 }],
    ]);
    expect(errors).toHaveLength(1);
    expect(powered(s)).toBe(0);
    expect(anyOn(s, 'door')).toBe(false);
  });

  it('G7 without Fire: Storm and Frost on the braziers light none; the vault stays shut', () => {
    const s = prepareFen('g7', {
      arrive: 's',
      weaves: [STRIKE, 'Cast > Bolt[Storm]', LOB_STORM, LOB_FROST],
      without: ['fire'],
    });
    const errors = attempts(s, [
      [
        { do: 'moveTo', x: T(6), y: T(19) },
        cast(1, T(2), T(19)),
        { do: 'moveTo', x: T(10), y: T(16) },
        cast(1, T(18), T(16)),
        cast(2, T(18), T(16)),
        cast(3, T(18), T(16)),
        { do: 'wait', s: 1 },
      ],
      [{ do: 'moveTo', x: T(23), y: T(4), timeout: 8 }],
    ]);
    expect(errors).toHaveLength(1);
    expect(anyOn(s, 'brazier')).toBe(false);
    expect(anyOn(s, 'door')).toBe(false);
  });

  it('G8 without Storm: the gate stays shut', () => {
    const s = prepareFen('g8', { arrive: 'w', weaves: WEAVES_NO_STORM, without: ['storm'] });
    const errors = attempts(s, [
      [
        { do: 'moveTo', x: T(33), y: T(16) },
        cast(0, T(36), T(15)),
        cast(2, T(41), T(16)),
        cast(3, T(42), T(17)),
        { do: 'wait', s: 2 },
      ],
      [{ do: 'moveTo', x: T(58), y: T(16), timeout: 8 }],
    ]);
    expect(errors).toHaveLength(1);
    expect(powered(s)).toBe(0);
    expect(anyOn(s, 'door')).toBe(false);
  });
});
