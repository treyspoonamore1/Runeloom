import { enemyDef } from '../../../data/enemies';
import type { Enemy } from '../actors/enemies';
import { DT } from '../core/constants';
import type { GameState } from '../state';
import { aggro, deaggro, measurePlayer, refreshSight, setMode, sightDue, stop, toPlayer } from './common';
import { buildFlowField, tileAt } from './flowField';
import { stepKite } from './kite';
import { stepShield } from './shield';
import { stepSwarm } from './swarm';

export { aggro } from './common';

/**
 * Once per tick, after the player moves and before enemies think: rebuilds the flow field toward
 * the player when they entered a new tile or `flowRecomputeTicks` passed (skipped with no
 * enemies, while the player is dead, or with AI off).
 */
export function prepareEnemyAI(state: GameState): void {
  if (state.cheats.noAI || state.player.dead || state.enemies.length === 0) return;
  const f = state.flow;
  const goal = tileAt(f, state.player.x, state.player.y);
  if (goal !== f.goalTile || state.tick - f.builtTick >= state.tuning.ai.flowRecomputeTicks)
    buildFlowField(f, goal, state.tick);
}

/**
 * Enemy decision hook, called once per tick for every live enemy, in array order, before its
 * attack timers advance and before anyone moves (actors/enemyMovement.ts).
 *
 * The state machine (`enemy.ai.mode`, human-readable for the AI-targets overlay):
 * - 'idle': stands still until the player is within aggroRange with line of sight, or it is hurt
 *   (in arena mode: aggroes at once).
 * - aggroed ('chase', 'hold', 'kite', 'retreat', 'reposition'): the kind's behavior (swarm.ts,
 *   shield.ts, kite.ts) picks a velocity and facing and starts attacks with startEnemyAttack.
 *   Beyond tuning.ai.leashRange it gives up and goes idle.
 * - 'windup', 'attack', 'recover': mirror enemy.attack.phase; the enemy stands still and keeps
 *   its facing (attacks commit). After recover it goes straight back to its behavior.
 * The player being dead sends everyone idle. `state.cheats.noAI` freezes the AI entirely
 * (velocity and facing are left as they are), for tests that drive enemies by hand.
 *
 * Contract with the core: writes only `enemy.vx/vy` (at most enemyDef(kind).speed),
 * `enemy.facingX/facingY` (unit) and `enemy.ai`; randomness comes from `state.aiRng`.
 */
export function stepEnemyAI(state: GameState, e: Enemy): void {
  if (state.cheats.noAI) return;
  const def = enemyDef(e.kind);
  const b = def.behavior;
  if (b.kind === 'none' || !def.attack) return;
  const ai = e.ai;
  ai.timer += DT;
  ai.cooldown = ai.cooldown > DT ? ai.cooldown - DT : 0;

  const phase = e.attack.phase;
  if (phase !== 'none') {
    stop(e);
    setMode(e, phase === 'windup' ? 'windup' : phase === 'active' ? 'attack' : 'recover');
    return;
  }
  if (state.player.dead) {
    if (ai.mode !== 'idle') deaggro(e);
    return;
  }

  measurePlayer(state, e);
  if (ai.mode === 'idle') {
    // Arena enemies always hunt; elsewhere they need to see the player or be hurt.
    const alert = e.life < e.maxLife || state.mode === 'arena';
    if (!alert && toPlayer.dist > def.aggroRange) return;
    if (sightDue(state, e)) refreshSight(state, e);
    if (!alert && !ai.los) return;
    aggro(state, e);
  } else if (toPlayer.dist > state.tuning.ai.leashRange) {
    deaggro(e);
    return;
  } else if (sightDue(state, e)) {
    refreshSight(state, e);
  }

  switch (b.kind) {
    case 'swarm':
      stepSwarm(state, e, b, def.attack);
      break;
    case 'shield':
      stepShield(state, e, b, def.attack);
      break;
    case 'kite':
      stepKite(state, e, b, def.attack, def);
      break;
  }
}
