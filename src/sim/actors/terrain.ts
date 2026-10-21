/**
 * The terrain phase of a tick (DESIGN §6.3 rules 11, 12, 15–18, 22, 25; §6.4 Wet, Oiled, Blind):
 * every live entity reads the cell under its center, after spells and projectiles painted the
 * grid and before ailments tick. Player first, then enemies in array order. Per entity:
 *
 * 1. Rule 25: the cell stopped being walkable under it → it falls (falling.ts). Otherwise a safe
 *    cell (one that can't drop away) records its position as the last safe spot.
 * 2. Rule 15: shallow water makes it Wet for wetSeconds (refreshed while in it); Wet puts out an
 *    Ignite. A Tinderling going out is stunned (CONTENT §5).
 * 3. Rule 17: oil makes it Oiled for oiledSeconds (refreshed while on it).
 * 4. Rule 16: a burning cell whose owner can hurt it ignites it at terrain-fire DPS (× its fire
 *    resistance; doubled on burning oil), refreshed while standing in it. Not while Wet (Ignite
 *    is blocked) or in i-frames. A Shieldbearer's shield burns while it burns or stands in fire.
 * 5. Rules 11, 12: a charged cell whose event hasn't hit it yet and whose owner can hurt it hits
 *    it for the event's damage × the cell's falloff, as Storm (so it Shocks, and arcs if Wet).
 * 6. Rules 22, 18: while burning, it lights the flammable cell under it (its igniter's team; an
 *    always-burning Tinderling: enemy-owned). Oiled and Ignited, every new cell it enters gets fire.
 * 7. Blind (enemies): smoke or steam on its cell or its target's.
 * Stun counts down here too.
 *
 * Passives (hero/effectsTerrain.ts): Hydromancer keeps the player Wet as if in water, Pyre
 * Walker makes the player ignore burning ground, Wildheart scales player-owned fire's ignite.
 */
import { AIR, OWNER, SURFACE, materialByCode } from '../../../data/materials';
import { makePacket } from '../combat/damage';
import { applyHit } from '../combat/hits';
import { applyIgnite, extinguish, isIgnited, targetRef, type AilmentTarget } from '../combat/ailments';
import { DT } from '../core/constants';
import { emit } from '../events';
import { ignitable } from '../grid/cells';
import { chargeEventInfo, hazardHurts, terrainFireDps } from '../grid/query';
import type { GameState } from '../state';
import { burningOwner, chemistryOf, fireOnCell, hazardSource } from './chemistry';
import type { Enemy } from './enemies';
import { fall, isSafeCell } from './falling';
import { isInvulnerable } from './player';
import { chargeSeen, rememberCharge } from './terrainState';
import { alwaysWet, immuneToTerrainFire, terrainFireDpsMult } from '../hero/effectsTerrain';
import { burningGroundHeal } from '../hero/uniques';
import { ignoresGround, locomotionOf } from './locomotion';

/** Timers within this of zero count as expired. */
const TIME_EPSILON = 1e-9;

export function stepEntityTerrain(state: GameState): void {
  const p = state.player;
  if (!p.dead) entityTerrain(state, p, OWNER.player);
  const g = state.grid;
  const pc = p.dead ? -1 : cellIndexAt(state, p.x, p.y);
  const playerHidden = pc >= 0 && g.air[pc] !== AIR.none;
  const list = state.enemies;
  for (let k = 0; k < list.length; k++) {
    const e = list[k]!;
    if (e.dead) continue;
    // M4: floating and fixed kinds (Frost Wisp, Brood Kiln) are above the ground's effects.
    if (!ignoresGround(e.kind)) entityTerrain(state, e, OWNER.enemy);
    if (!e.dead) stepEnemyExtras(state, e, playerHidden);
  }
}

/** Cell index under (x, y), or -1 outside the grid. */
export function cellIndexAt(state: GameState, x: number, y: number): number {
  const g = state.grid;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= g.width || cy >= g.height) return -1;
  return cy * g.width + cx;
}

function entityTerrain(state: GameState, t: AilmentTarget, team: number): void {
  let i = cellIndexAt(state, t.x, t.y);
  if (i < 0) return;
  const g = state.grid;
  const ts = t.terrain;
  // M4: swimmers (Bog Lurker) live in deep water and never fall.
  if (state.room.solid[i] === 1 && !('kind' in t && locomotionOf(t.kind) === 'swim')) {
    fall(state, t);
    if (t.dead) return;
    i = cellIndexAt(state, t.x, t.y);
    if (i < 0) return;
  } else if (isSafeCell(g, i)) {
    ts.safeX = t.x;
    ts.safeY = t.y;
    ts.hasSafe = true;
  }
  const T = state.tuning.terrain;
  const def = materialByCode[g.ground[i]!]!;

  // Rule 15: Wet (Hydromancer: always).
  if (def.water !== null || alwaysWet(state, t)) {
    if (ts.wetLeft <= 0) becomeWet(state, t);
    ts.wetLeft = T.wetSeconds;
  } else if (ts.wetLeft > 0) {
    ts.wetLeft -= DT;
    if (ts.wetLeft <= TIME_EPSILON) dryOff(state, t);
  }
  if (ts.wetLeft > 0 && isIgnited(t)) extinguish(state, t);

  // Rule 17: Oiled.
  if (g.surface[i] === SURFACE.oil) {
    if (ts.oiledLeft <= 0)
      emit(state, { type: 'oiledChanged', target: targetRef(t), oiled: true, x: t.x, y: t.y });
    ts.oiledLeft = T.oiledSeconds;
  } else if (ts.oiledLeft > 0) {
    ts.oiledLeft -= DT;
    if (ts.oiledLeft <= TIME_EPSILON) {
      ts.oiledLeft = 0;
      emit(state, { type: 'oiledChanged', target: targetRef(t), oiled: false, x: t.x, y: t.y });
    }
  }

  // The player's i-frames (dodge, respawn) also dodge terrain fire and charge.
  const iframes = t === state.player && isInvulnerable(state.player);
  // Rule 16: burning ground.
  const fireHurts = g.fire[i]! > 0 && hazardHurts(g.owner[i]!, team) && !immuneToTerrainFire(state, t);
  if (fireHurts && !iframes) {
    const owner = g.owner[i]!;
    const dps =
      terrainFireDps(state, g.surface[i] === SURFACE.oil) *
      terrainFireDpsMult(state, owner) *
      (1 - t.resist.fire);
    applyIgnite(state, t, dps, state.tuning.ailments.igniteDuration, hazardSource(owner), owner, true);
  }
  if ('kind' in t && t.shield !== null && (fireHurts || isIgnited(t))) burnShield(state, t);
  burningGroundHeal(state, t, g.fire[i]! > 0); // Kiln-Heart Cloak (hero/uniques.ts).

  // Rules 11, 12: charged water and metal.
  if (g.charge[i]! > 0 && !iframes) chargeHit(state, t, team, g.chargeId[i]!, g.chargeFalloff[i]!);
  if (t.dead) return;

  // Rules 22, 18: a burning entity lights what it walks over, and an Oiled one leaves burning
  // cells behind it: the cell it just left, not the one it stands on, so its own trail (owned by
  // its igniter) can't keep re-igniting it (M4 balance pass: Oiled players burned to death).
  const owner = burningOwner(t);
  if (owner >= 0) {
    if (ignitable(g, i)) fireOnCell(state, i, owner);
    else if (ts.oiledLeft > 0 && isIgnited(t) && i !== ts.cell && ts.cell >= 0 && g.fire[ts.cell] === 0)
      fireOnCell(state, ts.cell, owner);
  }
  ts.cell = i;
}

function becomeWet(state: GameState, t: AilmentTarget): void {
  emit(state, { type: 'wetChanged', target: targetRef(t), wet: true, x: t.x, y: t.y });
  if (!('kind' in t)) return;
  const b = chemistryOf(t)?.alwaysBurning;
  if (b === undefined) return;
  // A Tinderling goes out: stunned, and a windup is lost (like a freeze).
  t.terrain.stunLeft = b.dousedStun;
  t.vx = t.vy = 0;
  if (t.attack.phase === 'windup') {
    t.attack.phase = 'none';
    t.attack.timeLeft = 0;
  }
  emit(state, { type: 'tinderlingDoused', id: t.id, x: t.x, y: t.y, stun: b.dousedStun });
}

function dryOff(state: GameState, t: AilmentTarget): void {
  t.terrain.wetLeft = 0;
  emit(state, { type: 'wetChanged', target: targetRef(t), wet: false, x: t.x, y: t.y });
  if ('kind' in t && chemistryOf(t)?.alwaysBurning !== undefined)
    emit(state, { type: 'tinderlingRelit', id: t.id, x: t.x, y: t.y });
}

function burnShield(state: GameState, e: Enemy): void {
  const s = e.shield!;
  s.burnLeft -= DT;
  if (s.burnLeft > TIME_EPSILON) return;
  e.shield = null;
  emit(state, { type: 'shieldBurned', id: e.id, x: e.x, y: e.y });
}

/** Rules 11, 12: one hit per charge event per entity, for the event's damage × falloff. */
function chargeHit(state: GameState, t: AilmentTarget, team: number, id: number, falloff: number): void {
  const ts = t.terrain;
  if (chargeSeen(ts, id)) return;
  const ev = chargeEventInfo(state, id);
  if (ev === null || !hazardHurts(ev.owner, team)) return;
  rememberCharge(ts, id);
  const damage = ev.damage * falloff;
  emit(state, { type: 'chargeHit', target: targetRef(t), chargeId: id, damage, x: t.x, y: t.y });
  if (damage <= 0) return;
  const packet = makePacket(damage, { storm: 1 }, 0, state.tuning.combat.critMultiplier);
  applyHit(state, t, packet, { sourceId: ev.sourceId, dirX: 0, dirY: 0, knockback: 0, owner: ev.owner });
}

/** Enemy-only: stun countdown and Blind. */
function stepEnemyExtras(state: GameState, e: Enemy, playerHidden: boolean): void {
  const ts = e.terrain;
  if (ts.stunLeft > 0) ts.stunLeft = ts.stunLeft > DT + TIME_EPSILON ? ts.stunLeft - DT : 0;
  const i = ts.cell;
  const inAir = i >= 0 && state.grid.air[i] !== AIR.none;
  const blind = inAir || (playerHidden && e.ai.targetId === 0);
  if (blind !== ts.blind) {
    ts.blind = blind;
    emit(state, { type: 'blindChanged', id: e.id, blind, x: e.x, y: e.y });
  }
}
