/**
 * Reference dummy scenes (DESIGN §5.5), built in memory from data/readout.ts so the sim needs no
 * file I/O: a walled stone room, the player, and immortal dummies around a center along +x.
 */
import { REFERENCE_DUMMY, referenceScenes, type ReferenceSceneId } from '../../../../data/readout';
import type { Tuning } from '../../../../data/tuning';
import { spawnEnemy } from '../../actors/enemies';
import { createGame, type GameState } from '../../state';

export interface ReferenceScene {
  state: GameState;
  /** Center of the dummies, cells: where Cast weaves aim. */
  centerX: number;
  centerY: number;
}

/** Room text for a scene: stone floor inside a one-tile wall border. */
function roomText(id: ReferenceSceneId): string {
  const d = referenceScenes[id];
  const rows = ['#'.repeat(d.tilesW)];
  for (let y = 1; y < d.tilesH - 1; y++) rows.push(`#${'.'.repeat(d.tilesW - 2)}#`);
  rows.push('#'.repeat(d.tilesW));
  return `@id readout/${id}\n@name ${id}\n${rows.join('\n')}\n`;
}

/** The dummies' center for a scene, `distance` cells from the player (default: the scene's own). */
export function sceneCenter(id: ReferenceSceneId, distance?: number): { x: number; y: number } {
  const d = referenceScenes[id];
  return { x: d.playerX + (distance ?? d.centerDistance), y: d.playerY };
}

/**
 * A fresh game in a reference scene. `distance` moves the dummies' center closer to the player
 * (the readout does this for close-range forms). The player aims at the center.
 */
export function createReferenceScene(
  id: ReferenceSceneId,
  opts: { seed: number; tuning?: Tuning; distance?: number },
): ReferenceScene {
  const d = referenceScenes[id];
  const state = createGame({ seed: opts.seed, roomText: roomText(id), tuning: opts.tuning, spawnRoomEnemies: false });
  const p = state.player;
  p.x = p.prevX = d.playerX;
  p.y = p.prevY = d.playerY;
  const c = sceneCenter(id, opts.distance);
  const midC = (d.cols - 1) / 2;
  const midR = (d.rows - 1) / 2;
  for (let r = 0; r < d.rows; r++)
    for (let col = 0; col < d.cols; col++) {
      if (d.skipCenter && r === midR && col === midC) continue;
      spawnEnemy(state, REFERENCE_DUMMY, c.x + (col - midC) * d.spacing, c.y + (r - midR) * d.spacing, {
        facingX: -1,
        facingY: 0,
      });
    }
  state.enemyHash.rebuild(state.enemies);
  return { state, centerX: c.x, centerY: c.y };
}
