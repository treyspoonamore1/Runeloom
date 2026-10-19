/**
 * The Cinder Warden's phase 3 brazier storm (DESIGN §10.3, CONTENT §5): every
 * tuning.bosses.brazierStormPeriod s the room's braziers (`B` tiles) glow for brazierGlowSeconds
 * ('brazierStormCharge'), then lightning strikes them ('brazierStorm'): Storm through
 * applyElement on each brazier tile's cells, so the braziers' metal electrifies and hands the
 * charge to the water and metal touching it (rules 11–13), as the enemy team, for
 * brazierStormDamage (absolute). The first glow comes brazierFirstDelay s after the storm call.
 * Runs with the Warden's AI, frozen or not.
 */
import { OWNER } from '../../../../data/materials';
import type { Enemy } from '../../actors/enemies';
import { DT, TILE_CELLS } from '../../core/constants';
import { emit } from '../../events';
import { applyElement } from '../../grid/paint';
import type { GameState } from '../../state';

const BRAZIER_CHAR = 'B'.charCodeAt(0);
/** Covers every cell center of a 4×4 tile from the tile's center (√2 × 1.5 ≈ 2.12). */
const TILE_REACH = 2.2;

/** Centers (cells) of the room's brazier tiles, row-major. */
export function brazierCenters(state: GameState): { x: number; y: number }[] {
  const room = state.room;
  const out: { x: number; y: number }[] = [];
  for (let ty = 0; ty < room.tilesH; ty++)
    for (let tx = 0; tx < room.tilesW; tx++)
      if (room.tiles[ty * room.tilesW + tx] === BRAZIER_CHAR)
        out.push({ x: (tx + 0.5) * TILE_CELLS, y: (ty + 0.5) * TILE_CELLS });
  return out;
}

/** Starts the storm cycle (phase 3 begins). */
export function startBrazierStorm(state: GameState, e: Enemy): void {
  const b = e.boss!;
  b.glowing = false;
  b.stormLeft = state.tuning.bosses.brazierFirstDelay;
}

/** One tick of the storm cycle; does nothing before phase 3. */
export function stepBrazierStorm(state: GameState, e: Enemy): void {
  const b = e.boss!;
  if (b.phase < 3) return;
  b.stormLeft -= DT;
  if (b.stormLeft > 1e-9) return;
  const T = state.tuning.bosses;
  const braziers = brazierCenters(state);
  if (!b.glowing) {
    b.glowing = true;
    b.stormLeft += T.brazierGlowSeconds;
    emit(state, { type: 'brazierStormCharge', id: e.id, seconds: T.brazierGlowSeconds, braziers });
    return;
  }
  b.glowing = false;
  b.stormLeft += T.brazierStormPeriod - T.brazierGlowSeconds;
  emit(state, { type: 'brazierStorm', id: e.id, damage: T.brazierStormDamage, braziers });
  for (const c of braziers)
    applyElement(state, {
      element: 'storm',
      shape: { kind: 'circle', x: c.x, y: c.y, r: TILE_REACH },
      owner: OWNER.enemy,
      sourceId: e.id,
      hitDamage: T.brazierStormDamage,
      durationMult: 1,
    });
}
