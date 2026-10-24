/**
 * Mutations (CONTENT §11, M7): bought with Ash, permanent across Rekindles.
 *
 * CONTRACT (M7). Who hooks each one in:
 * - meta agent: Bright Hearth, Sigil Cache, Swift Expeditions (meta/*), Shatterpoint (the Shatter
 *   rune joins rune discovery), Deeper Weave and Stormglass Memory (addMutationMods below).
 * - threads agent: Twin Threads (the fifth weave slot on R) and Kindred Flame (combat).
 * Systems read ownership with `mutationCount` / `hasMutation`, never hearth.mutations directly.
 */
import type { MutationId } from '../../../data/hearth';
import type { HeroMods } from '../hero/mods';
import type { HeroState } from '../hero/types';

/** How many times the hero bought a mutation (0 if never). */
export function mutationCount(hero: Readonly<HeroState>, id: MutationId): number {
  return hero.hearth.mutations[id] ?? 0;
}

export function hasMutation(hero: Readonly<HeroState>, id: MutationId): boolean {
  return mutationCount(hero, id) > 0;
}

/**
 * HeroMods from mutations (Deeper Weave's depth, Stormglass Memory's ice conduction, Kindred
 * Flame's flag). Called by heroModsOf after the passive tree and before uniques (so The First
 * Thread's depth cap still wins). Meta agent; the threads agent adds Kindred Flame.
 */
export function addMutationMods(hero: Readonly<HeroState>, mods: HeroMods): void {
  void hero;
  void mods;
}
