/**
 * RNG streams seeded straight from the game seed (not forked from `rng`), so adding one never
 * shifts another: loot (items/drops.ts) and crafting (items/craft.ts).
 */
import { hashString } from './core/hash';
import { Rng } from './core/rng';

export function lootRngFor(seed: number): Rng {
  return new Rng((seed ^ hashString('loot')) >>> 0);
}

export function craftRngFor(seed: number): Rng {
  return new Rng((seed ^ hashString('craft')) >>> 0);
}
