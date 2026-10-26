import type { EnemyDef } from '../../../data/enemies';
import type { Enemy } from '../actors/enemies';
import { attackSpeedMult } from '../actors/rarity';
import { isWaterAt } from '../actors/locomotion';
import { startEnemyAttack } from '../combat/enemyAttacks';
import type { GameState } from '../state';
import { setMode, stop, toPlayer } from './common';

/**
 * Counts down the kind's secondary-attack timers (EnemyAI.cooldowns[k] for extraAttacks[k]) by
 * `dt` seconds of the enemy's own time.
 */
export function tickExtraCooldowns(e: Enemy, def: EnemyDef, dt: number): void {
  const extra = def.extraAttacks;
  if (extra === undefined) return;
  const cds = e.ai.cooldowns;
  for (let k = 0; k < extra.length && k < cds.length; k++) {
    const c = cds[k]!;
    if (c > 0) cds[k] = c > dt ? c - dt : 0;
  }
}

/**
 * Secondary attacks with a cadence (AttackDef.every; the Frost Wisp's frost line): when one's
 * timer is up and the player is within its range with line of sight, it starts toward the
 * player, its timer restarts (÷ Hasted) and this returns true. The primary attack's cooldown is
 * untouched.
 */
export function tryEveryAttack(state: GameState, e: Enemy, def: EnemyDef): boolean {
  const extra = def.extraAttacks;
  if (extra === undefined || !e.ai.los) return false;
  const cds = e.ai.cooldowns;
  for (let k = 0; k < extra.length && k < cds.length; k++) {
    const a = extra[k]!;
    if (a.every === undefined || cds[k]! > 0 || toPlayer.gap > a.range) continue;
    // M8: the Spark Heron spits only at a dry player; targeted cadenced attacks aim at the player.
    const p = state.player;
    if (a.onlyDryTarget && isWaterAt(state, p.x, p.y)) continue;
    const aim = a.targeted ? { x: p.x, y: p.y } : undefined;
    if (!startEnemyAttack(state, e, toPlayer.ux, toPlayer.uy, a, aim)) return false;
    cds[k] = a.every / attackSpeedMult(e);
    stop(e);
    setMode(e, 'windup');
    return true;
  }
  return false;
}
