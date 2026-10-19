/**
 * What each element does to one cell (DESIGN §6.3), for applyElement (paint.ts) and explosions.
 *
 * Fire, in order: ice melts (rule 5); oil ignites hot (rule 6, also on water); water steams
 * (rule 4); an already burning cell takes the new owner; a flammable cell ignites (rule 1);
 * other walkable ground gets placed fire (rule 26). Wet cells never ignite.
 * Frost: puts fire out keeping its fuel (rule 9), then freezes water (rules 7, 8) or dries mud
 * (rule 10); re-freezing temporary ice restarts its timer (map ice stays permanent). Steaming
 * water doesn't freeze (DESIGN §5.3: frost does nothing to steam).
 * Storm: rolls rule 14 per dry flammable cell; the water and metal cells feed charge.ts.
 */
import { AIR, MAT, SURFACE, materialByCode, materials } from '../../../data/materials';
import type { GameState } from '../state';
import { markActive } from './active';
import { addToBatch, fx, gridTicks, ignitable, ignite, setAir, setGround, steamTicks, u16 } from './cells';
import type { CellBatch } from './cells';

export interface CellContext {
  owner: number;
  durationMult: number;
}

/** Applies Fire to cell i. Returns true if the cell is water that should steam (rule 4). */
export function fireCell(state: GameState, i: number, c: CellContext): boolean {
  const g = state.grid;
  let def = materialByCode[g.ground[i]!]!;
  if (def.fireTo !== undefined) {
    // Rule 5: ice and ice bridges melt where the fire hits.
    setGround(state, i, MAT[def.fireTo]);
    def = materialByCode[g.ground[i]!]!;
    if (g.surface[i] !== SURFACE.oil) return false;
  }
  if (g.fire[i]! > 0) {
    // Already burning: a new effect takes the new owner.
    g.owner[i] = c.owner;
    if (g.surface[i] !== SURFACE.oil && def.flammable === null) {
      const t = u16(gridTicks(state.tuning.grid.placedFireSeconds * c.durationMult));
      if (g.fuel[i]! < t) g.fuel[i] = t;
    }
    return false;
  }
  if (g.surface[i] === SURFACE.oil) {
    ignite(state, i, c.owner, c.durationMult);
    return false;
  }
  if (def.water !== null) return true;
  if (def.flammable !== null) {
    ignite(state, i, c.owner, c.durationMult);
    return false;
  }
  if (def.walk && g.wet[i] === 0) placeFire(state, i, c);
  return false;
}

/** Rule 26: placed fire on walkable non-flammable ground. */
function placeFire(state: GameState, i: number, c: CellContext): void {
  const g = state.grid;
  const t = state.tuning.grid;
  g.fire[i] = t.fireIntensity.placed;
  g.fuel[i] = u16(gridTicks(t.placedFireSeconds * c.durationMult));
  g.owner[i] = c.owner;
  markActive(g.active, i);
  addToBatch(fx.ignited, g, i);
}

/** Rule 4: steam over cell i and steamRadius cells around it (skipping shot-blocking cells). */
export function steamAround(state: GameState, i: number, durationMult: number, batch: CellBatch): void {
  const g = state.grid;
  const r = state.tuning.grid.steamRadius;
  const ticks = steamTicks(durationMult);
  const x = i % g.width;
  const y = (i - x) / g.width;
  for (let cy = Math.max(0, y - r); cy <= Math.min(g.height - 1, y + r); cy++)
    for (let cx = Math.max(0, x - r); cx <= Math.min(g.width - 1, x + r); cx++) {
      const j = cy * g.width + cx;
      if (materialByCode[g.ground[j]!]!.blocksShots) continue;
      setAir(g, j, AIR.steam, ticks);
      addToBatch(batch, g, j);
    }
}

/** Applies Frost to cell i. Adds frozen cells to `formed`. */
export function frostCell(state: GameState, i: number, c: CellContext, formed: CellBatch): void {
  const g = state.grid;
  if (g.fire[i]! > 0) g.fire[i] = 0; // Rule 9: fuel stays for a later reignite.
  const def = materialByCode[g.ground[i]!]!;
  // DESIGN §5.3: frost does nothing to steam, so [Fire, Frost] on water leaves steaming water.
  if (def.water !== null && g.air[i] === AIR.steam) return;
  if (def.frostTo !== undefined) {
    const to = materials[def.frostTo];
    setGround(state, i, to.code);
    const t = frozenTicks(to.id, c.durationMult);
    if (t > 0) {
      g.timer[i] = t;
      addToBatch(formed, g, i);
    }
    return;
  }
  // Temporary ice hit by Frost again lasts its full time again; map ice (timer 0) stays permanent.
  if (def.revertSeconds !== undefined && g.timer[i]! > 0) {
    const t = frozenTicks(def.id, c.durationMult);
    if (g.timer[i]! < t) g.timer[i] = t;
  }
}

/** Material timer for frost-made ice: revertSeconds (× Lingering) plus crackSeconds. 0 if none. */
function frozenTicks(id: keyof typeof materials, mult: number): number {
  const m = materials[id];
  if (m.revertSeconds === undefined) return 0;
  return u16(gridTicks(m.revertSeconds * mult) + gridTicks(m.crackSeconds ?? 0));
}

/** Rule 14: Storm on a dry flammable cell ignites it with stormIgniteChance (gridRng). */
export function stormCell(state: GameState, i: number, c: CellContext): void {
  if (!ignitable(state.grid, i)) return;
  if (state.gridRng.chance(state.tuning.grid.stormIgniteChance)) ignite(state, i, c.owner, c.durationMult);
}
