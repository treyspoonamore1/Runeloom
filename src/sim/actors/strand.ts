/**
 * Rule 31, Stranded (M8, DESIGN §6.3, §6.4): a swimmer whose cell stops being water (borrowed
 * water returning, a Glasspike landing on the bank) is Stranded. It can't attack (the AI skips it;
 * a boss's own AI decides, the Coil can thrash) and takes tuning.swim.strandedTaken × damage.
 * After its crawl delay it crawls at its crawl speed toward the nearest water within
 * tuning.swim.crawlReach steps over open ground, and stops being Stranded once its cell is water
 * again. With no water in reach it dries out, losing dryLifePerSecond of its max life per second
 * (never bosses).
 *
 * Water that freezes under a swimmer traps it instead (the M4 Bog Lurker rule): it can't move or
 * act until the ice thaws. Ice that returns to dry ground under it (borrowed ice, rule 27)
 * strands it. Landing on ice from a leap strands it (CONTENT §5 Glasspike).
 *
 * Called every tick for every swimmer from ai/passive.ts (frozen or not, AI on or off), before
 * it thinks. Sets the crawl velocity; actors/enemyMovement.ts moves a Stranded swimmer over
 * anything shots cross.
 */
import { enemyDef } from '../../../data/enemies';
import { endDash } from '../combat/dash';
import { killEnemy } from '../combat/hits';
import { DT } from '../core/constants';
import { emit } from '../events';
import { WORLD_SOURCE_ID } from '../grid/cells';
import type { GameState } from '../state';
import type { Enemy } from './enemies';
import { isIceCell, isWaterCell } from './locomotion';
import { cellOf, headFor, routeStep, searchFrom, visited } from './swim';

export function isStranded(e: Enemy): boolean {
  return e.special.stranded;
}

/** True while a leaping swimmer is in the air (it reads no ground then). */
export function isAirborne(e: Enemy): boolean {
  return e.special.leapLeft > 0;
}

/** Damage-taken multiplier from rule 31. */
export function strandedTakenMult(state: GameState, e: Enemy): number {
  return e.special.stranded ? state.tuning.swim.strandedTaken : 1;
}

/** One tick of a swimmer's water state: trapped, Stranded, crawling, drying, recovering. */
export function stepSwimmer(state: GameState, e: Enemy): void {
  const s = e.special;
  if (s.leapLeft > 0) return;
  const i = cellOf(state, e.x, e.y);
  const g = state.grid;
  const water = i >= 0 && isWaterCell(g, i);
  if (s.stranded) {
    if (water) {
      endStrand(state, e);
      return;
    }
    s.strandTime += DT;
    crawl(state, e, i);
    return;
  }
  if (s.trapped) {
    if (water) setTrapped(state, e, false);
    else if (i < 0 || !isIceCell(g, i)) {
      setTrapped(state, e, false);
      strand(state, e);
    }
    return;
  }
  if (water) return;
  if (i >= 0 && isIceCell(g, i)) setTrapped(state, e, true);
  else strand(state, e);
}

/** Its water went away (or it landed on dry ground or ice): Stranded now. */
export function strand(state: GameState, e: Enemy): void {
  const s = e.special;
  if (s.stranded) return;
  s.stranded = true;
  s.strandTime = 0;
  s.drying = false;
  s.routeCell = -1;
  s.routeReplan = 0;
  s.submerged = false;
  stopActing(e);
  emit(state, { type: 'swimmerStranded', id: e.id, stranded: true, x: e.x, y: e.y });
}

function endStrand(state: GameState, e: Enemy): void {
  const s = e.special;
  s.stranded = false;
  s.strandTime = 0;
  s.routeCell = -1;
  s.routeReplan = 0;
  if (s.drying) {
    s.drying = false;
    emit(state, { type: 'swimmerDrying', id: e.id, drying: false, x: e.x, y: e.y });
  }
  e.vx = e.vy = 0;
  emit(state, { type: 'swimmerStranded', id: e.id, stranded: false, x: e.x, y: e.y });
}

/** The M4 trap (frozen water), with its 'lurkerTrapped' event. */
function setTrapped(state: GameState, e: Enemy, trapped: boolean): void {
  e.special.trapped = trapped;
  emit(state, { type: 'lurkerTrapped', id: e.id, trapped, x: e.x, y: e.y });
  if (trapped) stopActing(e);
}

/** Stops moving and loses an attack in windup or a running dash. */
function stopActing(e: Enemy): void {
  e.vx = e.vy = 0;
  endDash(e);
  if (e.attack.phase === 'windup') {
    e.attack.phase = 'none';
    e.attack.timeLeft = 0;
  }
}

/** After the crawl delay: head for the nearest water in reach, or dry out. */
function crawl(state: GameState, e: Enemy, here: number): void {
  const s = e.special;
  const T = state.tuning.swim;
  const own = enemyDef(e.kind).swimmer;
  const delay = own?.crawlDelay ?? T.crawlDelay;
  if (s.strandTime < delay || here < 0) {
    e.vx = e.vy = 0;
    return;
  }
  s.routeReplan--;
  if (s.routeReplan <= 0 || s.routeCell === here || (s.routeCell < 0 && !s.drying)) {
    s.routeReplan = T.repathTicks;
    planCrawl(state, e, here);
  }
  headFor(state, e, s.routeCell, own?.crawlSpeed ?? T.crawlSpeed);
  if (!s.drying || e.boss !== null) return;
  e.life -= e.maxLife * T.dryLifePerSecond * DT;
  if (e.life <= 0) killEnemy(state, e, WORLD_SOURCE_ID, 'dot');
}

/** The route to the nearest water by steps over open ground, within crawlReach; none: drying. */
function planCrawl(state: GameState, e: Enemy, here: number): void {
  const s = e.special;
  const T = state.tuning.swim;
  const g = state.grid;
  const reach = T.crawlReach;
  const side = 2 * reach + 1;
  const n = searchFrom(state, here, 'open', side * side, reach);
  let found = -1;
  for (let k = 1; k < n; k++) {
    const c = visited(k);
    if (isWaterCell(g, c)) {
      found = c;
      break;
    }
  }
  s.routeCell = found < 0 ? -1 : routeStep(found, T.lookahead);
  const drying = found < 0;
  if (drying === s.drying) return;
  s.drying = drying;
  emit(state, { type: 'swimmerDrying', id: e.id, drying, x: e.x, y: e.y });
}
