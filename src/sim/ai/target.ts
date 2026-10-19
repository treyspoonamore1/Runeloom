/**
 * Where a targeted attack lands (M4). The Stormcaller prefers water or metal within
 * EnemyChemistry.conductorTarget cells of the player (CONTENT §5), so its strike electrifies
 * what the player stands in or near: the player's own cell if it conducts, else the conducting
 * cell center nearest the player (ties: row-major). Otherwise, and for every other kind, the
 * player's position.
 */
import { enemyDef } from '../../../data/enemies';
import { materialByCode } from '../../../data/materials';
import type { Enemy } from '../actors/enemies';
import type { GameState } from '../state';

const point = { x: 0, y: 0 };

/** The strike point for `e`'s targeted attack. The returned object is shared scratch. */
export function strikePoint(state: GameState, e: Enemy): { x: number; y: number } {
  const p = state.player;
  point.x = p.x;
  point.y = p.y;
  const r = enemyDef(e.kind).chemistry?.conductorTarget;
  if (r === undefined) return point;
  const g = state.grid;
  const cx = Math.floor(p.x);
  const cy = Math.floor(p.y);
  let best = r * r;
  let found = false;
  const R = Math.ceil(r);
  for (let y = cy - R; y <= cy + R; y++) {
    if (y < 0 || y >= g.height) continue;
    for (let x = cx - R; x <= cx + R; x++) {
      if (x < 0 || x >= g.width) continue;
      if (materialByCode[g.ground[y * g.width + x]!]!.conducts === 'none') continue;
      const dx = x + 0.5 - p.x;
      const dy = y + 0.5 - p.y;
      const d2 = dx * dx + dy * dy;
      if (x === cx && y === cy) {
        // Standing in it: strike the player.
        point.x = p.x;
        point.y = p.y;
        return point;
      }
      if (d2 < best || (!found && d2 === best)) {
        best = d2;
        found = true;
        point.x = x + 0.5;
        point.y = y + 0.5;
      }
    }
  }
  return point;
}
