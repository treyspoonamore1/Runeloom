/**
 * Region difficulty (M8, data/progression.ts regionDifficulty): monsters in Fen and Foundry rooms
 * get the tier 8 rift scaling (world/rift/rules.ts tierScaling), applied where a rift tier's is:
 * life when they spawn (actors/enemies.ts), the hits they deal the player (combat/hits.ts). World
 * hazards don't scale with it, and bosses keep their absolute numbers.
 */
import { enemyDef } from '../../../data/enemies';
import { regionDifficulty } from '../../../data/progression';
import type { GameState } from '../state';
import { tierScaling } from '../world/rift/rules';

const NONE = { life: 1, damage: 1 };
let cachedId = '';
let cached = NONE;

/** The life and hit damage multipliers of the current room's region (1 and 1 outside one). */
export function regionScaling(state: GameState): { life: number; damage: number } {
  const id = state.room.id;
  if (id === cachedId) return cached;
  cachedId = id;
  cached = NONE;
  for (const r of regionDifficulty) if (id.startsWith(r.prefix)) cached = tierScaling(r.tier);
  return cached;
}

/** Life multiplier for a non-boss monster spawned in the current room. */
export function regionLifeMult(state: GameState): number {
  return regionScaling(state).life;
}

/** Hit damage multiplier for a hit from enemy `sourceId` in the current room (1 for bosses). */
export function regionDamageMult(state: GameState, sourceId: number): number {
  const m = regionScaling(state).damage;
  if (m === 1) return 1;
  for (const e of state.enemies) if (e.id === sourceId) return enemyDef(e.kind).isBoss ? 1 : m;
  return m;
}
