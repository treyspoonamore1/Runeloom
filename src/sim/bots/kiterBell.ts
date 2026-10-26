/**
 * Old Bellwether tactics for the kiter bot (bots/kiter.ts via bots/kiterFen.ts), M8 (CONTENT §5,
 * §13.2), as a sensible player fights it. A pure function of the state.
 * - Its toll ring: step out of the 18 cells while it winds up; if that can't be done in time, dodge
 *   through the front as it passes (fenWaveSoon); its circle telegraph alone isn't a threat.
 * - Shelled: stand on dry ground with metal or water bellReach cells toward it, so it stops on
 *   conducting ground to Snap and the Storm Bolt (kiterFen.ts fenBossShot) can ring it there.
 */
import { attackByName } from '../../../data/enemies';
import { materialByCode } from '../../../data/materials';
import type { Enemy } from '../actors/enemies';
import type { GameState } from '../state';
import type { Goal } from './kiterFen';

/** Bot heuristics for the Bellwether. Distances in cells. */
export const bellBotConfig = {
  /** Step this far beyond a toll ring's reach. */
  waveMargin: 3,
  /** Where it stands to Snap the bot, cells from the bot (its reach plus both bodies). */
  bellReach: 9,
};
const F = bellBotConfig;

/** The Bellwether's toll ring is winding up or expanding. */
function waveOn(boss: Enemy): boolean {
  const a = boss.attack;
  return a.name === 'toll_ring' && (a.phase === 'windup' || (a.phase === 'active' && boss.boss!.fen!.waveR > 0));
}

/** A toll ring's telegraph: the bot steps out of it or dodges its front (fenWaveSoon), not its circle. */
export function fenWaveTelegraph(e: Enemy): boolean {
  return e.boss?.fen != null && e.attack.phase === 'windup' && e.attack.name === 'toll_ring';
}

/** True when a toll ring's front reaches the player's body within `within` s (time to dodge). */
export function fenWaveSoon(state: GameState, boss: Enemy | null, within: number): boolean {
  if (boss === null || boss.boss?.fen == null || !waveOn(boss)) return false;
  const b = boss!;
  const a = b.attack;
  const def = attackByName(b.kind, 'toll_ring');
  if (!def || def.shape.kind !== 'circle' || !def.wave) return false;
  const p = state.player;
  const R = def.shape.r;
  const d = Math.sqrt((p.x - a.originX) ** 2 + (p.y - a.originY) ** 2);
  const near = d - state.tuning.player.radius - def.wave.width / 2;
  if (near > R) return false;
  const speed = R / def.active;
  const t = a.phase === 'windup' ? a.timeLeft + Math.max(0, near) / speed : (near - b.boss!.fen!.waveR) / speed;
  return t >= -0.02 && t <= within;
}

/**
 * The Bellwether: step out of a toll ring's reach while it winds up or expands. Shelled, stand on
 * dry ground with metal or water bellReach cells toward it, so it comes onto conducting ground to
 * reach the bot and can be rung there.
 */
export function bellGoal(state: GameState, b: Enemy, goal: Goal, search: number): boolean {
  if (!waveOn(b)) return b.special.openLeft <= 0 && ringSpot(state, b, goal, search);
  const def = attackByName(b.kind, 'toll_ring');
  if (!def || def.shape.kind !== 'circle') return false;
  const a = b.attack;
  const p = state.player;
  let ux = p.x - a.originX;
  let uy = p.y - a.originY;
  const d = Math.sqrt(ux * ux + uy * uy) || 1;
  ux /= d;
  uy /= d;
  const r = def.shape.r + state.tuning.player.radius + F.waveMargin;
  goal.on = true;
  goal.x = a.originX + ux * r;
  goal.y = a.originY + uy * r;
  return true;
}

/**
 * The dry cell nearest the player, at least bellReach from the bell, from which the cells bellReach
 * and bellReach + 3 toward the bell conduct: where it stops to Snap, it stands on metal or water.
 */
function ringSpot(state: GameState, b: Enemy, goal: Goal, R: number): boolean {
  const g = state.grid;
  const p = state.player;
  const cx = Math.floor(p.x);
  const cy = Math.floor(p.y);
  const conducts = (x: number, y: number): boolean => {
    const xx = Math.floor(x);
    const yy = Math.floor(y);
    if (xx < 0 || yy < 0 || xx >= g.width || yy >= g.height) return false;
    return materialByCode[g.ground[yy * g.width + xx]!]!.conducts !== 'none';
  };
  let best = Infinity;
  for (let y = Math.max(1, cy - R); y <= Math.min(g.height - 2, cy + R); y += 2)
    for (let x = Math.max(1, cx - R); x <= Math.min(g.width - 2, cx + R); x += 2) {
      const i = y * g.width + x;
      if (state.room.solid[i] === 1 || conducts(x + 0.5, y + 0.5)) continue;
      const dx = b.x - (x + 0.5);
      const dy = b.y - (y + 0.5);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < F.bellReach) continue;
      const ux = dx / d;
      const uy = dy / d;
      const r0 = F.bellReach;
      const r1 = F.bellReach + 3;
      if (!conducts(x + 0.5 + ux * r0, y + 0.5 + uy * r0) || !conducts(x + 0.5 + ux * r1, y + 0.5 + uy * r1))
        continue;
      const d2 = (x + 0.5 - p.x) ** 2 + (y + 0.5 - p.y) ** 2;
      if (d2 < best) {
        best = d2;
        goal.x = x + 0.5;
        goal.y = y + 0.5;
      }
    }
  if (best === Infinity) return false;
  goal.on = true;
  return true;
}
