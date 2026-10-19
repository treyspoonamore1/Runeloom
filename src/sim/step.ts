import type { InputFrame } from './core/input';
import type { GameState } from './state';
import { DT, GRID_EVERY } from './core/constants';
import { stepPlayer } from './actors/player';
import { stepEnemies } from './actors/enemyMovement';
import { compactEnemies } from './actors/enemies';
import { compactSpells, holdSpells, stepSpells } from './weave/runtime/step';
import { stepWeaves } from './weave/runtime/triggers';
import { compactProjectiles, stepProjectiles } from './combat/projectiles';
import { prepareEnemyAI } from './ai';
import { stepArena } from './world/waves';
import { stepLab } from './world/lab';
import { stepAilments } from './combat/ailmentTick';
import { stepGrid } from './grid/tick';
import { stepEntityTerrain } from './actors/terrain';
import { applyBlasts } from './actors/blasts';

/** Hitstop timers within this many seconds of zero count as expired (absorbs 1/60 rounding). */
const TIME_EPSILON = 1e-9;

/**
 * Advances the simulation by one fixed 60 Hz tick. The only way sim state changes.
 * Replays, bots, tests and the app loop all call this.
 *
 * Order: clear events → (hitstop: count down, freeze, stop) → player (vitals, dodge, walk,
 * knockback) → AI flow field → enemies (AI, attacks, separation, movement, knockback) → triggers
 * (Cast flow, Pulse, queued events; spells see the moved enemies) → spell instances (Echo
 * repeats, then every instance in spawn order) → enemy projectiles → entity terrain (Wet, Oiled,
 * burning ground, charge, falls, trails, Blind; actors/terrain.ts) → ailments (ignite damage,
 * decay, timers) → arena (count kills, spawn, waves) → Chemistry Lab scripts → remove dead enemies,
 * ended projectiles and spells → chemistry grid (every 3rd non-hitstop tick, 20 Hz; grid/tick.ts),
 * then that grid tick's explosions hit entities (actors/blasts.ts).
 */
export function step(state: GameState, input: InputFrame): void {
  state.tick++;
  state.events.length = 0;
  if (state.hitstopLeft > 0) {
    stepHitstop(state);
    state.prevButtons = input.buttons;
    return;
  }
  stepPlayer(state, input);
  prepareEnemyAI(state);
  stepEnemies(state);
  stepWeaves(state, input);
  stepSpells(state);
  stepProjectiles(state);
  stepEntityTerrain(state);
  stepAilments(state);
  stepArena(state);
  stepLab(state);
  compactEnemies(state);
  compactProjectiles(state);
  compactSpells(state);
  // The grid ticks every GRID_EVERY non-hitstop ticks (its own clock: hitstop never desyncs it).
  if (++state.grid.clock >= GRID_EVERY) {
    state.grid.clock = 0;
    stepGrid(state);
    applyBlasts(state);
  }
  state.prevButtons = input.buttons;
}

/**
 * A hitstop tick: nothing moves and no timer runs. prev positions are set to the current ones so
 * render interpolation holds still instead of replaying the last tick's motion.
 */
function stepHitstop(state: GameState): void {
  state.hitstopLeft = state.hitstopLeft > DT + TIME_EPSILON ? state.hitstopLeft - DT : 0;
  const p = state.player;
  p.prevX = p.x;
  p.prevY = p.y;
  for (const e of state.enemies) {
    e.prevX = e.x;
    e.prevY = e.y;
  }
  for (const pr of state.projectiles) {
    pr.prevX = pr.x;
    pr.prevY = pr.y;
  }
  holdSpells(state);
}
