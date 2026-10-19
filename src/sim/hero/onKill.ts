/**
 * What a kill gives the character: XP for the hero and socketed runes, and loot drops.
 * Called from killEnemy (combat/hits.ts) for every enemy death except console kills.
 *
 * CONTRACT (M4): owned by the hero/items agent (XP: src/sim/hero, drops: src/sim/items). Only
 * adventure mode pays out; sandbox, arena and lab kills give nothing, so their hashes don't change.
 * Every kill pays, whoever dealt the blow (the player's spells, terrain, explosions, other enemies),
 * except the kinds in killXp.spawnedPayNothing when another enemy spawned them (Brood Kiln mites).
 */
import type { Enemy } from '../actors/enemies';
import type { DeathCause } from '../events';
import type { GameState } from '../state';
import { dropKillLoot } from '../items/drops';
import { grantXp, killXpFor } from './xp';
import { killXp } from '../../../data/loot';

export function onEnemyKilled(state: GameState, e: Enemy, killerId: number, cause: DeathCause): void {
  if (state.mode !== 'adventure') return;
  void killerId;
  void cause;
  // Spawned Kiln Mites pay nothing, so a living Brood Kiln can't be farmed (data/loot.ts).
  if (e.special.parentId >= 0 && killXp.spawnedPayNothing.includes(e.kind)) return;
  grantXp(state, killXpFor(e.kind, e.areaLevel, e.rarity), e.x, e.y);
  dropKillLoot(state, e);
}
