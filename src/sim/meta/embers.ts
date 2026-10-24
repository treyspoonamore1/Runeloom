/**
 * Embers (DESIGN §11, M7): the Hearth's currency. Once the Hearth is lit, in adventure mode,
 * every kill drops some (by monster rarity, bosses more, × growth per area level above 1, like
 * kill XP), every chest opening drops some, and a completed rift pays riftPerTier × its tier.
 * Spawned Kiln Mites pay nothing (hero/onKill.ts returns before any drop). data/hearth.ts embers.
 */
import { embers } from '../../../data/hearth';
import { bossKinds } from '../../../data/progression';
import type { Enemy } from '../actors/enemies';
import { scaleByLevel } from '../combat/damage';
import { dropLoot } from '../items/loot';
import type { GameState } from '../state';

/** Embers drop now: adventure mode with the Hearth lit. */
export function embersDrop(state: GameState): boolean {
  return state.mode === 'adventure' && state.hero.hearth.lit;
}

/** Embers one kill of `e` is worth (ignoring whether they drop): at least 1. */
export function killEmbersFor(kind: string, rarity: Enemy['rarity'], areaLevel: number): number {
  const base = bossKinds.includes(kind) ? embers.perKill.boss : embers.perKill[rarity];
  return Math.max(1, Math.round(scaleByLevel(base, embers.growth, areaLevel)));
}

/** Embers a kill drops now (0 when the Hearth is unlit or outside adventure). */
export function killEmbers(state: GameState, e: Enemy): number {
  return embersDrop(state) ? killEmbersFor(e.kind, e.rarity, e.areaLevel) : 0;
}

/** Embers a completed rift of `tier` pays now. */
export function riftEmbers(state: GameState, tier: number): number {
  return embersDrop(state) ? embers.riftPerTier * tier : 0;
}

/** A chest opened at (x, y): its Embers land on the floor there (when they drop). */
export function dropChestEmbers(state: GameState, x: number, y: number): void {
  if (embersDrop(state) && embers.chest > 0) dropLoot(state, x, y, { kind: 'embers', amount: embers.chest });
}
