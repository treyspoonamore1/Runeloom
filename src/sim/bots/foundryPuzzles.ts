/**
 * The Drowned Foundry's scripted puzzle solutions (BUILD_PLAN M8 phase 1 task 10), shared by the
 * puzzle tests (tests/sim/world/foundrySolutions.test.ts) and the Fen campaign bot (bots/fenRun.ts).
 * Conventions as bots/fenPuzzles.ts.
 */
import { MAT } from '../../../data/materials';
import { fenRooms } from '../../../data/progression';
import type { GameState } from '../state';
import {
  allOn,
  anyOn,
  BOLT_FIRE,
  BOLT_STORM,
  cast,
  doorOpen,
  FLOODLINE,
  into,
  LOB_FIRE,
  LOB_FROST,
  LOB_STORM,
  LOB_TIDE,
  noneLeft,
  objectsOf,
  powered,
  STRIKE,
  T,
  type PuzzleStep,
} from './fenPuzzles';
import type { ScriptCommand } from './script';

/** Small keys held for the Foundry. */
export const foundryKeys = (s: GameState): number => s.world.keys['foundry'] ?? 0;

/** True when nothing burns in tiles (tx0..tx1, ty0..ty1). */
function noFire(s: GameState, tx0: number, ty0: number, tx1: number, ty1: number): boolean {
  const g = s.grid;
  for (let cy = ty0 * 4; cy < (ty1 + 1) * 4; cy++)
    for (let cx = tx0 * 4; cx < (tx1 + 1) * 4; cx++) if (g.fire[cy * g.width + cx]! > 0) return false;
  return true;
}

/** F1: one Storm hit in the moat powers both switches; the stair north to F2. */
const f1: PuzzleStep = {
  name: 'f1',
  weaves: [BOLT_FIRE, STRIKE, LOB_STORM, LOB_FROST],
  script: () => [
    { do: 'moveTo', x: T(21), y: T(10) },
    cast(2, T(18), T(7)),
    { do: 'until', cond: (st) => powered(st) === 2, timeout: 2, label: 'both switches' },
    { do: 'until', cond: (st) => allOn(st, 'door'), timeout: 2, label: 'door opens' },
    { do: 'moveTo', x: T(45), y: T(1) },
    { do: 'walk', dirX: 0, dirY: -1, s: 3, until: into(fenRooms.f2) },
  ],
};

/** F1's east alcove, with Tide: douse the vent wall; the chest. */
const f1Alcove: PuzzleStep = {
  name: 'f1 alcove',
  weaves: [BOLT_FIRE, STRIKE, LOB_STORM, LOB_TIDE],
  script: () => [
    { do: 'moveTo', x: T(41), y: T(24) },
    cast(3, T(43) + 2, T(24)),
    { do: 'moveTo', x: T(46), y: T(24) },
    { do: 'walk', dirX: 1, dirY: 0, s: 2, until: (st) => objectsOf(st, 'loot_chest').every((o) => o.on) },
  ],
};

/** F2: the sump touches two pump housings; the main pump struck within 3 s; north to F3. */
const f2: PuzzleStep = {
  name: 'f2',
  weaves: [BOLT_FIRE, BOLT_STORM, LOB_STORM, LOB_FROST],
  script: () => [
    { do: 'moveTo', x: T(22), y: T(18) },
    cast(2, T(23), T(25)),
    cast(1, T(22), T(2)),
    { do: 'until', cond: (st) => allOn(st, 'door'), timeout: 2, label: 'door opens' },
    { do: 'moveTo', x: T(40), y: T(2) },
    { do: 'walk', dirX: 0, dirY: -1, s: 3, until: into(fenRooms.f3) },
  ],
};

/** F3: freeze each cooling lane, slide both ice blocks onto the plates; the small key; east to F4. */
const f3: PuzzleStep = {
  name: 'f3',
  weaves: [BOLT_FIRE, STRIKE, LOB_STORM, LOB_FROST],
  script: (s) => {
    const keys = foundryKeys(s);
    const plate = (ty: number) => (st: GameState) =>
      objectsOf(st, 'pressure_plate').some((o) => o.ty === ty && o.on);
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
    return [
      ...lane(8),
      ...lane(22),
      { do: 'until', cond: (st) => allOn(st, 'door'), timeout: 3, label: 'vault opens' },
      { do: 'moveTo', x: T(43), y: T(15) },
      { do: 'walk', dirX: 1, dirY: 0, s: 2, until: (st) => foundryKeys(st) === keys + 1 },
      { do: 'moveTo', x: T(54), y: T(15) },
      { do: 'walk', dirX: 1, dirY: 0, s: 3, until: into(fenRooms.f4) },
    ];
  },
};

/** F4: Lob Fire on the oil channel burns the barricade; Heart Seed; the small key opens F5's door. */
const f4: PuzzleStep = {
  name: 'f4',
  weaves: [BOLT_FIRE, STRIKE, LOB_STORM, LOB_FIRE],
  script: (s) => {
    const seeds = s.hero.heartSeeds;
    return [
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
    ];
  },
};

/** F5: the Belfry door opens once the Bellwether falls; on to F6. */
const f5: PuzzleStep = {
  name: 'f5',
  weaves: [BOLT_FIRE, STRIKE, LOB_STORM, LOB_FIRE],
  script: () => [
    { do: 'until', cond: (st) => allOn(st, 'door'), timeout: 2, label: 'door opens' },
    { do: 'moveTo', x: T(24), y: T(9) },
    { do: 'walk', dirX: 1, dirY: 0, s: 3, until: into(fenRooms.f6) },
  ],
};

/** F6: touch the shrine (Tide, the item get). */
const f6Shrine: PuzzleStep = {
  name: 'f6 shrine',
  weaves: [BOLT_FIRE, STRIKE, LOB_STORM, LOB_FROST],
  script: () => [
    { do: 'moveTo', x: T(15), y: T(12) },
    { do: 'walk', dirX: 1, dirY: 0, s: 2, until: (st) => allOn(st, 'rune_shrine') },
  ],
};

/** F6: Lob[Tide] on the vent wall opens a gap; walk east through it to F7. */
const f6: PuzzleStep = {
  name: 'f6',
  weaves: [BOLT_FIRE, STRIKE, LOB_TIDE, LOB_FROST],
  script: () => [
    { do: 'moveTo', x: T(35), y: T(12) },
    cast(2, T(39) + 2, T(12) + 2),
    { do: 'moveTo', x: T(45), y: T(12) },
    { do: 'walk', dirX: 1, dirY: 0, s: 3, until: into(fenRooms.f7) },
  ],
};

/** F7: douse each of the three fire walls in turn and go through before it relights. */
const f7Walls = (): ScriptCommand[] => [
  { do: 'moveTo', x: T(20), y: T(10) },
  cast(2, T(24), T(10) + 2),
  { do: 'moveTo', x: T(26), y: T(10) },
  cast(2, T(29), T(10) + 2),
  { do: 'moveTo', x: T(31), y: T(10) },
  cast(2, T(34), T(10) + 2),
  { do: 'moveTo', x: T(36), y: T(10) },
];

/** F7 up to beyond the third wall (the bot fights the far side's packs there). */
const f7Cross: PuzzleStep = {
  name: 'f7 cross',
  weaves: [BOLT_FIRE, STRIKE, LOB_TIDE, LOB_STORM],
  script: f7Walls,
};

/** F7 through all three walls and on to F8. */
const f7: PuzzleStep = {
  name: 'f7',
  weaves: f7Cross.weaves,
  script: () => [
    ...f7Walls(),
    { do: 'moveTo', x: T(62), y: T(10) },
    { do: 'walk', dirX: 1, dirY: 0, s: 3, until: into(fenRooms.f8) },
  ],
};

/** F8's vault: douse the row of vents, Storm its near end; the Loom Shard. */
const f8Vault: PuzzleStep = {
  name: 'f8 vault',
  weaves: [BOLT_FIRE, STRIKE, LOB_STORM, LOB_TIDE],
  script: (s) => {
    const shards = s.hero.loomShards;
    return [
      { do: 'moveTo', x: T(11), y: T(27) },
      cast(3, 54, T(27)),
      cast(3, 60, T(27)),
      cast(3, 66, T(27)),
      cast(3, 72, T(27)),
      cast(3, 78, T(27)),
      cast(2, T(13), T(27)),
      { do: 'until', cond: doorOpen('d'), timeout: 3, label: 'vault door' },
      { do: 'moveTo', x: T(27), y: T(30) },
      { do: 'until', cond: (st) => st.hero.loomShards === shards + 1, timeout: 3, label: 'Loom Shard' },
    ];
  },
};

/** F8's east door (Floodline): paint water from the pool to the dais, Storm the pool; on to F9. */
const f8East: PuzzleStep = {
  name: 'f8 east',
  weaves: [BOLT_FIRE, STRIKE, LOB_STORM, FLOODLINE],
  script: () => [
    // Stand in the pool's shallow rim so the strip starts in the pool.
    { do: 'moveTo', x: T(39), y: T(15) },
    cast(3, T(47), T(15)),
    { do: 'moveTo', x: 170, y: T(15) },
    cast(3, T(47), T(15)),
    { do: 'moveTo', x: 178, y: T(15) },
    cast(3, T(47), T(15)),
    { do: 'moveTo', x: T(39), y: T(18) },
    cast(2, T(39), T(15)),
    { do: 'until', cond: doorOpen('D'), timeout: 3, label: 'east door' },
    { do: 'moveTo', x: T(58), y: T(15) },
    { do: 'walk', dirX: 1, dirY: 0, s: 3, until: into(fenRooms.f9) },
  ],
};

/** F8 north: the big key opens the door to the Glass Eye (F10). */
const f8North: PuzzleStep = {
  name: 'f8 north',
  weaves: [BOLT_FIRE, STRIKE, LOB_STORM, LOB_TIDE],
  script: () => [
    { do: 'moveTo', x: 120, y: T(7) },
    { do: 'walk', dirX: 0, dirY: -1, s: 3, until: (st) => anyOn(st, 'big_key_door') },
    { do: 'moveTo', x: 120, y: T(2) },
    { do: 'walk', dirX: 0, dirY: -1, s: 3, until: into(fenRooms.f10) },
  ],
};

/** F9: Tide fills a stretch of the chasm, Frost freezes it; cross to the big key. */
const f9Key: PuzzleStep = {
  name: 'f9 key',
  weaves: [BOLT_FIRE, STRIKE, LOB_TIDE, LOB_FROST],
  script: () => [
    { do: 'moveTo', x: T(25), y: T(13) },
    cast(2, 106, T(13)),
    cast(2, 114, T(13)),
    cast(3, 106, T(13)),
    cast(3, 114, T(13)),
    { do: 'moveTo', x: T(30), y: T(13) },
    { do: 'moveTo', x: T(50), y: T(13) },
    { do: 'walk', dirX: 1, dirY: 0, s: 2, until: (st) => st.world.bigKeys.includes('foundry') },
  ],
};

/** F9's Heart Seed: Glaze the walled lane over its wall, wash the ice block east onto the plate. */
const f9Seed: PuzzleStep = {
  name: 'f9 seed',
  weaves: [BOLT_FIRE, STRIKE, LOB_TIDE, LOB_FROST],
  script: (s) => {
    const seeds = s.hero.heartSeeds;
    const lane = T(27);
    return [
      { do: 'moveTo', x: T(7), y: T(24) },
      // Tide then Frost over every cell of lane tiles 5-10 (Lob bursts, radius 5): borrowed ice for
      // 15 s. An ice block slides only on a tile that is ice in all 16 cells; the plate's isn't.
      // Bursts east of the block wash it west, into the pit: it can't go.
      ...[21.5, 28.5, 35.5, 41.5].map((x) => cast(2, x, lane)),
      ...[21.5, 28.5, 35.5, 41.5].map((x) => cast(3, x, lane)),
      // A Lob[Tide] on the pit behind the block washes it east (away from the burst's center).
      cast(2, T(3), lane),
      {
        do: 'until',
        cond: (st) => objectsOf(st, 'pressure_plate').every((o) => o.on),
        timeout: 3,
        label: 'plate',
      },
      { do: 'until', cond: (st) => allOn(st, 'door'), timeout: 2, label: 'vault opens' },
      { do: 'moveTo', x: T(19), y: T(24) },
      { do: 'moveTo', x: T(20), y: T(28) },
      { do: 'until', cond: (st) => st.hero.heartSeeds === seeds + 1, timeout: 2, label: 'heart seed' },
    ];
  },
};

export const foundrySteps = {
  f1,
  f1Alcove,
  f2,
  f3,
  f4,
  f5,
  f6Shrine,
  f6,
  f7Cross,
  f7,
  f8Vault,
  f8East,
  f8North,
  f9Key,
  f9Seed,
} as const;
