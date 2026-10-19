import { killPlayer } from '../actors/playerVitals';
import { DT } from '../core/constants';
import { emit } from '../events';
import type { GameState } from '../state';
import { AILMENT_EPSILON, asEnemy, isBoss, targetRef, type AilmentTarget } from './ailments';
import { killEnemy } from './hits';
import { isOiled } from '../actors/terrainState';
import { OWNER } from '../../../data/materials';

/**
 * The ailment phase of a tick, after every hit of the tick has landed (after projectiles) and
 * before the arena counts kills: for the live player, then live enemies in array order, Ignite
 * deals its damage, then Chill decays and the Freeze and Shock timers run down. Every timer
 * counts the tick it was applied on, so an ailment lasting d seconds acts on d × 60 ticks.
 */
export function stepAilments(state: GameState): void {
  const p = state.player;
  if (!p.dead) tickTarget(state, p);
  for (const e of state.enemies) if (!e.dead) tickTarget(state, e);
}

function tickTarget(state: GameState, t: AilmentTarget): void {
  const A = state.tuning.ailments;
  const a = t.ailments;
  if (a.ignite.timeLeft > 0 && tickIgnite(state, t)) return;

  if (a.chill > 0) {
    const decay = (isBoss(t) ? A.bossChillDecay : A.chillDecay) * DT;
    if (a.chill > decay + AILMENT_EPSILON) a.chill -= decay;
    else {
      a.chill = 0;
      emit(state, { type: 'ailmentEnded', target: targetRef(t), ailment: 'chill', x: t.x, y: t.y });
    }
  }

  const fz = a.freeze;
  if (fz.timeLeft > 0) {
    if (fz.timeLeft > DT + AILMENT_EPSILON) fz.timeLeft -= DT;
    else {
      fz.timeLeft = 0;
      if (isBoss(t)) fz.immuneLeft = A.bossFreezeImmunity;
      emit(state, { type: 'thaw', target: targetRef(t), x: t.x, y: t.y });
    }
  } else if (fz.immuneLeft > 0) {
    fz.immuneLeft = fz.immuneLeft > DT + AILMENT_EPSILON ? fz.immuneLeft - DT : 0;
  }

  const sh = a.shock;
  if (sh.timeLeft > 0) {
    if (sh.timeLeft > DT + AILMENT_EPSILON) sh.timeLeft -= DT;
    else {
      sh.timeLeft = 0;
      sh.effect = 0;
      emit(state, { type: 'ailmentEnded', target: targetRef(t), ailment: 'shock', x: t.x, y: t.y });
    }
  }
}

/**
 * One tick of Ignite: dps × DT × (1 + Shock) (× oiledIgniteMult while Oiled) fire damage (none on the player in god mode),
 * batched into 'dot' events. A kill is credited to the ignite's source. Returns true if the
 * target died.
 */
function tickIgnite(state: GameState, t: AilmentTarget): boolean {
  const A = state.tuning.ailments;
  const a = t.ailments;
  const ig = a.ignite;
  const dt = ig.timeLeft < DT ? ig.timeLeft : DT;
  const godPlayer = asEnemy(t) === null && state.cheats.god;
  if (!godPlayer) {
    // Rule 18: Ignite deals oiledIgniteMult × damage while Oiled.
    const oiled = isOiled(t) ? state.tuning.terrain.oiledIgniteMult : 1;
    const dmg = ig.dps * dt * (1 + a.shock.effect) * oiled;
    t.life -= dmg;
    a.dotPending += dmg;
  }
  const ended = ig.timeLeft <= DT + AILMENT_EPSILON;
  ig.timeLeft = ended ? 0 : ig.timeLeft - DT;
  const dying = t.life <= 0;
  a.dotReportLeft -= DT;
  if (ended || dying || a.dotReportLeft <= AILMENT_EPSILON) {
    flushDot(state, t, ig.sourceId);
    a.dotReportLeft += A.dotReportInterval;
  }
  const sourceId = ig.sourceId;
  if (ended) {
    ig.dps = 0;
    ig.sourceId = -1;
    ig.owner = OWNER.world;
    a.dotReportLeft = 0;
    emit(state, { type: 'ailmentEnded', target: targetRef(t), ailment: 'ignite', x: t.x, y: t.y });
  }
  if (!dying) return false;
  const e = asEnemy(t);
  if (e === null) {
    killPlayer(state);
    return true;
  }
  return killEnemy(state, e, sourceId, 'dot');
}

function flushDot(state: GameState, t: AilmentTarget, sourceId: number): void {
  const a = t.ailments;
  if (a.dotPending <= 0) return;
  emit(state, {
    type: 'dot',
    target: targetRef(t),
    sourceId,
    amount: a.dotPending,
    damageType: 'fire',
    x: t.x,
    y: t.y,
  });
  a.dotPending = 0;
}
