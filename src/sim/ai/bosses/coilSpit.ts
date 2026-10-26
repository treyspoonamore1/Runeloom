/**
 * The Glasswater Coil's glass spit (CONTENT §5): the attack fires its projectile along the aim
 * line (combat/enemyAttacks.ts); landSpit makes it come down where the player stood as it fired,
 * unless it hits them first (its puddle: combat/projectileLand.ts). In phases 2–3 a volley follows,
 * coilVolley − 1 more spits coilVolleyGap s apart, each aimed at where the player is then. A
 * volley stops when it is Stranded, Iced or stunned.
 */
import { attackByName } from '../../../../data/enemies';
import type { Enemy } from '../../actors/enemies';
import { enemyAttackPacket } from '../../combat/enemyAttacks';
import { spawnProjectile, type Projectile } from '../../combat/projectiles';
import { DT } from '../../core/constants';
import type { GameState } from '../../state';

const TIME_EPSILON = 1e-9;
/** Shortest flight, seconds. */
const MIN_FLIGHT = 0.05;

/** The spit just fired: it lands where the player is; phases 2–3 start the volley. */
export function landSpit(state: GameState, e: Enemy): void {
  let shot: Projectile | null = null;
  for (let k = state.projectiles.length - 1; k >= 0; k--)
    if (state.projectiles[k]!.ownerId === e.id && !state.projectiles[k]!.ended) {
      shot = state.projectiles[k]!;
      break;
    }
  if (shot) aimFlight(state, shot);
  const f = e.boss!.fen!;
  if (e.boss!.phase < 2) return;
  f.volleyLeft = state.tuning.bosses.coilVolley - 1;
  f.volleyTimer = state.tuning.bosses.coilVolleyGap;
}

/** Shortens a spit's flight so it comes down at the player's distance (at most its def's life). */
function aimFlight(state: GameState, p: Projectile): void {
  const pl = state.player;
  const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  if (speed <= 0) return;
  const d = Math.sqrt((pl.x - p.x) ** 2 + (pl.y - p.y) ** 2);
  p.lifeLeft = Math.max(MIN_FLIGHT, Math.min(p.lifeLeft, d / speed));
}

/** One tick of a running volley (from the Coil's passive). */
export function stepVolley(state: GameState, e: Enemy): void {
  const f = e.boss!.fen!;
  if (f.volleyLeft <= 0) return;
  const s = e.special;
  if (s.stranded || s.trapped || e.terrain.stunLeft > 0 || e.dead || state.player.dead) {
    f.volleyLeft = 0;
    return;
  }
  f.volleyTimer -= DT;
  if (f.volleyTimer > TIME_EPSILON) return;
  f.volleyTimer += state.tuning.bosses.coilVolleyGap;
  f.volleyLeft--;
  const def = attackByName(e.kind, 'glass_spit');
  if (!def?.projectile) return;
  const p = state.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= 0) return;
  e.facingX = dx / d;
  e.facingY = dy / d;
  const shot = spawnProjectile(state, {
    team: 'enemy',
    ownerId: e.id,
    x: e.x,
    y: e.y,
    dirX: dx / d,
    dirY: dy / d,
    def: def.projectile,
    damage: enemyAttackPacket(state, e, def),
    knockback: def.knockback,
  });
  aimFlight(state, shot);
}
