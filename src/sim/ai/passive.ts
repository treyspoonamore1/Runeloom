/**
 * What M4 enemies do every tick whatever their state, frozen or not, before they think
 * (actors/enemyMovement.ts): their chemistry and boss bookkeeping.
 * - Always Wet (Bog Lurker): Wet is topped up wherever it is.
 * - Swimmers: trapped while their water is frozen, free when it thaws ('lurkerTrapped'); being
 *   trapped cancels a windup and stops a lunge. M8: Stranded when their cell stops being water
 *   any other way (rule 31, actors/strand.ts).
 * - M8 Fen chemistry (actors/fenChemistry.ts): Copperback charge, Slagshell heat, Bellshell
 *   ring timers, Sparkfly lure timers, Mirebull bogging.
 * - Oil trail (Tar Hulk): oil on the cells around its center whenever it enters a new
 *   cell (combat/oil.ts).
 * - Fuse (Tar Hulk): Ignited while Oiled lights a fuse ('hulkFuse'); Wet puts it out
 *   ('hulkFuseOut'); when it runs out the Hulk explodes and dies (actors/hulkBlast.ts).
 * - Flare (Tar Matriarch): the Hulk's fuse, but she lives through the burst (bosses/flare.ts).
 * - Bosses: phases, Superheat, the brazier storm (bosses/phases.ts).
 */
import { enemyDef, type EnemyChemistry } from '../../../data/enemies';
import type { Enemy } from '../actors/enemies';
import { explodeHulk } from '../actors/hulkBlast';
import { traitsOf } from '../actors/locomotion';
import { stepSwimmer } from '../actors/strand';
import { stepFenPassive } from '../actors/fenChemistry';
import { isOiled } from '../actors/terrainState';
import { isIgnited } from '../combat/ailments';
import { spillOil } from '../combat/oil';
import { DT } from '../core/constants';
import { emit } from '../events';
import type { GameState } from '../state';
import { stepFlare } from './bosses/flare';
import { stepBossPassive } from './bosses/phases';

const TIME_EPSILON = 1e-9;

export function stepEnemyPassive(state: GameState, e: Enemy): void {
  const t = traitsOf(e.kind);
  if (!t.passive) return;
  const def = enemyDef(e.kind);
  const chem = def.chemistry;
  if (chem !== undefined) {
    if (chem.alwaysWet) keepWet(state, e);
    if (chem.oilTrailRadius !== undefined) oilTrail(state, e, chem.oilTrailRadius);
    if (chem.explodes !== undefined) stepFuse(state, e, chem.explodes);
    if (chem.flare !== undefined) stepFlare(state, e, chem.flare);
    if (e.dead) return;
  }
  stepFenPassive(state, e, def);
  if (t.swims && !e.dead) stepSwimmer(state, e);
  if (e.dead) return;
  if (e.boss !== null) stepBossPassive(state, e);
}

function keepWet(state: GameState, e: Enemy): void {
  const ts = e.terrain;
  if (ts.wetLeft <= 0) emit(state, { type: 'wetChanged', target: e.id, wet: true, x: e.x, y: e.y });
  ts.wetLeft = state.tuning.terrain.wetSeconds;
}

function oilTrail(state: GameState, e: Enemy, r: number): void {
  const g = state.grid;
  const i = Math.floor(e.y) * g.width + Math.floor(e.x);
  if (i === e.special.trailCell) return;
  e.special.trailCell = i;
  spillOil(state, e.x, e.y, r);
}

function stepFuse(state: GameState, e: Enemy, ex: NonNullable<EnemyChemistry['explodes']>): void {
  const s = e.special;
  const ignited = isIgnited(e);
  if (s.fuseLeft > 0) {
    if (!ignited) {
      s.fuseLeft = 0;
      emit(state, { type: 'hulkFuseOut', id: e.id, x: e.x, y: e.y });
      return;
    }
    s.fuseLeft -= DT;
    if (s.fuseLeft <= TIME_EPSILON) explodeHulk(state, e, true);
    return;
  }
  if (ignited && isOiled(e)) {
    s.fuseLeft = ex.fuse;
    emit(state, { type: 'hulkFuse', id: e.id, fuse: ex.fuse, x: e.x, y: e.y });
  }
}
