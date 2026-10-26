/**
 * The Glasswater Coil's states (DESIGN §10.5 table; actors/bossStateFen.ts CoilMode) and the
 * damage it takes in each:
 * - Submerged (center on deep water, not attacking): coilSubmergedTaken × in phase 1 (75% less),
 *   coilDiveTaken × in phases 2–3 (90% less).
 * - Surfaced (winding up, attacking or recovering in deep water, or mid-volley), Exposed (center
 *   on shallow water: rim, flats, puddles, borrowed water), Iced, Overloaded: normal.
 * - Stranded (rule 31): 50% more, from actors/strand.ts (fenChemistry.ts applies it).
 * Iced: water freezing under its center traps it (actors/strand.ts); after coilIced.holdSeconds it
 * breaks out ('coilIceBreak'): the ice within breakRadius cells returns to water. For
 * immuneSeconds after that, ice it touches breaks before it can hold it (stepCoilIce, before the
 * swimmer step). 'coilState' is sent whenever the state changes.
 */
import { MAT, materialByCode } from '../../../../data/materials';
import type { CoilMode } from '../../actors/bossStateFen';
import type { Enemy } from '../../actors/enemies';
import { cellOf } from '../../actors/swim';
import { DT } from '../../core/constants';
import { emit } from '../../events';
import { setGround } from '../../grid/cells';
import type { GameState } from '../../state';

const TIME_EPSILON = 1e-9;

/** The Coil's state now (see the file comment). */
export function coilMode(state: GameState, e: Enemy): CoilMode {
  const f = e.boss!.fen!;
  const s = e.special;
  if (f.overloadLeft > 0) return 'overloaded';
  if (s.trapped) return 'iced';
  if (s.stranded) return 'stranded';
  const i = cellOf(state, e.x, e.y);
  if (i < 0 || state.grid.ground[i] !== MAT.deep_water) return 'exposed';
  if (e.attack.phase !== 'none' || f.volleyLeft > 0) return 'surfaced';
  return 'submerged';
}

/** Damage-taken multiplier from its state (Stranded's 50% more comes from rule 31's own multiplier). */
export function coilTakenMult(state: GameState, e: Enemy): number {
  if (coilMode(state, e) !== 'submerged') return 1;
  const T = state.tuning.bosses;
  return e.boss!.phase >= 2 ? T.coilDiveTaken : T.coilSubmergedTaken;
}

/** Records the state and sends 'coilState' when it changed. */
export function updateCoilMode(state: GameState, e: Enemy): void {
  const f = e.boss!.fen!;
  const m = coilMode(state, e);
  if (m === f.coil) return;
  f.coil = m;
  emit(state, { type: 'coilState', id: e.id, state: m, x: e.x, y: e.y });
}

/** Before the swimmer step: while freezing can't hold it, ice it touches breaks. */
export function stepCoilIce(state: GameState, e: Enemy): void {
  const f = e.boss!.fen!;
  if (f.iceImmuneLeft <= 0) return;
  f.iceImmuneLeft = f.iceImmuneLeft > DT + TIME_EPSILON ? f.iceImmuneLeft - DT : 0;
  breakIce(state, e.x, e.y, e.radius);
}

/** Iced: counts the hold, and breaks out when it ends. */
export function stepCoilIced(state: GameState, e: Enemy): void {
  const f = e.boss!.fen!;
  if (!e.special.trapped) {
    f.icedTime = 0;
    return;
  }
  f.icedTime += DT;
  const I = state.tuning.bosses.coilIced;
  if (f.icedTime + TIME_EPSILON < I.holdSeconds) return;
  f.icedTime = 0;
  f.iceImmuneLeft = I.immuneSeconds;
  breakIce(state, e.x, e.y, I.breakRadius);
  emit(state, { type: 'coilIceBreak', id: e.id, radius: I.breakRadius, x: e.x, y: e.y });
}

/**
 * Ice and ice bridges whose centers are within r of (x, y) return to the water they froze from
 * (shallow, deep), keeping `under`; borrowed ice stays borrowed with the time it had left, so it
 * still goes back when Tide's time ends (rule 27). Returns how many cells broke.
 */
export function breakIce(state: GameState, x: number, y: number, r: number): number {
  const g = state.grid;
  const R = Math.ceil(r);
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let n = 0;
  for (let yy = Math.max(0, cy - R); yy <= Math.min(g.height - 1, cy + R); yy++)
    for (let xx = Math.max(0, cx - R); xx <= Math.min(g.width - 1, cx + R); xx++) {
      const i = yy * g.width + xx;
      const code = g.ground[i]!;
      if (code !== MAT.ice && code !== MAT.ice_bridge) continue;
      const dx = xx + 0.5 - x;
      const dy = yy + 0.5 - y;
      if (dx * dx + dy * dy > r * r) continue;
      const to = materialByCode[code]!.fireTo;
      if (to === undefined) continue;
      // Borrowed ice (Tide water frozen, rule 27) becomes borrowed water with the time it had left.
      const left = g.timer[i]!;
      setGround(state, i, MAT[to]);
      if (g.borrowed[i] === 1) g.timer[i] = left;
      n++;
    }
  if (n > 0) g.version++;
  return n;
}
