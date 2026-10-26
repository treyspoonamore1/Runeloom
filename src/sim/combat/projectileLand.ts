/**
 * Enemy projectiles that leave terrain where they end (M8, ProjectileDef.landWater): the
 * Glasswater Coil's glass spit puddles the dry ground where it lands, whether it hit the player,
 * a wall or the end of its flight (CONTENT §5): borrowed shallow water (grid/tempWater.ts
 * placeBorrowedWater, DESIGN §6.5), which goes back when its time ends (rule 27).
 */
import { enemies, type EnemyDef } from '../../../data/enemies';
import { emit } from '../events';
import { placeBorrowedWater } from '../grid/tempWater';
import type { GameState } from '../state';

/** landWater per enemy projectile kind, from every attack of data/enemies.ts. */
const landWater: ReadonlyMap<string, { radius: number; seconds: number }> = (() => {
  const m = new Map<string, { radius: number; seconds: number }>();
  for (const def of Object.values(enemies) as EnemyDef[])
    for (const a of [def.attack, ...(def.extraAttacks ?? [])]) {
      const w = a?.projectile?.landWater;
      if (w !== undefined && a?.projectile) m.set(a.projectile.kind, w);
    }
  return m;
})();

/** An enemy projectile of `kind` ended at (x, y), for any reason: its landing terrain, if any. */
export function projectileLanded(state: GameState, kind: string, x: number, y: number): void {
  const w = landWater.get(kind);
  if (w === undefined) return;
  placeBorrowedWater(state, x, y, w.radius, w.seconds);
  emit(state, { type: 'coilPuddle', x, y, radius: w.radius, seconds: w.seconds });
}
