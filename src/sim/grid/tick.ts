/**
 * The 20 Hz grid tick (DESIGN §6.1): visits the active cells in ascending index order and runs
 * their timers and fires.
 *
 * Per cell: smoke/steam, charge and wet count down; a burning cell rolls spread into each
 * ignitable 4-neighbor (rule 2, gridRng), smokes, dries mud (rule 23), melts ice under it (rule 5)
 * and burns fuel; at 0 fuel oil burns away (the material below may catch next), flammable
 * material becomes its burnt result (rule 3), an oil barrel explodes and placed fire goes out.
 * Frozen water counts down to thawing, an ice bridge through its cracking.
 *
 * Everything a cell does to OTHER cells (spread, dense smoke, explosions) is collected during the
 * visit and applied after it, so no cell sees a neighbor's change from the same grid tick and
 * the result doesn't depend on visiting order (only random rolls follow it).
 */
import { AIR, MAT, OWNER, SURFACE, materialByCode, materials, oil } from '../../../data/materials';
import { scaleByLevel } from '../combat/damage';
import { emit } from '../events';
import type { GameState } from '../state';
import { mergeAdded } from './active';
import {
  WORLD_SOURCE_ID,
  addToBatch,
  forBarrelTile,
  fx,
  gridTicks,
  ignitable,
  ignite,
  setAir,
  setGround,
  smokeTicks,
} from './cells';
import { tickChargeEvents } from './charge';
import { FIRE_SPECIAL, REVERTS, SMOKE, SMOKE_DENSE, SMOKE_NONE, SPREAD, smokeCode } from './matTables';
import { flushFx } from './fx';
import type { Grid } from './grid';
import { paintElement } from './paint';
import { spillOil } from './oil';
import { areaLevel } from './query';
import { fireSpreadMult } from '../hero/effectsTerrain';

/** A growable list of ints (pending cross-cell writes). */
interface IntList {
  a: Int32Array;
  len: number;
}

function newList(): IntList {
  return { a: new Int32Array(256), len: 0 };
}

function push(l: IntList, v: number): void {
  if (l.len === l.a.length) {
    const b = new Int32Array(l.a.length * 2);
    b.set(l.a);
    l.a = b;
  }
  l.a[l.len++] = v;
}

// Pending writes of the running grid tick: ignitions as (cell, owner) pairs, dense smoke sources,
// exploding barrel cells.
const ignitions = newList();
const denseSmoke = newList();
const explosions = newList();

/**
 * Rule 2 wind factor from cell `from` toward `to`. Constant (tuning.grid.windFactor) until Gale
 * (M8, rule 21) makes it directional; the hot loop in visitCells reads the constant directly, so
 * M8 replaces that read with a call here.
 */
export function windFactor(state: GameState, _from: number, _to: number): number {
  return state.tuning.grid.windFactor;
}

/** Advances the grid by one 20 Hz tick. Called from step() every GRID_EVERY non-hitstop ticks. */
export function stepGrid(state: GameState): void {
  const g = state.grid;
  g.tick++;
  g.blasts.length = 0;
  tickChargeEvents(g);
  const a = g.active;
  mergeAdded(a);
  ignitions.len = denseSmoke.len = explosions.len = 0;
  const len = a.len;
  visitCells(state);
  applyPending(state);
  if (len > 0) g.version++;
  flushFx(state);
}

/**
 * The hot loop over the active list (ascending order), compacting it in place to the cells that
 * stay busy. Rare cases (burning out, melting, drying, thawing) go to helper functions.
 */
function visitCells(state: GameState): void {
  const g = state.grid;
  const a = g.active;
  const { ground, surface, air, airTimer, fire, fuel, charge, wet, timer, owner } = g;
  const list = a.list;
  const flag = a.flag;
  const len = a.len;
  const width = g.width;
  const last = g.ground.length - width;
  const rng = state.gridRng;
  const spreadK = state.tuning.grid.windFactor * state.tuning.grid.spreadMult;
  // Fire you create spreads faster with passives (Kindler, Wildheart; hero/effectsTerrain.ts).
  const playerSpreadK = spreadK * fireSpreadMult(state);
  const oilChance = oil.spreadChance;
  const smokeT = smokeTicks();
  const oilSmoke = smokeCode(oil.smoke);
  let w = 0;
  for (let r = 0; r < len; r++) {
    const i = list[r]!;
    if (airTimer[i]! > 0 && --airTimer[i]! === 0) air[i] = AIR.none;
    if (charge[i]! > 0 && --charge[i]! === 0) {
      g.chargeId[i] = 0;
      g.chargeFalloff[i] = 0;
    }
    if (wet[i]! > 0) wet[i]!--;
    if (fire[i]! > 0) {
      // Rule 2: roll spread into each ignitable 4-neighbor (+x, −x, +y, −y).
      const x = i % width;
      const o = owner[i]!;
      // Inlined for speed; order +x, −x, +y, −y (fixed, so rolls are deterministic).
      for (let k = 0; k < 4; k++) {
        const j =
          k === 0
            ? x + 1 < width
              ? i + 1
              : -1
            : k === 1
              ? x > 0
                ? i - 1
                : -1
              : k === 2
                ? i < last
                  ? i + width
                  : -1
                : i - width;
        if (j < 0 || fire[j]! > 0 || wet[j]! > 0) continue;
        const p = surface[j] === SURFACE.oil ? oilChance : SPREAD[ground[j]!]!;
        if (p > 0 && rng.float() < p * (o === OWNER.player ? playerSpreadK : spreadK)) {
          push(ignitions, j);
          push(ignitions, o);
        }
      }
      const oilBurning = surface[i] === SURFACE.oil;
      const smoke = oilBurning ? oilSmoke : SMOKE[ground[i]!]!;
      if (smoke !== SMOKE_NONE) {
        air[i] = AIR.smoke;
        airTimer[i] = smokeT;
        if (smoke === SMOKE_DENSE) push(denseSmoke, i);
      }
      if (FIRE_SPECIAL[ground[i]!] === 1) fireOnSpecial(state, i);
      if (fuel[i]! > 0) fuel[i]!--;
      if (fuel[i] === 0) burnOut(state, i, oilBurning);
    }
    if (timer[i]! > 0 && REVERTS[ground[i]!] === 1) timerTick(state, i);
    if (
      fire[i]! > 0 ||
      charge[i]! > 0 ||
      airTimer[i]! > 0 ||
      wet[i]! > 0 ||
      (timer[i]! > 0 && REVERTS[ground[i]!] === 1)
    )
      list[w++] = i;
    else flag[i] = 0;
  }
  a.len = w;
}

/** True while cell i has anything for the grid tick to do. */
export function busy(g: Grid, i: number): boolean {
  if (g.fire[i]! > 0 || g.charge[i]! > 0 || g.airTimer[i]! > 0 || g.wet[i]! > 0) return true;
  return g.timer[i]! > 0 && REVERTS[g.ground[i]!] === 1;
}

/** Fire burning on ice (rule 5: it melts) or mud (rule 23: 1 s of fire dries it). */
function fireOnSpecial(state: GameState, i: number): void {
  const g = state.grid;
  let def = materialByCode[g.ground[i]!]!;
  if (def.fireTo !== undefined) {
    setGround(state, i, MAT[def.fireTo]);
    def = materialByCode[g.ground[i]!]!;
  }
  if (def.driesAfter !== undefined && def.driesTo !== undefined) {
    // The material timer counts burning ticks on mud.
    if (++g.timer[i]! >= gridTicks(def.driesAfter)) setGround(state, i, MAT[def.driesTo]);
  }
}

function burnOut(state: GameState, i: number, oilBurning: boolean): void {
  const g = state.grid;
  g.fire[i] = 0;
  addToBatch(fx.burntOut, g, i);
  if (oilBurning) {
    // The oil is gone; flammable ground under it catches from it.
    g.surface[i] = SURFACE.none;
    if (ignitable(g, i)) ignite(state, i, g.owner[i]!, 1);
    return;
  }
  const flam = materialByCode[g.ground[i]!]!.flammable;
  if (flam === null) return; // Placed fire (rule 26) leaves the ground as it was.
  if (flam.explodeAfter !== undefined) {
    push(explosions, i);
    return;
  }
  // Rule 3.
  setGround(state, i, flam.burntTo === 'under' ? g.under[i]! : MAT[flam.burntTo]);
}

function timerTick(state: GameState, i: number): void {
  const g = state.grid;
  const def = materialByCode[g.ground[i]!]!;
  if (def.revertsToUnder === true) {
    // Temporary water (grid/tempWater.ts) dries back into the ground it covered.
    if (--g.timer[i]! === 0) setGround(state, i, g.under[i]!);
    return;
  }
  if (def.revertSeconds === undefined || def.fireTo === undefined) return;
  const t = --g.timer[i]!;
  const crack = def.crackSeconds !== undefined ? gridTicks(def.crackSeconds) : 0;
  if (crack > 0 && t === crack) addToBatch(fx.iceBreaking, g, i);
  if (t > 0) return;
  setGround(state, i, MAT[def.fireTo]);
  if (crack > 0) addToBatch(fx.iceBroke, g, i);
}

function applyPending(state: GameState): void {
  const g = state.grid;
  for (let k = 0; k < explosions.len; k++) explode(state, explosions.a[k]!);
  for (let k = 0; k < ignitions.len; k += 2) ignite(state, ignitions.a[k]!, ignitions.a[k + 1]!, 1);
  const ticks = smokeTicks();
  const r = state.tuning.grid.denseSmokeRadius;
  const w = g.width;
  for (let k = 0; k < denseSmoke.len; k++) {
    const i = denseSmoke.a[k]!;
    const x = i % w;
    const y = (i - x) / w;
    for (let dy = -r; dy <= r; dy++) {
      const ry = r - Math.abs(dy);
      for (let dx = -ry; dx <= ry; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if ((dx === 0 && dy === 0) || nx < 0 || ny < 0 || nx >= w || ny >= g.height) continue;
        const j = ny * w + nx;
        if (!materialByCode[g.ground[j]!]!.blocksShots) setAir(g, j, AIR.smoke, ticks);
      }
    }
  }
}

/**
 * An oil barrel's tile explodes (DESIGN §6.2): the barrel becomes its burnt material, oil spills
 * in explosion.oilRadius, then a world-owned fire burst of explosion.radius lights it (and
 * anything else that burns). Records a Blast for the entity code and an 'explosion' event.
 */
function explode(state: GameState, i: number): void {
  const g = state.grid;
  if (g.ground[i] !== MAT.oil_barrel) return; // Another cell of the same barrel went first.
  const burntTo = materials.oil_barrel.flammable!.burntTo;
  let sx = 0;
  let sy = 0;
  let n = 0;
  forBarrelTile(g, i, (j) => {
    const x = j % g.width;
    sx += x + 0.5;
    sy += (j - x) / g.width + 0.5;
    n++;
    g.fire[j] = 0;
    g.fuel[j] = 0;
    setGround(state, j, burntTo === 'under' ? g.under[j]! : MAT[burntTo]);
  });
  const x = sx / n;
  const y = sy / n;
  const t = state.tuning.grid;
  const ex = t.explosion;
  spillOil(state, x, y, ex.oilRadius);
  paintElement(state, {
    element: 'fire',
    shape: { kind: 'circle', x, y, r: ex.radius },
    owner: OWNER.world,
    sourceId: WORLD_SOURCE_ID,
    hitDamage: 0,
    durationMult: 1,
  });
  const damage = scaleByLevel(ex.damage, state.tuning.combat.enemyDamageGrowth, areaLevel(state));
  g.blasts.push({ x, y, radius: ex.radius, damage, owner: OWNER.world, sourceId: WORLD_SOURCE_ID });
  emit(state, {
    type: 'explosion',
    x,
    y,
    radius: ex.radius,
    damage,
    owner: OWNER.world,
    sourceId: WORLD_SOURCE_ID,
  });
}
