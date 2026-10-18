import type { Enemy } from '../actors/enemies';
import type { GameState } from '../state';

/**
 * Enemy decision hook, called once per tick for every live enemy, in array order, before its
 * attack timers advance and before anyone moves (actors/enemyMovement.ts). M1 core leaves it a
 * no-op: enemies stand still and never attack until the AI fills it in.
 *
 * Contract for the AI:
 * - Read anything. `state.enemyHash.queryCircle(x, y, r, out)` returns indices into
 *   `state.enemies` of live enemies touching a circle, at this tick's start positions.
 * - Write `enemy.vx/vy`: the velocity you want this tick (cells/s, at most enemyDef(kind).speed).
 *   Movement applies it through wall collision, plus separation and knockback. Don't write x/y
 *   or kbX/kbY.
 * - Write `enemy.facingX/facingY` (unit vector): the shield arc follows it.
 * - Own `enemy.ai` entirely (mode, timer, targetId, cooldown): nothing else touches it.
 * - Start attacks with `startEnemyAttack(state, enemy, dirX, dirY)` (combat/enemyAttacks.ts) when
 *   `enemy.attack.phase === 'none'`. The core runs windup → active (the hit) → recover. Use
 *   `attack.phase` to stop moving while winding up if the attack should commit.
 * - Randomness: fork your own stream from `state.rng` at creation (add it to GameState and
 *   hashState), so AI rolls don't shift crits or other systems.
 */
export function stepEnemyAI(_state: GameState, _enemy: Enemy): void {}
