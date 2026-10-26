/**
 * Chemistry of the Glasswater Fen enemies (M8, CONTENT §5 "Chemistry"; data in data/enemiesFen.ts
 * EnemyChemistry). Per-tick passives (from ai/passive.ts, frozen or not) and the hooks the shared
 * combat and terrain code calls:
 * - conductorBody (Copperback): charge reaching it makes it Charged; Charged, it pulses enemy
 *   charge into what it stands on and its attacks add Storm. Freezing ends it.
 * - hotShell (Slagshell): Hot until Wet, then Cracked until dry for a while (actors/fenShells.ts).
 * - bell (Bellshell): shelled; charge of another team or the world rings it open (fenShells.ts).
 * - deathCharge (Sparkfly): dying over water pops enemy charge into it.
 * - gasbag (Bellows Toad): Fire hitting it while it inflates lights its marsh gas.
 * - charger (Mirebull): bogged in mud takes more damage (the charge itself: ai/charger.ts).
 */
import { enemyDef, type EnemyChemistry, type EnemyDef } from '../../../data/enemies';
import { OWNER, materialByCode } from '../../../data/materials';
import { isFrozen } from '../combat/ailments';
import { scaleByLevel, type HitResult } from '../combat/damage';
import { dealDirectDamage, killEnemy } from '../combat/hits';
import { WORLD_SOURCE_ID } from '../grid/cells';
import { DT } from '../core/constants';
import { emit } from '../events';
import { electrify } from '../grid/charge';
import type { ChargeEvent } from '../grid/grid';
import { applyElement } from '../grid/paint';
import type { GameState } from '../state';
import type { Enemy } from './enemies';
import type { EnemySpecial } from './enemyState';
import { fireBurst } from './hulkBlast';
import { isWaterCell } from './locomotion';
import { strandedTakenMult } from './strand';
import { cellOf } from './swim';
import { isWet } from './terrainState';
import { stepChargerPassive } from '../ai/charger';
import { bellTakenMult, ringBell, stepBell, stepHotShell, hotTakenMult } from './fenShells';

export { isHot } from './fenShells';

const TIME_EPSILON = 1e-9;

/** Starting chemistry state of a new enemy: a Slagshell starts Hot. */
export function initFenSpecial(s: EnemySpecial, def: EnemyDef): void {
  s.hot = def.chemistry?.hotShell !== undefined;
}

/** The Fen kinds' per-tick chemistry (swimmers' rule 31 is actors/strand.ts). */
export function stepFenPassive(state: GameState, e: Enemy, def: EnemyDef): void {
  const s = e.special;
  if (s.boggedLeft > 0) s.boggedLeft = s.boggedLeft > DT + TIME_EPSILON ? s.boggedLeft - DT : 0;
  if (def.behavior.kind === 'charger') stepChargerPassive(state, e, def.behavior);
  const c = def.chemistry;
  if (c === undefined) return;
  if (c.conductorBody !== undefined) stepConductor(state, e, c.conductorBody);
  if (c.hotShell !== undefined) stepHotShell(state, e, c.hotShell);
  if (c.bell !== undefined) stepBell(state, e, c.bell);
}

/** Every Fen damage-taken multiplier on `e`: Hot / Cracked, shelled / open, bogged, Stranded (rule 31). */
export function fenTakenMult(state: GameState, e: Enemy): number {
  const s = e.special;
  let m = strandedTakenMult(state, e);
  const c = enemyDef(e.kind).chemistry;
  if (c !== undefined) {
    if (c.hotShell !== undefined) m *= hotTakenMult(e, c.hotShell);
    if (c.bell !== undefined) m *= bellTakenMult(e, c.bell);
  }
  if (s.boggedLeft > 0) {
    const b = enemyDef(e.kind).behavior;
    if (b.kind === 'charger') m *= b.boggedTaken;
  }
  return m;
}

/** Walking speed multiplier from Fen chemistry: a Cracked Slagshell is slower. */
export function fenMoveMult(e: Enemy): number {
  const h = enemyDef(e.kind).chemistry?.hotShell;
  return h !== undefined && !e.special.hot ? h.crackedSpeed : 1;
}

/** True for kinds whose chemistry reacts to charge touching them (Copperback, Bellshell). */
export function touchesCharge(e: Enemy): boolean {
  const c = enemyDef(e.kind).chemistry;
  return c !== undefined && (c.conductorBody !== undefined || c.bell !== undefined);
}

/**
 * Charge event `ev` reached `e` through the water or metal under it (actors/terrain.ts, once per
 * event, whoever owns it): a Copperback becomes Charged (not from conductor bodies' own pulses),
 * a Bellshell rings (not from enemy charge).
 */
export function chargeTouched(state: GameState, e: Enemy, ev: Readonly<ChargeEvent>): void {
  const c = enemyDef(e.kind).chemistry;
  if (c === undefined) return;
  if (c.conductorBody !== undefined && !isConductorPulse(state, ev) && !isFrozen(e)) {
    const s = e.special;
    if (s.chargedLeft <= 0) {
      s.pulseLeft = c.conductorBody.pulseEvery;
      emit(state, {
        type: 'copperCharged',
        id: e.id,
        charged: true,
        seconds: c.conductorBody.seconds,
        x: e.x,
        y: e.y,
      });
    }
    s.chargedLeft = c.conductorBody.seconds;
  }
  if (c.bell !== undefined && ev.owner !== OWNER.enemy && ev.sourceId !== e.id) ringBell(state, e, c.bell);
}

/** A charge event a conductor body pulsed itself (it never charges conductor bodies, so two can't loop). */
function isConductorPulse(state: GameState, ev: Readonly<ChargeEvent>): boolean {
  if (ev.owner !== OWNER.enemy) return false;
  for (const o of state.enemies)
    if (o.id === ev.sourceId) return enemyDef(o.kind).chemistry?.conductorBody !== undefined;
  return false;
}

function stepConductor(state: GameState, e: Enemy, cb: NonNullable<EnemyChemistry['conductorBody']>): void {
  const s = e.special;
  if (s.chargedLeft <= 0) return;
  if (isFrozen(e)) {
    endCharged(state, e);
    return;
  }
  s.chargedLeft -= DT;
  if (s.chargedLeft <= TIME_EPSILON) {
    endCharged(state, e);
    return;
  }
  s.pulseLeft -= DT;
  if (s.pulseLeft > TIME_EPSILON) return;
  s.pulseLeft += cb.pulseEvery;
  const i = cellOf(state, e.x, e.y);
  if (i < 0 || materialByCode[state.grid.ground[i]!]!.conducts === 'none') return;
  const damage = scaleByLevel(cb.pulseDamage, state.tuning.combat.enemyDamageGrowth, e.areaLevel);
  emit(state, { type: 'copperPulse', id: e.id, damage, x: e.x, y: e.y });
  const w = state.grid.width;
  const x = i % w;
  applyElement(state, {
    element: 'storm',
    shape: { kind: 'circle', x: x + 0.5, y: (i - x) / w + 0.5, r: 0.1 },
    owner: OWNER.enemy,
    sourceId: e.id,
    hitDamage: damage,
    durationMult: 1,
  });
}

function endCharged(state: GameState, e: Enemy): void {
  e.special.chargedLeft = 0;
  e.special.pulseLeft = 0;
  emit(state, { type: 'copperCharged', id: e.id, charged: false, seconds: 0, x: e.x, y: e.y });
}

/** Storm (at area level 1) a Charged Copperback adds to its attacks; 0 otherwise. */
export function chargedAttackStorm(e: Enemy): number {
  if (e.special.chargedLeft <= 0) return 0;
  return enemyDef(e.kind).chemistry?.conductorBody?.attackStorm ?? 0;
}

/** A Sparkfly dying over water pops enemy charge into it (deathCharge), from actors/chemistry.ts deathTerrain. */
export function fenDeathTerrain(state: GameState, e: Enemy, killerId: number): void {
  const dc = enemyDef(e.kind).chemistry?.deathCharge;
  if (dc === undefined) return;
  e.special.popKiller = killerId;
  const i = cellOf(state, e.x, e.y);
  if (i < 0 || !isWaterCell(state.grid, i)) return;
  const damage = scaleByLevel(dc.damage, state.tuning.combat.enemyDamageGrowth, e.areaLevel);
  emit(state, { type: 'sparkflyPop', id: e.id, x: e.x, y: e.y, reach: dc.reach, damage });
  const water = state.tuning.grid.water;
  electrify(state, [i], 1, [], 0, {
    owner: OWNER.enemy,
    sourceId: e.id,
    hitDamage: damage,
    durationMult: dc.seconds / water.chargeSeconds,
    waterReach: { maxDistance: dc.reach, maxCells: water.maxCells },
  });
}

/**
 * Charge reached a Sparkfly from the water or metal under it (chargeFromBelow; actors/terrain.ts):
 * the player's or the world's charge, or another Sparkfly's pop, pops it at once (it dies, and
 * pops its own water in turn), so one Storm hit on the water pops a cloud over it in a chain.
 * Other enemy charge (a Copperback's pulse, a Spark Heron's strike) passes it by. A chain pop is
 * credited to whoever killed the Sparkfly that started it, while that one is still in the list.
 * Returns true if it was popped.
 */
export function popByCharge(state: GameState, e: Enemy, ev: Readonly<ChargeEvent>): boolean {
  if (enemyDef(e.kind).chemistry?.deathCharge === undefined) return false;
  let killer = ev.owner === OWNER.enemy ? -2 : ev.sourceId;
  if (killer === -2) {
    const src = state.enemies.find((o) => o.id === ev.sourceId);
    if (src === undefined || enemyDef(src.kind).chemistry?.deathCharge === undefined) {
      if (src !== undefined) return false;
      killer = WORLD_SOURCE_ID;
    } else killer = src.special.popKiller >= 0 ? src.special.popKiller : WORLD_SOURCE_ID;
  }
  killEnemy(state, e, killer, 'hit');
  return true;
}

/**
 * After a hit landed on a live enemy (combat/hits.ts): Fire during a Bellows Toad's inflated
 * croak lights its marsh gas (gasbag), unless it is Wet.
 */
export function afterFenHit(state: GameState, e: Enemy, res: HitResult, sourceId: number): void {
  const gb = enemyDef(e.kind).chemistry?.gasbag;
  if (gb === undefined || res.byType.fire <= 0 || isWet(e)) return;
  const a = e.attack;
  if (a.phase !== 'windup' || a.name !== gb.attack) return;
  a.phase = 'none';
  a.timeLeft = 0;
  e.terrain.stunLeft = gb.stun;
  e.vx = e.vy = 0;
  const damage = scaleByLevel(gb.damage, state.tuning.combat.enemyDamageGrowth, e.areaLevel);
  emit(state, { type: 'toadGasLit', id: e.id, x: e.x, y: e.y, radius: gb.radius, damage, stun: gb.stun });
  fireBurst(state, e, gb.radius, damage);
  if (!e.dead) dealDirectDamage(state, e, e.maxLife * gb.lifeLoss, sourceId);
}
