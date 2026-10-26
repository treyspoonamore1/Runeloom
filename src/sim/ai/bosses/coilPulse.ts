/**
 * The Glasswater Coil's charge (DESIGN §10.5, CONTENT §5), on timers beside its attacks, from its
 * passive (running frozen or not; not before it wakes, not with AI off):
 * - Eye pulse (phases 1–2): every coilPulse.every s (phase 2: everyPhase2) all its water glows
 *   for glowSeconds ('coilPulseGlow' eye), then enemy charge floods the water body it is in for
 *   `damage` Storm (rule 11 with reach and maxCells of its own). Out of water when it is due, it
 *   waits for water; out of water when it lands, it fizzles.
 * - Body pulse (phase 3): the same with coilBodyPulse (reach 20, every 4 s while in water). If the
 *   player's charge reaches its water within `reach` during the glow, it is Overloaded
 *   ('coilOverloaded'): the pulse is cancelled, it is stunned overloadStun s, and the next glow
 *   comes overloadDelay s later.
 * - Pylon storm (phase 3): every coilPylonStorm.every s the room's pylons (`M` tiles) glow
 *   ('pylonGlow' each, 'coilPylonGlow'), then lightning strikes them ('coilPylonStorm'): Storm on
 *   each pylon tile as the enemy, so their pads electrify and hand the charge to the rim (rules
 *   12–13).
 */
import { OWNER } from '../../../../data/materials';
import { bossDamageScale, type Enemy } from '../../actors/enemies';
import { isWaterCell } from '../../actors/locomotion';
import { cellOf, searchFrom, visited } from '../../actors/swim';
import { DT, TILE_CELLS } from '../../core/constants';
import { emit } from '../../events';
import { electrify } from '../../grid/charge';
import { applyElement } from '../../grid/paint';
import type { GameState } from '../../state';

const TIME_EPSILON = 1e-9;
const PYLON_CHAR = 'M'.charCodeAt(0);
/** Covers every cell center of a 4×4 tile from the tile's center (√2 × 1.5 ≈ 2.12). */
const TILE_REACH = 2.2;

type Pulse = 'eye' | 'body';

/** Phase 3 begins: the Body pulse and the pylon storm start their clocks. */
export function startCoilStorm(state: GameState, e: Enemy): void {
  const f = e.boss!.fen!;
  const T = state.tuning.bosses;
  f.pulseGlowing = false;
  f.pulseLeft = T.coilBodyPulse.firstDelay;
  f.pylonGlowing = false;
  f.pylonLeft = T.coilPylonStorm.firstDelay;
}

/** One tick of the pulses and the storm. */
export function stepCoilCharge(state: GameState, e: Enemy): void {
  const f = e.boss!.fen!;
  const T = state.tuning.bosses;
  if (f.overloadLeft > 0) f.overloadLeft = f.overloadLeft > DT + TIME_EPSILON ? f.overloadLeft - DT : 0;
  if (e.ai.mode === 'idle') {
    f.pulseLeft = T.coilPulse.firstDelay;
    return;
  }
  const phase3 = e.boss!.phase >= 3;
  stepPulse(state, e, phase3 ? 'body' : 'eye');
  if (phase3) stepPylonStorm(state, e);
}

function pulseDef(state: GameState, pulse: Pulse) {
  return pulse === 'eye' ? state.tuning.bosses.coilPulse : state.tuning.bosses.coilBodyPulse;
}

function every(state: GameState, e: Enemy, pulse: Pulse): number {
  const T = state.tuning.bosses;
  if (pulse === 'body') return T.coilBodyPulse.every;
  return e.boss!.phase >= 2 ? T.coilPulse.everyPhase2 : T.coilPulse.every;
}

function stepPulse(state: GameState, e: Enemy, pulse: Pulse): void {
  const f = e.boss!.fen!;
  const P = pulseDef(state, pulse);
  const i = cellOf(state, e.x, e.y);
  const inWater = i >= 0 && isWaterCell(state.grid, i);
  if (f.pulseGlowing && pulse === 'body' && overloadReached(state, i, P.reach)) {
    overload(state, e);
    return;
  }
  f.pulseLeft -= DT;
  if (f.pulseLeft > TIME_EPSILON) return;
  if (!f.pulseGlowing) {
    if (!inWater) {
      f.pulseLeft = 0;
      return;
    }
    f.pulseGlowing = true;
    f.pulseLeft += P.glowSeconds;
    emit(state, { type: 'coilPulseGlow', id: e.id, pulse, seconds: P.glowSeconds, reach: P.reach, x: e.x, y: e.y });
    return;
  }
  f.pulseGlowing = false;
  f.pulseLeft += every(state, e, pulse) - P.glowSeconds;
  if (!inWater) return;
  const damage = P.damage * bossDamageScale(state, e);
  emit(state, { type: 'coilPulse', id: e.id, pulse, damage, reach: P.reach, x: e.x, y: e.y });
  electrify(state, [i], 1, [], 0, {
    owner: OWNER.enemy,
    sourceId: e.id,
    hitDamage: damage,
    durationMult: 1,
    waterReach: { maxDistance: P.reach, maxCells: P.maxCells },
  });
}

/** True if the player's charge is on its water within `reach` steps (the Body pulse's glow). */
function overloadReached(state: GameState, here: number, reach: number): boolean {
  if (here < 0 || !isWaterCell(state.grid, here)) return false;
  const g = state.grid;
  const n = searchFrom(state, here, 'water', state.tuning.bosses.coilBodyPulse.maxCells, reach);
  for (let k = 0; k < n; k++) {
    const c = visited(k);
    if (g.charge[c]! > 0 && g.owner[c] === OWNER.player) return true;
  }
  return false;
}

function overload(state: GameState, e: Enemy): void {
  const f = e.boss!.fen!;
  const B = state.tuning.bosses.coilBodyPulse;
  f.pulseGlowing = false;
  f.pulseLeft = B.overloadDelay;
  f.overloadLeft = B.overloadStun;
  f.volleyLeft = 0;
  e.terrain.stunLeft = Math.max(e.terrain.stunLeft, B.overloadStun);
  e.vx = e.vy = 0;
  if (e.attack.phase === 'windup') {
    e.attack.phase = 'none';
    e.attack.timeLeft = 0;
  }
  emit(state, { type: 'coilOverloaded', id: e.id, stun: B.overloadStun, delay: B.overloadDelay, x: e.x, y: e.y });
}

/** Centers (cells) of the room's pylon tiles, row-major. */
export function pylonCenters(state: GameState): { x: number; y: number }[] {
  const room = state.room;
  const out: { x: number; y: number }[] = [];
  for (let ty = 0; ty < room.tilesH; ty++)
    for (let tx = 0; tx < room.tilesW; tx++)
      if (room.tiles[ty * room.tilesW + tx] === PYLON_CHAR)
        out.push({ x: (tx + 0.5) * TILE_CELLS, y: (ty + 0.5) * TILE_CELLS });
  return out;
}

function stepPylonStorm(state: GameState, e: Enemy): void {
  const f = e.boss!.fen!;
  const S = state.tuning.bosses.coilPylonStorm;
  f.pylonLeft -= DT;
  if (f.pylonLeft > TIME_EPSILON) return;
  const pylons = pylonCenters(state);
  if (!f.pylonGlowing) {
    f.pylonGlowing = true;
    f.pylonLeft += S.glowSeconds;
    for (const p of pylons) emit(state, { type: 'pylonGlow', x: p.x, y: p.y, seconds: S.glowSeconds });
    emit(state, { type: 'coilPylonGlow', id: e.id, seconds: S.glowSeconds, pylons });
    return;
  }
  f.pylonGlowing = false;
  f.pylonLeft += S.every - S.glowSeconds;
  const damage = S.damage * bossDamageScale(state, e);
  emit(state, { type: 'coilPylonStorm', id: e.id, damage, pylons });
  for (const p of pylons)
    applyElement(state, {
      element: 'storm',
      shape: { kind: 'circle', x: p.x, y: p.y, r: TILE_REACH },
      owner: OWNER.enemy,
      sourceId: e.id,
      hitDamage: damage,
      durationMult: 1,
    });
}
