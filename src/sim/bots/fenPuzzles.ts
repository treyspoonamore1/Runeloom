/**
 * The Glasswater Fen's scripted puzzle solutions (BUILD_PLAN M8 phase 1 task 10,
 * data/rooms/SOLUTIONS.md), shared by the puzzle tests (tests/sim/world/fenSolutions.test.ts,
 * foundrySolutions.test.ts) and the Fen campaign bot (bots/fenRun.ts), so the bot plays exactly
 * the solutions the tests prove. The Drowned Foundry's are in bots/foundryPuzzles.ts.
 *
 * A step is a named script (bots/script.ts) with the weaves it casts (slots 0–3: LMB, RMB, Q, E).
 * Scripts are built from the state when the step starts (`script(state)`), so a step can wait for
 * "one more Heart Seed than now". Steps that end in another room walk out through its exit.
 * Positions in cells; T(t) is tile t's center.
 */
import { fenRooms } from '../../../data/progression';
import { MAT } from '../../../data/materials';
import type { GameState } from '../state';
import type { WorldObject } from '../world/objects';
import type { ScriptCommand } from './script';

export type FenShort = keyof typeof fenRooms;

export interface PuzzleStep {
  /** The name the tests and the bot log it under ("g4 heart seed"). */
  name: string;
  /** Weaves for slots 0..3 (null: empty). */
  weaves: (string | null)[];
  script: (state: GameState) => ScriptCommand[];
}

/** Cell coordinate of tile t's center. */
export const T = (t: number): number => (t + 0.5) * 4;

export const objectsOf = (s: GameState, kind: WorldObject['kind']): WorldObject[] =>
  s.objects.filter((o) => o.kind === kind);
export const allOn = (s: GameState, kind: WorldObject['kind']): boolean =>
  objectsOf(s, kind).length > 0 && objectsOf(s, kind).every((o) => o.on);
export const anyOn = (s: GameState, kind: WorldObject['kind']): boolean =>
  objectsOf(s, kind).some((o) => o.on);
export const into = (id: string) => (s: GameState) => s.room.id === id;
/** Switches (S and Q) that are powered now. */
export const powered = (s: GameState): number =>
  s.objects.filter((o) => (o.kind === 'conduit_switch' || o.kind === 'sealed_switch') && o.on).length;
/** A door with link character `link` ('D' or 'd') is open. */
export const doorOpen = (link: string) => (s: GameState) =>
  objectsOf(s, 'door').some((o) => o.link === link && o.on);

/** True when no cell of tiles (tx0..tx1, ty0..ty1) is still `mat`. */
export function noneLeft(
  s: GameState,
  mat: number,
  tx0: number,
  ty0: number,
  tx1: number,
  ty1: number,
): boolean {
  const g = s.grid;
  for (let cy = ty0 * 4; cy < (ty1 + 1) * 4; cy++)
    for (let cx = tx0 * 4; cx < (tx1 + 1) * 4; cx++) if (g.ground[cy * g.width + cx] === mat) return false;
  return true;
}

export const LOB_STORM = 'Cast > Lob[Storm]';
export const BOLT_STORM = 'Cast > Bolt[Storm]';
export const BOLT_FIRE = 'Cast > Bolt[Fire]';
export const LOB_FIRE = 'Cast > Lob[Fire]';
export const LOB_FROST = 'Cast > Lob[Frost]';
export const LOB_TIDE = 'Cast > Lob[Tide]';
export const FLOODLINE = 'Cast > Swath[Tide, Lingering]';
export const STRIKE = 'Cast > Strike[]';

/** A cast of slot `slot` at cell (x, y). */
export const cast = (slot: number, x: number, y: number): ScriptCommand => ({
  do: 'cast',
  slot,
  at: { x, y },
});

/** Slots: 0 LMB Bolt[Fire], 1 RMB Strike, 2 Q Lob[Storm], 3 E Lob[Fire] or Lob[Frost]. */
const WEAVES = [BOLT_FIRE, STRIKE, LOB_STORM, LOB_FIRE];
const WEAVES_FROST = [BOLT_FIRE, STRIKE, LOB_STORM, LOB_FROST];
const STORM = 2;
const E = 3;

/** Lob[Frost] (slot 3) bursts every 8 cells along x = cx from y0 down to y1 (cells, y0 > y1). */
export function freezeNorth(cx: number, y0: number, y1: number): ScriptCommand[] {
  const out: ScriptCommand[] = [];
  for (let y = y0; y >= y1; y -= 8) out.push(cast(E, cx, y));
  return out;
}

const g1: PuzzleStep = {
  name: 'g1',
  weaves: WEAVES_FROST,
  script: () => [
    { do: 'moveTo', x: T(25), y: T(13) },
    cast(STORM, T(28), T(15)),
    { do: 'until', cond: (st) => allOn(st, 'door'), timeout: 3, label: 'gate opens' },
    { do: 'moveTo', x: T(50), y: T(7) },
    { do: 'walk', dirX: 1, dirY: 0, s: 3, until: into(fenRooms.g2) },
  ],
};

const g3: PuzzleStep = {
  name: 'g3',
  weaves: WEAVES,
  script: (s) => {
    const shards = s.hero.loomShards;
    return [
      { do: 'moveTo', x: T(24), y: T(18) },
      cast(STORM, T(24), T(15)),
      {
        do: 'until',
        cond: (st) => powered(st) === 2,
        timeout: 2,
        label: 'two switches through the hand-offs',
      },
      { do: 'moveTo', x: T(39), y: T(23) },
      cast(E, T(41), T(25)),
      {
        do: 'until',
        cond: (st) => objectsOf(st, 'ice_block').every((o) => o.on),
        timeout: 2,
        label: 'the plug melts',
      },
      { do: 'wait', s: 1.2 },
      cast(STORM, T(41), T(21)),
      { do: 'until', cond: (st) => powered(st) === 3, timeout: 2, label: 'the third switch' },
      { do: 'until', cond: (st) => allOn(st, 'door'), timeout: 2, label: 'vault opens' },
      { do: 'moveTo', x: T(50), y: T(17) },
      { do: 'until', cond: (st) => st.hero.loomShards === shards + 1, timeout: 2, label: 'Loom Shard' },
      { do: 'moveTo', x: T(28), y: T(1) },
      { do: 'walk', dirX: 0, dirY: -1, s: 3, until: into(fenRooms.g4) },
    ];
  },
};

/** G4: freeze a path north across the pulsing glass (ice doesn't conduct), on to G5. */
const g4Crossing: PuzzleStep = {
  name: 'g4',
  weaves: WEAVES_FROST,
  script: () => {
    const x = T(25);
    return [
      { do: 'moveTo', x, y: T(20) },
      ...freezeNorth(x, 76, 44),
      { do: 'moveTo', x, y: T(12) },
      ...freezeNorth(x, 40, 8),
      { do: 'moveTo', x, y: T(2) },
      { do: 'moveTo', x: T(31), y: T(1) },
      { do: 'walk', dirX: 0, dirY: -1, s: 3, until: into(fenRooms.g5) },
    ];
  },
};

/** G4's Heart Seed: an ice bridge out to the islet ringed by deep water. */
const g4Seed: PuzzleStep = {
  name: 'g4 heart seed',
  weaves: WEAVES_FROST,
  script: (s) => {
    const seeds = s.hero.heartSeeds;
    return [
      { do: 'moveTo', x: T(47), y: T(20) },
      ...freezeNorth(T(47), 76, 60),
      { do: 'moveTo', x: T(47), y: T(11) },
      { do: 'until', cond: (st) => st.hero.heartSeeds === seeds + 1, timeout: 2, label: 'heart seed' },
      { do: 'moveTo', x: T(47), y: T(20) },
    ];
  },
};

/** G5's Loom Shard behind bramble: burn it. */
const g5Shard: PuzzleStep = {
  name: 'g5 shard',
  weaves: WEAVES,
  script: (s) => {
    const shards = s.hero.loomShards;
    return [
      { do: 'moveTo', x: T(11), y: T(15) },
      cast(E, T(7), T(15)),
      {
        do: 'until',
        cond: (st) => noneLeft(st, MAT.bramble, 6, 14, 8, 16),
        timeout: 8,
        label: 'bramble burns',
      },
      { do: 'wait', s: 2 },
      { do: 'moveTo', x: T(3), y: T(15) },
      { do: 'until', cond: (st) => st.hero.loomShards === shards + 1, timeout: 2, label: 'Loom Shard' },
    ];
  },
};

/** G5: three switches in the fog within 12 s; out east to G6. */
const g5: PuzzleStep = {
  name: 'g5',
  weaves: WEAVES,
  script: () => [
    { do: 'moveTo', x: T(39), y: T(21) },
    cast(STORM, T(42), T(24)),
    { do: 'moveTo', x: T(19), y: T(15) },
    cast(STORM, T(16), T(12)),
    { do: 'moveTo', x: T(30), y: T(10) },
    cast(STORM, T(31), T(7)),
    { do: 'until', cond: (st) => allOn(st, 'door'), timeout: 2, label: 'east door opens' },
    { do: 'moveTo', x: T(54), y: T(16) },
    { do: 'walk', dirX: 1, dirY: 0, s: 3, until: into(fenRooms.g6) },
  ],
};

/** G7: four braziers within 15 s (two across the black pool); the Heart Seed. */
const g7: PuzzleStep = {
  name: 'g7',
  weaves: WEAVES,
  script: (s) => {
    const seeds = s.hero.heartSeeds;
    return [
      { do: 'moveTo', x: T(6), y: T(19) },
      cast(0, T(2), T(19)),
      { do: 'moveTo', x: T(10), y: T(16) },
      cast(0, T(18), T(16)),
      { do: 'moveTo', x: T(10), y: T(22) },
      { do: 'moveTo', x: T(40), y: T(22) },
      { do: 'moveTo', x: T(41), y: T(16) },
      cast(0, T(33), T(16)),
      { do: 'moveTo', x: T(41), y: T(19) },
      cast(0, T(45), T(19)),
      { do: 'until', cond: doorOpen('D'), timeout: 2, label: 'vault opens' },
      { do: 'moveTo', x: T(23), y: T(4) },
      { do: 'until', cond: (st) => st.hero.heartSeeds === seeds + 1, timeout: 2, label: 'heart seed' },
    ];
  },
};

/** G7's Windward Cache, after the Coil: a Gale gust spins the vane. */
export const g7Cache: PuzzleStep = {
  name: 'g7 cache',
  weaves: [BOLT_FIRE, 'Cast > Strike[Gale]', LOB_STORM, LOB_FIRE],
  script: (s) => {
    const seeds = s.hero.patternSeeds;
    return [
      { do: 'moveTo', x: T(41), y: T(10) },
      cast(1, T(41), T(7)),
      { do: 'until', cond: doorOpen('d'), timeout: 3, label: 'cache door' },
      { do: 'moveTo', x: T(40), y: T(4) },
      { do: 'walk', dirX: 0, dirY: -1, s: 2, until: (st) => st.hero.patternSeeds === seeds + 1 },
    ];
  },
};

/** G8: Storm on one span of the broken bridge crosses the gap; the sluice gate; on to F1. */
const g8: PuzzleStep = {
  name: 'g8',
  weaves: WEAVES,
  script: () => [
    { do: 'moveTo', x: T(33), y: T(16) },
    cast(STORM, T(37), T(17)),
    { do: 'until', cond: (st) => powered(st) === 2, timeout: 2, label: 'both switches' },
    { do: 'until', cond: (st) => allOn(st, 'door'), timeout: 2, label: 'gate opens' },
    { do: 'moveTo', x: T(58), y: T(16) },
    { do: 'walk', dirX: 1, dirY: 0, s: 3, until: into(fenRooms.f1) },
  ],
};

/** The overworld's solution steps by name (the tests run each one; the bot picks its route's). */
export const fenOverworldSteps = { g1, g3, g4Crossing, g4Seed, g5Shard, g5, g7, g7Cache, g8 } as const;
