/**
 * What boss attacks do when they land, besides damage (called by resolveEnemyAttack,
 * combat/enemyAttacks.ts):
 * - summon_hulks (Tar Matriarch at half life): tuning.bosses.matriarchSummonCount Tar Hulks
 *   appear around her, aggroed ('bossSummon'); phase 2.
 * - flood (Cinder Warden, phase 2): the channels overflow (flood.ts); he becomes Superheated and
 *   builds chill only in water.
 * - call_storm (Cinder Warden, phase 3): the brazier storm cycle starts (braziers.ts).
 */
import { enemyDef } from '../../../../data/enemies';
import { circleOverlapsSolid } from '../../actors/collision';
import { spawnEnemy, type Enemy } from '../../actors/enemies';
import { emit } from '../../events';
import type { GameState } from '../../state';
import { aggro } from '../common';
import { startBrazierStorm } from './braziers';
import { floodArena } from './flood';
import { enterPhase, setSuperheat } from './phases';

export function landBossAttack(state: GameState, e: Enemy, name: string): void {
  if (e.boss === null) return;
  switch (name) {
    case 'summon_hulks':
      summonHulks(state, e);
      enterPhase(state, e, 2);
      return;
    case 'flood':
      floodArena(state, e);
      enterPhase(state, e, 2);
      e.boss.chillNeedsWater = true;
      setSuperheat(state, e, true);
      return;
    case 'call_storm':
      enterPhase(state, e, 3);
      startBrazierStorm(state, e);
      return;
  }
}

const D = 0.7071067811865476;
// prettier-ignore
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [D, D], [-D, -D], [D, -D], [-D, D],
];

/** Tar Hulks around the Matriarch on open ground, first on her left and right, then wherever fits. */
function summonHulks(state: GameState, e: Enemy): void {
  const T = state.tuning.bosses;
  const spawned: number[] = [];
  const r = enemyDef('tar_hulk').radius;
  for (let k = 0; k < DIRS.length && spawned.length < T.matriarchSummonCount; k++) {
    const [dx, dy] = DIRS[k]!;
    const x = e.x + dx * T.matriarchSummonDistance;
    const y = e.y + dy * T.matriarchSummonDistance;
    if (circleOverlapsSolid(state.room, x, y, r)) continue;
    const h = spawnEnemy(state, 'tar_hulk', x, y, { areaLevel: e.areaLevel, parentId: e.id });
    aggro(state, h);
    spawned.push(h.id);
  }
  emit(state, { type: 'bossSummon', id: e.id, kind: 'tar_hulk', spawned, x: e.x, y: e.y });
}
