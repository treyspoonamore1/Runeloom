/**
 * The Chemistry Lab (BUILD_PLAN M3 task 9, `?scene=lab`): one labeled station per chemistry rule
 * (DESIGN §6.3). Each station is an area of the lab room plus a short script of element
 * applications; running a station resets its area to the room's original terrain, then plays the
 * script.
 *
 * CONTRACT (M3): the content agent fills `labStations`; the renderer draws each station's label
 * above its area; the sim runs scripts deterministically (so lab tests run headless).
 *
 * The lab room (data/rooms/test/lab.txt) is a grid of 8 × 4 bays. Every bay is a walled cubicle
 * 6 × 6 tiles (24 × 24 cells) that opens SOUTH onto a 3-tile walkway; stations are listed in
 * reading order (row by row), so the list is sorted by rule number. A bay's label sits above it,
 * in the wall row and the walkway of the bay row above.
 */
import type { Footprint, TerrainElement } from '../src/sim/grid/paint';

export interface LabStep {
  /** Seconds after the station starts. A step at 0 (or less) is applied by `runStation` itself, before entities spawn. */
  at: number;
  element: TerrainElement;
  /** In cells, RELATIVE to the station area's top-left corner (rect.tx × 4, rect.ty × 4). */
  shape: Footprint;
  /** Team that applies it (default 'player'). */
  owner?: 'player' | 'enemy' | 'world';
  /** Damage of the "hit" for rules that deal damage through terrain (Storm charge). Default 0. */
  hitDamage?: number;
}

/** An entity the station places when it runs. */
export interface LabSpawn {
  kind: string;
  /** In cells, relative to the area's top-left corner. */
  x: number;
  y: number;
  /** Starts hunting the player right away (walking enemies; dummies never move). */
  aggro?: boolean;
}

/**
 * Something done to the entities standing in the station's area, which terrain can't do (rule 20
 * needs a Frozen enemy killed). Targets every live enemy inside the area, or only `kind`.
 */
export interface LabAction {
  /** Seconds after the station starts. */
  at: number;
  /** 'freeze': Frozen for 3 s. 'kill': dies as if hit (a Frozen one shatters). */
  do: 'freeze' | 'kill';
  kind?: string;
}

export interface LabStation {
  /** Rule number in DESIGN §6.3, or 0 for a station that shows several rules together. */
  rule: number;
  /** Shown above the station, e.g. "07 · Frost on shallow water → ice". */
  label: string;
  /** The station's area in room TILES. Running the station restores this area first. */
  rect: { tx: number; ty: number; w: number; h: number };
  script: LabStep[];
  /** Entities placed when the station runs (entity rules, e.g. a dummy standing in water), in cells relative to the area. */
  spawns?: LabSpawn[];
  /** Entity actions on a timer, see LabAction. */
  actions?: LabAction[];
}

/** The lab room (data/rooms/test/lab.txt): plaques, the R keys and the hint appear wherever it is loaded. */
export const labRoomId = 'test/lab';

/** Tiles of walkway south of every bay: standing in the strip below a bay counts as being at that station. */
export const labFrontTiles = 3;

/** Seconds a 'freeze' action freezes an enemy. */
export const labFreezeSeconds = 3;

/** Bay layout of data/rooms/test/lab.txt, in tiles. */
const BAY = { cols: 8, w: 6, h: 6, x0: 4, y0: 1, pitchX: 7, pitchY: 10 } as const;

function bay(index: number): LabStation['rect'] {
  const col = index % BAY.cols;
  const row = Math.floor(index / BAY.cols);
  return { tx: BAY.x0 + col * BAY.pitchX, ty: BAY.y0 + row * BAY.pitchY, w: BAY.w, h: BAY.h };
}

const circle = (x: number, y: number, r: number): Footprint => ({ kind: 'circle', x, y, r });
const line = (x0: number, y0: number, x1: number, y1: number, width: number): Footprint => ({
  kind: 'line',
  x0,
  y0,
  x1,
  y1,
  width,
});
const fire = (at: number, x: number, y: number, r: number): LabStep => ({
  at,
  element: 'fire',
  shape: circle(x, y, r),
});
const frost = (at: number, x: number, y: number, r: number): LabStep => ({
  at,
  element: 'frost',
  shape: circle(x, y, r),
});
const storm = (at: number, x: number, y: number, r: number, hitDamage = 0): LabStep => ({
  at,
  element: 'storm',
  shape: circle(x, y, r),
  hitDamage,
});
const dummy = (x: number, y: number): LabSpawn => ({ kind: 'dummy', x, y });

type Entry = Omit<LabStation, 'rect'>;

/** One entry per bay, in reading order. Cell coordinates are inside the 24 × 24 cell bay; y grows toward the walkway. */
const entries: Entry[] = [
  // Row 0
  { rule: 1, label: '01 · Fire ignites grass', script: [fire(0.5, 12, 8, 1.5)] },
  { rule: 2, label: '02 · Fire spreads along grass', script: [fire(0.5, 2, 8, 1.5)] },
  { rule: 3, label: '03 · A burning bridge drops (6 s)', script: [fire(0.3, 12, 12, 4)] },
  { rule: 3, label: '03 · A burning wood floor falls away (6 s)', script: [fire(0.3, 12, 10, 3)] },
  {
    rule: 3,
    label: '03 · Crates (3 s) and barricades (4 s) burn away',
    script: [fire(0.3, 8, 8, 2.5), fire(1.5, 18, 8, 2.5)],
  },
  { rule: 4, label: '04 · Fire on water makes steam', script: [fire(0.3, 6, 10, 3), fire(1.2, 18, 10, 3)] },
  { rule: 5, label: '05 · Fire melts ice', script: [fire(0.5, 12, 10, 4)] },
  {
    rule: 5,
    label: '05 · Fire melts an ice bridge',
    script: [frost(0, 12, 12, 4), fire(1.5, 12, 12, 4)],
  },
  // Row 1
  { rule: 6, label: '06 · Fire ignites oil', script: [fire(0.5, 6, 6, 1.5)] },
  {
    rule: 6,
    label: '06 · Burning oil floats on water',
    script: [fire(0.2, 2, 2, 1.5), fire(1, 12, 8, 1.5)],
  },
  { rule: 7, label: '07 · Frost on shallow water → ice', script: [frost(0.5, 12, 10, 4)] },
  {
    rule: 8,
    label: '08 · Frost on deep water → ice bridge (8 s)',
    script: [{ at: 0.5, element: 'frost', shape: line(12, 2, 12, 17, 4) }],
  },
  {
    rule: 9,
    label: '09 · Frost puts out fire',
    script: [fire(0, 12, 10, 5), frost(0.8, 12, 10, 5), fire(2, 12, 10, 5)],
  },
  { rule: 10, label: '10 · Frost turns mud to dirt', script: [frost(0.5, 12, 10, 4)] },
  {
    rule: 11,
    label: '11 · Storm electrifies a water body',
    script: [storm(0.5, 3, 13, 1.5, 40)],
    spawns: [dummy(8, 10), dummy(21, 6)],
  },
  {
    rule: 12,
    label: '12 · Storm electrifies a metal network',
    script: [storm(0.5, 6, 6, 1.5, 40)],
    spawns: [dummy(18, 14), dummy(10, 10)],
  },
  // Row 2
  {
    rule: 13,
    label: '13 · Charge crosses water and metal',
    script: [storm(0.5, 4, 10, 2, 30)],
    spawns: [dummy(6, 14), dummy(18, 12)],
  },
  {
    rule: 14,
    label: '14 · Storm ignites dry grass',
    script: Array.from({ length: 10 }, (_, i) =>
      storm(i * 0.3, [8, 16, 12, 8, 16][i % 5]!, [6, 6, 10, 14, 14][i % 5]!, 2.5, 10),
    ),
  },
  {
    rule: 15,
    label: '15 · Shallow water wets entities',
    script: [],
    spawns: [dummy(6, 10), dummy(18, 10)],
  },
  {
    rule: 16,
    label: '16 · Burning ground ignites entities',
    script: [fire(0.5, 6, 6, 2)],
    spawns: [dummy(12, 10)],
  },
  {
    rule: 17,
    label: '17 · Oil makes entities Oiled',
    script: [],
    spawns: [dummy(10, 10), dummy(22, 18)],
  },
  {
    rule: 18,
    label: '18 · An ignited Oiled entity burns twice as hard',
    script: [fire(1, 6, 6, 1.5)],
    spawns: [dummy(12, 10)],
  },
  {
    rule: 19,
    label: '19 · Shock arcs between wet enemies',
    script: [storm(1, 10, 10, 1.2, 30)],
    spawns: [dummy(10, 10), dummy(6, 6), dummy(14, 6), dummy(6, 14), dummy(14, 14)],
  },
  {
    rule: 20,
    label: '20 · Shatter: a Frozen kill bursts into frost',
    script: [],
    spawns: [{ kind: 'shieldbearer', x: 10, y: 10 }],
    actions: [
      // Frozen at once, so it can't walk toward a player watching from the walkway first.
      { at: 0.05, do: 'freeze', kind: 'shieldbearer' },
      { at: 0.8, do: 'kill', kind: 'shieldbearer' },
    ],
  },
  // Row 3
  {
    rule: 22,
    label: '22 · A burning enemy lights the grass',
    script: [],
    spawns: [{ kind: 'tinderling', x: 12, y: 3, aggro: true }],
  },
  { rule: 23, label: '23 · Fire dries mud', script: [fire(0.3, 12, 10, 3)] },
  {
    rule: 25,
    label: '25 · An ice bridge breaks under an entity (10 s)',
    script: [{ at: 0, element: 'frost', shape: line(12, 6, 12, 18, 4) }],
    spawns: [dummy(12, 12)],
  },
  { rule: 26, label: '26 · Placed fire on stone spreads to grass', script: [fire(0.3, 9, 10, 3.2)] },
  {
    rule: 0,
    label: 'Barrel explosion: crates, grass, a dummy',
    script: [fire(0.3, 10, 10, 1.5)],
    spawns: [dummy(13, 9)],
  },
  {
    rule: 0,
    label: 'Wildfire meets river',
    script: [fire(0, 4, 10, 3), fire(1, 12, 2, 2)],
    spawns: [dummy(20, 10)],
  },
  {
    rule: 0,
    label: 'Electrified oil slick',
    script: [storm(0.4, 2, 6, 1.5, 30), fire(1.5, 12, 12, 2)],
    spawns: [dummy(8, 12), dummy(16, 12)],
  },
  { rule: 0, label: 'Oil fuse to the powder keg', script: [fire(0.3, 3, 10, 1.5)] },
];

export const labStations: LabStation[] = entries.map((e, i) => ({ ...e, rect: bay(i) }));
