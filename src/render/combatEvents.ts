import { PLAYER_ID, type GameState, type SimEvent } from '../sim';
import { enemies as enemyDefs } from '../../data/enemies';
import type { AilmentFx } from './ailmentFx';
import { FX, SHAKE } from './combatPalette';
import type { DamageNumbers } from './damageNumbers';
import { elementType } from './elementLook';
import type { FormLayer } from './forms/formLayer';
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
  forms: FormLayer;
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
 * Strike kills shake the screen: a 'death' right after a hit whose spellId is a Strike instance
 * spawned in the same batch. Spell forms go to FormLayer.
 */
export class CombatEvents {
  /** Strike instance ids spawned in this batch of events. */
  private readonly strikes = new Set<number>();

  constructor(private readonly d: CombatEventDeps) {}

  handle(events: readonly SimEvent[]): void {
    const { enemies, fx, ailments, forms, projectiles, player, numbers, telegraphs, shake } = this.d;
    const s = this.d.state();
    /** The last enemy hit came from a Strike instance (its kill shakes the screen). */
    let strikeHit = false;
    this.strikes.clear();
    for (const ev of events) {
      switch (ev.type) {
        case 'cast': {
          // The Strike swoosh comes from its spellSpawn (Echo, branches and triggers included);
          // ranged forms flash at the staff tip in the weave's element.
          if (ev.spell !== 'strike' && ev.spell !== 'swath') {
            const root = s.weaves.slots[ev.slot]?.program?.root;
            fx.castFlash(player.tip.x, player.tip.y, ev.dirX, ev.dirY, elementType(root?.elements[0]?.element));
          }
          break;
        }
        case 'spellSpawn':
          if (ev.form === 'strike') this.strikes.add(ev.id);
          forms.handle(ev);
          break;
        case 'spellEnd':
        case 'beamFire':
        case 'lobLand':
        case 'chainJump':
        case 'manaRefund':
        case 'triggerFired':
          forms.handle(ev);
          break;
        case 'castFailed':
          fx.castFizzle(player.tip.x, player.tip.y);
          break;
        case 'hit':
          if (ev.target === 'player') {
            player.hurt();
            fx.playerHurt(ev.x, ev.y);
            shake.kick(SHAKE.playerHurt);
            numbers.damage(-1, ev.x, ev.y, ev.amount, ev.crit, ev.damageType, true);
          } else {
            strikeHit = ev.spellId !== undefined && this.strikes.has(ev.spellId);
            if (ev.spellId !== undefined) forms.handle(ev);
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
          if (strikeHit && ev.cause === 'hit') shake.kick(SHAKE.strikeKill);
          break;
        case 'dot':
          // Batched damage over time: its own small slanted numbers, no flash, sparks or shake.
          numbers.dot(ev.x, ev.y, ev.amount, ev.damageType, ev.target === 'player');
          break;
        case 'hitstop':
          break;
        case 'projectileEnd':
          fx.projectileEnd(ev.x, ev.y, ENEMY_SHOTS.has(ev.kind), ev.reason, projectiles.elementOf(ev.id) ?? 'fire');
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
          break;
        }
        case 'evaded':
          fx.evaded(ev.x, ev.y);
          numbers.label(ev.x, ev.y - 0.5, 'evaded', FX.evade);
          break;
        case 'playerDeath':
          fx.playerDeath(ev.x, ev.y);
          break;
        case 'playerRespawn':
          fx.playerRespawn(ev.x, ev.y);
          break;
        case 'enemySpawn':
          fx.spawnPuff(ev.x, ev.y);
          break;
        case 'attack':
          telegraphs.attack(s, ev.id);
          enemies.view(ev.id)?.attacked();
          break;
        default:
      }
    }
  }
}
