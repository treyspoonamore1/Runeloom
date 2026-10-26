import { aggro, applyHit, makePacket, PLAYER_ID, type Enemy, type GameState } from '../../../src/sim';
import { fromFile, place } from './helpers';

/** The Glass Eye (test/boss_coil) with the player at (px, py), god mode, the Coil aggroed. */
export function eye(px = 62, py = 84): { s: GameState; c: Enemy } {
  const s = fromFile('test/boss_coil');
  place(s, px, py);
  s.cheats.god = true;
  const c = s.enemies.find((e) => e.kind === 'glasswater_coil')!;
  aggro(s, c);
  return { s, c };
}

/** Puts the Coil at (x, y), standing still, AI off. */
export function put(s: GameState, c: Enemy, x: number, y: number): void {
  s.cheats.noAI = true;
  c.x = c.prevX = x;
  c.y = c.prevY = y;
  c.vx = c.vy = 0;
}

/** A hit of `n` on the Coil; returns the life it lost. */
const physical = (s: GameState, n = 100) => makePacket(n, { physical: 1 }, 0, s.tuning.combat.critMultiplier);
export const hit = (s: GameState, c: Enemy, n = 100, type: 'physical' | 'storm' = 'physical') => {
  const life = c.life;
  const packet = type === 'physical' ? physical(s, n) : makePacket(n, { storm: 1 }, 0, 1.5);
  applyHit(s, c, packet, { sourceId: PLAYER_ID, dirX: 0, dirY: 0, knockback: 0 });
  return life - c.life;
};

