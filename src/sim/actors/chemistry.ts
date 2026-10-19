/**
 * Enemy chemistry (CONTENT §5 "Chemistry") and the terrain an entity leaves behind:
 * - Tinderlings are always burning unless Wet (doused: stunned, take more damage); they leave
 *   enemy-owned fire where they die.
 * - Shatter (rule 20): a Frozen enemy's death bursts into frost in a 4-cell radius (rules 7, 8),
 *   owned by the killer's team, with no damage.
 * - Ember Archer arrows that miss ignite the flammable cells where they land.
 */
import { enemies, enemyDef, type EnemyChemistry, type EnemyDef } from '../../../data/enemies';
import { OWNER } from '../../../data/materials';
import { teamOfSource, isIgnited, type AilmentTarget } from '../combat/ailments';
import { WORLD_SOURCE_ID, ignitable } from '../grid/cells';
import { applyElement } from '../grid/paint';
import { rasterize } from '../grid/raster';
import type { GameState } from '../state';
import { PLAYER_ID, type Enemy } from './enemies';
import { isWet } from './terrainState';

export function chemistryOf(e: Enemy): EnemyChemistry | undefined {
  return enemyDef(e.kind).chemistry;
}

/** A Tinderling that is out (Wet). */
export function isDoused(e: Enemy): boolean {
  return chemistryOf(e)?.alwaysBurning !== undefined && isWet(e);
}

/** Damage-taken multiplier from chemistry: a doused Tinderling takes dousedDamageTaken ×. */
export function dousedTakenMult(e: Enemy): number {
  const b = chemistryOf(e)?.alwaysBurning;
  return b !== undefined && isWet(e) ? b.dousedDamageTaken : 1;
}

/**
 * The team whose fire this entity spreads (rules 18, 22), or -1 if it isn't burning: an
 * always-burning enemy that isn't Wet lights enemy-owned cells; an Ignited entity lights cells
 * of the team that ignited it.
 */
export function burningOwner(t: AilmentTarget): number {
  if ('kind' in t && chemistryOf(t)?.alwaysBurning !== undefined) return isWet(t) ? -1 : OWNER.enemy;
  return isIgnited(t) ? t.ailments.ignite.owner : -1;
}

/** sourceId credited for a hazard of `owner`: the player for player-owned ones, else the world. */
export function hazardSource(owner: number): number {
  return owner === OWNER.player ? PLAYER_ID : WORLD_SOURCE_ID;
}

/** Applies Fire as `owner` to exactly cell i (rule 22 lighting, rule 18 trail). */
export function fireOnCell(state: GameState, i: number, owner: number): void {
  const w = state.grid.width;
  const x = i % w;
  const y = (i - x) / w;
  applyElement(state, {
    element: 'fire',
    shape: { kind: 'circle', x: x + 0.5, y: y + 0.5, r: 0.1 },
    owner,
    sourceId: hazardSource(owner),
    hitDamage: 0,
    durationMult: 1,
  });
}

/** Ignites every ignitable (flammable, dry, not burning) cell whose center is within r of (x, y). */
export function igniteFlammableAround(
  state: GameState,
  x: number,
  y: number,
  r: number,
  owner: number,
): void {
  const g = state.grid;
  const list = rasterize(g, { kind: 'circle', x, y, r });
  const n = list.len;
  if (n === 0) return;
  const cells = list.cells.slice(0, n);
  for (let k = 0; k < n; k++) if (ignitable(g, cells[k]!)) fireOnCell(state, cells[k]!, owner);
}

/** Terrain an enemy's death leaves: the Shatter frost burst (rule 20) or a Tinderling's fire. */
export function deathTerrain(state: GameState, e: Enemy, killerId: number, shattered: boolean): void {
  if (shattered) {
    applyElement(state, {
      element: 'frost',
      shape: { kind: 'circle', x: e.x, y: e.y, r: state.tuning.terrain.shatterRadius },
      owner: teamOfSource(killerId),
      sourceId: killerId,
      hitDamage: 0,
      durationMult: 1,
    });
    return;
  }
  const b = chemistryOf(e)?.alwaysBurning;
  if (b === undefined || isWet(e)) return;
  applyElement(state, {
    element: 'fire',
    shape: { kind: 'circle', x: Math.floor(e.x) + 0.5, y: Math.floor(e.y) + 0.5, r: b.deathFireRadius },
    owner: OWNER.enemy,
    sourceId: WORLD_SOURCE_ID,
    hitDamage: 0,
    durationMult: 1,
  });
}

/** missIgniteRadius per enemy projectile kind (from data/enemies.ts). */
const missIgnite: ReadonlyMap<string, number> = (() => {
  const m = new Map<string, number>();
  for (const def of Object.values(enemies) as EnemyDef[]) {
    const r = def.chemistry?.missIgniteRadius;
    const kind = def.attack?.projectile?.kind;
    if (r !== undefined && kind !== undefined) m.set(kind, r);
  }
  return m;
})();

/** An enemy projectile of `kind` missed at (x, y): ignite the flammable cells there if its kind does. */
export function projectileMissed(state: GameState, kind: string, x: number, y: number): void {
  const r = missIgnite.get(kind);
  if (r !== undefined) igniteFlammableAround(state, x, y, r, OWNER.enemy);
}
