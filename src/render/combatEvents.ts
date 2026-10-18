import { PLAYER_ID, type GameState, type SimEvent } from '../sim';
import { enemies as enemyDefs } from '../../data/enemies';
import type { AilmentFx } from './ailmentFx';
import { FX, SHAKE } from './combatPalette';
import type { DamageNumbers } from './damageNumbers';
import { spellElement } from './elementLook';
import type { EnemyLayer } from './enemyLayer';
import type { FxView } from './fxView';
import type { PlayerView } from './playerView';
import type { ProjectileView } from './projectileView';
import type { Shake } from './shake';
import type { TelegraphView } from './telegraphView';

/** Projectile kinds fired by enemies (their impacts are never dimmed). */
const ENEMY_SHOTS = new Set<string>();
for (const d of Object.values(enemyDefs)) {
  const a = d.attack as { projectile?: { kind: string } } | null;
  if (a?.projectile) ENEMY_SHOTS.add(a.projectile.kind);
}

export interface CombatEventDeps {
  enemies: EnemyLayer;
  fx: FxView;
  ailments: AilmentFx;
  projectiles: ProjectileView;
  player: PlayerView;
  numbers: DamageNumbers;
  telegraphs: TelegraphView;
  shake: Shake;
  /** The state the events came from (the last one rendered or set). */
  state(): GameState;
}

/**
 * Turns one frame's sim events into hit flashes, particles, numbers and shake. Render-only:
 * reads the state for positions, never writes it.
 *
 * Strike kills shake the screen. Strike's hits are emitted right after its 'cast' event in the
 * same step, so a 'death' inside that run of hit/death/hitstop events is a Strike kill. (A
 * bolt killing something on the very tick a Strike lands would also count; rare and harmless.)
 */
export class CombatEvents {
  constructor(private readonly d: CombatEventDeps) {}

  handle(events: readonly SimEvent[]): void {
    const { enemies, fx, ailments, projectiles, player, numbers, telegraphs, shake } = this.d;
    const s = this.d.state();
    let strikeRun = false;
    for (const ev of events) {
      switch (ev.type) {
        case 'cast':
          if (ev.spell === 'strike') {
            fx.strike(ev.x, ev.y, ev.dirX, ev.dirY);
            strikeRun = true;
          } else {
            fx.castFlash(player.tip.x, player.tip.y, ev.dirX, ev.dirY, spellElement(ev.spell));
            strikeRun = false;
          }
          break;
        case 'castFailed':
          fx.castFizzle(player.tip.x, player.tip.y);
          strikeRun = false;
          break;
        case 'hit':
          if (ev.target === 'player') {
            player.hurt();
            fx.playerHurt(ev.x, ev.y);
            shake.kick(SHAKE.playerHurt);
            numbers.damage(-1, ev.x, ev.y, ev.amount, ev.crit, ev.damageType, true);
          } else {
            const v = enemies.view(ev.target);
            v?.hit(ev.kbX, ev.kbY, s.player.x, s.player.y, ev.damageType);
            fx.hitEnemy(ev.x, ev.y, v?.kind ?? '', ev.damageType, ev.crit, ev.kbX, ev.kbY);
            numbers.damage(ev.target, ev.x, ev.y, ev.amount, ev.crit, ev.damageType, false);
            if (ev.crit && ev.sourceId === PLAYER_ID) shake.kick(SHAKE.crit);
          }
          break;
        case 'death':
          if (ev.shattered) {
            // Frozen: burst into ice, no corpse (DESIGN §4 shakes on Shatter).
            ailments.shatter(ev.x, ev.y, ev.kind);
            enemies.view(ev.id)?.die(true);
            shake.kick(SHAKE.shatter);
          } else {
            fx.death(ev.x, ev.y, ev.kind);
            enemies.view(ev.id)?.die();
          }
          if (strikeRun) shake.kick(SHAKE.strikeKill);
          break;
        case 'dot':
          // Batched damage over time: its own small slanted numbers, no flash, sparks or shake.
          numbers.dot(ev.x, ev.y, ev.amount, ev.damageType, ev.target === 'player');
          break;
        case 'hitstop':
          break;
        case 'projectileEnd':
          fx.projectileEnd(ev.x, ev.y, ENEMY_SHOTS.has(ev.kind), ev.reason, projectiles.elementOf(ev.id) ?? 'fire');
          strikeRun = false;
          break;
        case 'shieldBlock': {
          const v = enemies.view(ev.id);
          let ax = 1;
          let ay = 0;
          if (v) {
            ax = ev.x - v.x;
            ay = ev.y - v.y;
            v.shieldBlock();
          }
          fx.shieldBlock(ev.x, ev.y, ax, ay);
          strikeRun = false;
          break;
        }
        case 'evaded':
          fx.evaded(ev.x, ev.y);
          numbers.label(ev.x, ev.y - 0.5, 'evaded', FX.evade);
          strikeRun = false;
          break;
        case 'playerDeath':
          fx.playerDeath(ev.x, ev.y);
          strikeRun = false;
          break;
        case 'playerRespawn':
          fx.playerRespawn(ev.x, ev.y);
          strikeRun = false;
          break;
        case 'enemySpawn':
          fx.spawnPuff(ev.x, ev.y);
          strikeRun = false;
          break;
        case 'attack':
          telegraphs.attack(s, ev.id);
          enemies.view(ev.id)?.attacked();
          strikeRun = false;
          break;
        default:
          strikeRun = false;
      }
    }
  }
}
