/**
 * Elements reaching puzzle objects. applyElement (grid/paint.ts) calls `elementOnObjects` with
 * the cells of every footprint, so whatever paints the grid (spells, enemy attacks, explosions,
 * the lab) also reaches objects:
 * - Fire lights braziers (rule-wise a brazier is a metal grid cell; M3 gives it no fire
 *   behavior, so being lit is object state) and melts ice blocks into shallow water.
 * - Storm powers conduit switches. Charge that reaches a switch through metal or water is
 *   checked each tick in stepSwitches.
 */
import { MAT } from '../../../data/materials';
import { TILE_CELLS } from '../core/constants';
import { emit } from '../events';
import type { GameState } from '../state';
import type { TerrainElement } from '../grid/paint';
import { objectCenter, type WorldObject } from './objects';
import { forTileCells, sendNote, setTileGround } from './objectGround';
import { brazierSeconds } from './objectLinks';

/** Called by paintElement with the footprint's cells (shared scratch: read, don't keep). */
export function elementOnObjects(
  state: GameState,
  element: TerrainElement,
  cells: Int32Array,
  n: number,
): void {
  if (state.objects.length === 0 || (element !== 'fire' && element !== 'storm')) return;
  const g = state.grid;
  const w = g.width;
  for (let k = 0; k < n; k++) {
    const i = cells[k]!;
    const code = g.ground[i];
    if (code !== MAT.brazier && code !== MAT.object) continue;
    const cx = i % w;
    const tx = Math.floor(cx / TILE_CELLS);
    const ty = Math.floor((i - cx) / w / TILE_CELLS);
    for (const o of state.objects) {
      if (o.tx !== tx || o.ty !== ty) continue;
      if (element === 'fire') {
        if (o.kind === 'brazier') lightBrazier(state, o);
        else if (o.kind === 'ice_block' && !o.on) meltIceBlock(state, o);
      } else if (o.kind === 'conduit_switch') powerSwitch(state, o);
    }
  }
}

export function lightBrazier(state: GameState, o: WorldObject): void {
  if (o.on) return;
  o.on = true;
  o.timer = brazierSeconds(state.room.header);
  const c = objectCenter(o);
  emit(state, { type: 'brazierLit', key: o.key, x: c.x, y: c.y });
  sendNote(state, o);
}

export function powerSwitch(state: GameState, o: WorldObject): void {
  if (o.on) return;
  o.on = true;
  const c = objectCenter(o);
  emit(state, { type: 'switchPowered', key: o.key, x: c.x, y: c.y });
  sendNote(state, o);
}

/** Fire on an ice block: it becomes shallow water where it stands (and stops moving). */
export function meltIceBlock(state: GameState, o: WorldObject): void {
  o.on = true;
  o.timer = 0;
  o.vx = o.vy = 0;
  o.push = 0;
  o.pushDir = 0;
  setTileGround(state, o.tx, o.ty, MAT.shallow_water, MAT.shallow_water);
  const c = objectCenter(o);
  emit(state, { type: 'iceBlockMelted', key: o.key, x: c.x, y: c.y });
  sendNote(state, o);
}

/** A switch is powered when any cell touching its tile carries charge (metal or water next to it). */
export function stepSwitches(state: GameState): void {
  const g = state.grid;
  for (const o of state.objects) {
    if (o.kind !== 'conduit_switch' || o.on) continue;
    let charged = false;
    const x0 = o.tx * TILE_CELLS - 1;
    const y0 = o.ty * TILE_CELLS - 1;
    for (let y = y0; y <= y0 + TILE_CELLS + 1 && !charged; y++) {
      if (y < 0 || y >= g.height) continue;
      for (let x = x0; x <= x0 + TILE_CELLS + 1; x++) {
        if (x < 0 || x >= g.width) continue;
        if (g.charge[y * g.width + x]! > 0) {
          charged = true;
          break;
        }
      }
    }
    if (!charged) forTileCells(state, o.tx, o.ty, (i) => (charged ||= g.charge[i]! > 0));
    if (charged) powerSwitch(state, o);
  }
}
