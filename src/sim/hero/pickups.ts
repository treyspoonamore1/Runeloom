/**
 * Exploration rewards (DESIGN §10.1): the world agent's pickups call these when the player takes
 * a Heart Seed (+8 max life, which arrives filled) or a Loom Shard (+1 Capacity on every spindle).
 */
import type { GameState } from '../state';
import { refreshHero } from './hero';

export function addHeartSeed(state: GameState): void {
  const before = state.player.maxLife;
  state.hero.heartSeeds++;
  refreshHero(state);
  const p = state.player;
  if (!p.dead) p.life = Math.min(p.maxLife, p.life + (p.maxLife - before));
}

export function addLoomShard(state: GameState): void {
  state.hero.loomShards++;
  refreshHero(state);
}
