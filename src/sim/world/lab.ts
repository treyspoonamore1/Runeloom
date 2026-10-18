/**
 * Chemistry Lab runner (BUILD_PLAN M3 task 9). Runs the stations of data/lab.ts on a live game:
 * `runStation` restores the station's area to the room's original terrain, clears the entities in
 * it, applies its first terrain steps, spawns its entities and schedules the rest in `state.lab`;
 * `stepLab` (called from `step`) fires whatever is due. Everything scheduled is plain data in the
 * state and hashed, so a lab run replays and compares like any other sim.
 *
 * `runStation` and `runAllStations` change the state OUTSIDE `step` (like console cheats): the
 * caller marks the session edited.
 */
import {
  labFreezeSeconds,
  labFrontTiles,
  labStations,
  type LabAction,
  type LabStation,
  type LabStep,
} from '../../../data/lab';
import { OWNER } from '../../../data/materials';
import { PLAYER_ID, spawnEnemy } from '../actors/enemies';
import { freezeTarget } from '../combat/ailments';
import { killEnemy } from '../combat/hits';
import { aggro } from '../ai';
import { SIM_HZ, TILE_CELLS } from '../core/constants';
import type { Hasher } from '../core/hash';
import { createGrid, type Grid } from '../grid/grid';
import { applyElement, type Footprint, type TerrainElement } from '../grid/paint';
import type { GameState } from '../state';
import type { Room } from './room';

/** A rectangle in cells: [x0, x1) × [y0, y1). */
export interface CellRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** A scheduled terrain step. Its shape is already in room cells. */
export interface LabElementTask {
  kind: 'element';
  /** Sim tick (state.tick) on which it fires. */
  tick: number;
  /** Index of the station that scheduled it. */
  station: number;
  element: TerrainElement;
  shape: Footprint;
  owner: 'player' | 'enemy' | 'world';
  hitDamage: number;
}

/** A scheduled entity action on the enemies inside `area`. */
export interface LabActionTask {
  kind: 'action';
  tick: number;
  station: number;
  action: LabAction['do'];
  enemyKind: string;
  area: CellRect;
}

export type LabTask = LabElementTask | LabActionTask;

export interface LabState {
  /** Pending tasks, ordered by tick (ties keep scheduling order). */
  tasks: LabTask[];
  /** Stations run so far (a counter, so a run always shows in the hash). */
  runs: number;
}

export function createLabState(): LabState {
  return { tasks: [], runs: 0 };
}

const ownerCode = { player: OWNER.player, enemy: OWNER.enemy, world: OWNER.world } as const;

// The room's unmodified grid, built on first use. Rooms never change after creation.
const pristine = new WeakMap<Room, Grid>();

function pristineGrid(room: Room): Grid {
  let g = pristine.get(room);
  if (!g) pristine.set(room, (g = createGrid(room)));
  return g;
}

/** A station's floor area in cells. */
export function stationArea(s: LabStation): CellRect {
  const { tx, ty, w, h } = s.rect;
  return { x0: tx * TILE_CELLS, y0: ty * TILE_CELLS, x1: (tx + w) * TILE_CELLS, y1: (ty + h) * TILE_CELLS };
}

/** The area plus the walkway strip south of it: standing there counts as standing at the station. */
export function stationZone(s: LabStation): CellRect {
  const a = stationArea(s);
  return { ...a, y1: a.y1 + labFrontTiles * TILE_CELLS };
}

function inside(r: CellRect, x: number, y: number): boolean {
  return x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;
}

/**
 * The station the player is at: the one whose zone holds the player, else the nearest area.
 * -1 for an empty list.
 */
export function nearestStation(state: GameState, stations: readonly LabStation[] = labStations): number {
  const { x, y } = state.player;
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i]!;
    if (inside(stationZone(s), x, y)) return i;
    const a = stationArea(s);
    const dx = Math.max(a.x0 - x, 0, x - a.x1);
    const dy = Math.max(a.y0 - y, 0, y - a.y1);
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Copies the pristine cells of `area` over the live grid and tells the renderer. */
function restoreArea(state: GameState, area: CellRect): void {
  const live = state.grid;
  const orig = pristineGrid(state.room);
  for (const key of Object.keys(live) as Array<keyof Grid>) {
    const dst = live[key];
    const src = orig[key];
    if (!ArrayBuffer.isView(dst) || !ArrayBuffer.isView(src)) continue;
    const d = dst as unknown as Uint8Array;
    const s = src as unknown as Uint8Array;
    for (let cy = area.y0; cy < area.y1; cy++) {
      const row = cy * live.width;
      d.set(s.subarray(row + area.x0, row + area.x1), row + area.x0);
    }
  }
  live.version++;
}

/** Removes the enemies and projectiles whose centers are in `area`. */
function clearEntities(state: GameState, area: CellRect): void {
  let n = 0;
  const enemies = state.enemies;
  for (const e of enemies) if (!inside(area, e.x, e.y)) enemies[n++] = e;
  enemies.length = n;
  n = 0;
  const shots = state.projectiles;
  for (const p of shots) if (!inside(area, p.x, p.y)) shots[n++] = p;
  shots.length = n;
  state.enemyHash.rebuild(enemies);
}

function shiftShape(s: Footprint, dx: number, dy: number): Footprint {
  switch (s.kind) {
    case 'circle':
      return { ...s, x: s.x + dx, y: s.y + dy };
    case 'line':
      return { ...s, x0: s.x0 + dx, y0: s.y0 + dy, x1: s.x1 + dx, y1: s.y1 + dy };
    case 'strip':
    case 'arc':
      return { ...s, x: s.x + dx, y: s.y + dy };
  }
}

function applyTask(state: GameState, t: LabElementTask): void {
  applyElement(state, {
    element: t.element,
    shape: t.shape,
    owner: ownerCode[t.owner],
    sourceId: PLAYER_ID,
    hitDamage: t.hitDamage,
    durationMult: 1,
  });
}

function elementTask(station: number, tick: number, step: LabStep, area: CellRect): LabElementTask {
  return {
    kind: 'element',
    tick,
    station,
    element: step.element,
    shape: shiftShape(step.shape, area.x0, area.y0),
    owner: step.owner ?? 'player',
    hitDamage: step.hitDamage ?? 0,
  };
}

function runAction(state: GameState, t: LabActionTask): void {
  for (const e of state.enemies) {
    if (e.dead || !inside(t.area, e.x, e.y)) continue;
    if (t.enemyKind !== '' && e.kind !== t.enemyKind) continue;
    if (t.action === 'freeze') freezeTarget(state, e, labFreezeSeconds, PLAYER_ID);
    else killEnemy(state, e, PLAYER_ID, 'hit');
  }
}

/**
 * Runs station `index`: restores its area, clears the entities in it, applies the steps at
 * second 0 (so a bridge can exist before something stands on it), spawns its entities and
 * schedules everything else. Running it again replaces its pending tasks.
 */
export function runStation(
  state: GameState,
  index: number,
  stations: readonly LabStation[] = labStations,
): void {
  const station = stations[index];
  if (!station) throw new RangeError(`No lab station ${index}`);
  const area = stationArea(station);
  const lab = state.lab;
  lab.tasks = lab.tasks.filter((t) => t.station !== index);
  restoreArea(state, area);
  clearEntities(state, area);
  const later: LabTask[] = [];
  for (const step of station.script) {
    const task = elementTask(index, state.tick + Math.round(step.at * SIM_HZ), step, area);
    if (step.at <= 0) applyTask(state, task);
    else later.push(task);
  }
  for (const sp of station.spawns ?? []) {
    const e = spawnEnemy(state, sp.kind, area.x0 + sp.x, area.y0 + sp.y);
    if (sp.aggro) aggro(state, e);
  }
  state.enemyHash.rebuild(state.enemies);
  for (const a of station.actions ?? []) {
    later.push({
      kind: 'action',
      tick: state.tick + Math.max(0, Math.round(a.at * SIM_HZ)),
      station: index,
      action: a.do,
      enemyKind: a.kind ?? '',
      area,
    });
  }
  lab.tasks.push(...later);
  lab.tasks.sort((a, b) => a.tick - b.tick);
  lab.runs++;
}

/** Runs every station. Returns how many ran. */
export function runAllStations(state: GameState, stations: readonly LabStation[] = labStations): number {
  for (let i = 0; i < stations.length; i++) runStation(state, i, stations);
  return stations.length;
}

/** Fires every scheduled task that is due. Called once per step, after the enemies moved. */
export function stepLab(state: GameState): void {
  const lab = state.lab;
  let n = 0;
  while (n < lab.tasks.length && lab.tasks[n]!.tick <= state.tick) n++;
  if (n === 0) return;
  const due = lab.tasks.splice(0, n);
  for (const t of due) {
    if (t.kind === 'element') applyTask(state, t);
    else runAction(state, t);
  }
}

function hashShape(h: Hasher, s: Footprint): void {
  h.string(s.kind).byte(0);
  switch (s.kind) {
    case 'circle':
      h.num(s.x).num(s.y).num(s.r);
      break;
    case 'line':
      h.num(s.x0).num(s.y0).num(s.x1).num(s.y1).num(s.width);
      break;
    case 'strip':
      h.num(s.x).num(s.y).num(s.dirX).num(s.dirY).num(s.length).num(s.width);
      break;
    case 'arc':
      h.num(s.x).num(s.y).num(s.dirX).num(s.dirY).num(s.r).num(s.halfAngleCos);
      break;
  }
}

/** Adds the lab's pending tasks to a state hash. */
export function hashLab(h: Hasher, lab: LabState): void {
  h.u32(lab.runs).u32(lab.tasks.length);
  for (const t of lab.tasks) {
    h.string(t.kind).byte(0).u32(t.tick).u32(t.station);
    if (t.kind === 'element') {
      h.string(t.element).byte(0).string(t.owner).byte(0).num(t.hitDamage);
      hashShape(h, t.shape);
    } else {
      h.string(t.action).byte(0).string(t.enemyKind).byte(0);
      h.num(t.area.x0).num(t.area.y0).num(t.area.x1).num(t.area.y1);
    }
  }
}
