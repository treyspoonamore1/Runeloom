import type { InputFrame } from './core/input';
import type { GameState } from './state';
import { DT, GRID_EVERY } from './core/constants';
import { stepPlayer } from './actors/player';
import { stepEnemies } from './actors/enemyMovement';
import { compactEnemies } from './actors/enemies';
import { stepCasting } from './combat/casting';
import { compactProjectiles, stepProjectiles } from './combat/projectiles';
import { prepareEnemyAI } from './ai';
import { stepArena } from './world/waves';
import { stepAilments } from './combat/ailmentTick';

/** Hitstop timers within this many seconds of zero count as expired (absorbs 1/60 rounding). */
const TIME_EPSILON = 1e-9;

/**
 * Advances the simulation by one fixed 60 Hz tick. The only way sim state changes.
 * Replays, bots, tests and the app loop all call this.
 *
 * Order: clear events → (hitstop: count down, freeze, stop) → player (vitals, dodge, walk,
 * knockback) → AI flow field → enemies (AI, attacks, separation, movement, knockback) → casting
 * (spells see the moved enemies) → projectiles → ailments (ignite damage, decay, timers) → arena
 * (count kills, spawn, waves) → remove dead enemies and ended projectiles → grid (M3).
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
  stepCasting(state, input);
  stepProjectiles(state);
  stepAilments(state);
  stepArena(state);
  compactEnemies(state);
  compactProjectiles(state);
  if (state.tick % GRID_EVERY === 0) {
    // Chemistry grid tick (M3).
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
}
