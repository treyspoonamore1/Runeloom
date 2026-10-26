/**
 * Exploration rewards (DESIGN §10.1): the world agent's pickups call these when the player takes
 * a Heart Seed (+8 max life, which arrives filled) or a Loom Shard (+1 Capacity on every spindle),
 * and a Pattern Seed (+1 passive point: M8 chests; bosses can call it too).
 */
import type { GameState } from '../state';
import { emit } from '../events';
import { refreshHero } from './hero';

export function addHeartSeed(state: GameState): void {
  const p = state.player;
  const max = p.maxLife;
  const life = p.life;
  state.hero.heartSeeds++;
  refreshHero(state);
  if (!p.dead) p.life = Math.min(p.maxLife, life + (p.maxLife - max));
}

export function addLoomShard(state: GameState): void {
  state.hero.loomShards++;
  refreshHero(state);
}

export function addPatternSeed(state: GameState, x = state.player.x, y = state.player.y): void {
  state.hero.patternSeeds++;
  refreshHero(state);
  emit(state, { type: 'patternSeedGained', total: state.hero.patternSeeds, x, y });
}
