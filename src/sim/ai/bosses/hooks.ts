/**
 * What boss attacks do when they land, besides damage (called by resolveEnemyAttack,
 * combat/enemyAttacks.ts):
 * - summon_hulks (Tar Matriarch at half life): her tar crew appears around her, aggroed:
 *   tuning.bosses.matriarchSummonCount Tar Hulks and matriarchSummonTinderlings Tinderlings, whose
 *   fire lights her tar (one 'bossSummon' per kind); phase 2.
 * - flood (Cinder Warden, phase 2): the channels overflow (flood.ts); he becomes Superheated and
 *   builds chill only in water.
 * - call_storm (Cinder Warden, phase 3): the brazier storm cycle starts (braziers.ts).
 * - M8 toll_foundry (Old Bellwether at half life): one sparkfly_cloud around it; phase 2, its
 *   self-toll clock starts.
 * - M8 coil_dive (Glasswater Coil, phase 2), call_pylons (phase 3: the Body pulse and the pylon
 *   storm start, coilPulse.ts), glass_spit (its bolt lands where the player stood; volleys,
 *   coilSpit.ts).
 */
import { attackByName, enemyDef } from '../../../../data/enemies';
import { packs } from '../../../../data/packs';
import { floatRoom } from '../../actors/locomotion';
import { circleOverlapsSolid } from '../../actors/collision';
import { bossDamageScale, spawnEnemy, type Enemy } from '../../actors/enemies';
import { emit } from '../../events';
import type { GameState } from '../../state';
import { aggro } from '../common';
import { startBrazierStorm } from './braziers';
import { floodArena } from './flood';
import { startCoilStorm } from './coilPulse';
import { landSpit } from './coilSpit';
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
    case 'toll_foundry':
      summonCloud(state, e);
      enterPhase(state, e, 2);
      if (e.boss.fen) e.boss.fen.tollLeft = state.tuning.bosses.bellwetherTollFirst;
      return;
    case 'self_toll':
      emit(state, {
        type: 'bellSelfToll',
        id: e.id,
        damage: (attackByName(e.kind, 'self_toll')?.damage ?? 0) * bossDamageScale(state, e),
        x: e.x,
        y: e.y,
      });
      return;
    case 'coil_dive':
      enterPhase(state, e, 2);
      return;
    case 'call_pylons':
      enterPhase(state, e, 3);
      startCoilStorm(state, e);
      return;
    case 'glass_spit':
      landSpit(state, e);
      return;
  }
}

/** The Old Bellwether tolls the Foundry: one sparkfly_cloud around it, aggroed (CONTENT §5). */
function summonCloud(state: GameState, e: Enemy): void {
  const m = packs.sparkfly_cloud.members[0];
  const n = m.min + state.aiRng.int(m.max - m.min + 1);
  const dist = state.tuning.bosses.bellwetherSummonDistance;
  const r = enemyDef(m.kind).radius;
  const spawned: number[] = [];
  for (let k = 0; k < n; k++) {
    const [dx, dy] = DIRS[k % DIRS.length]!;
    const ring = dist + Math.floor(k / DIRS.length) * 2;
    const x = e.x + dx * ring;
    const y = e.y + dy * ring;
    if (circleOverlapsSolid(floatRoom(state.room), x, y, r)) continue;
    const s = spawnEnemy(state, m.kind, x, y, { areaLevel: e.areaLevel, parentId: e.id });
    aggro(state, s);
    spawned.push(s.id);
  }
  emit(state, { type: 'bossSummon', id: e.id, kind: m.kind, spawned, x: e.x, y: e.y });
}

const D = 0.7071067811865476;
// prettier-ignore
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [D, D], [-D, -D], [D, -D], [-D, D],
];

/** Her tar crew: Tar Hulks, then Tinderlings, around her. */
function summonHulks(state: GameState, e: Enemy): void {
  const T = state.tuning.bosses;
  summonRing(state, e, 'tar_hulk', T.matriarchSummonCount, T.matriarchSummonDistance, 0);
  summonRing(state, e, 'tinderling', T.matriarchSummonTinderlings, T.matriarchTinderlingDistance, 4);
}

/**
 * `count` enemies of `kind` around the Matriarch at `dist` cells on open ground, trying DIRS from
 * `first` on (Hulks: her left and right first; Tinderlings: the diagonals), then wherever fits.
 */
function summonRing(
  state: GameState,
  e: Enemy,
  kind: 'tar_hulk' | 'tinderling',
  count: number,
  dist: number,
  first: number,
): void {
  if (count <= 0) return;
  const spawned: number[] = [];
  const r = enemyDef(kind).radius;
  for (let n = 0; n < DIRS.length && spawned.length < count; n++) {
    const [dx, dy] = DIRS[(first + n) % DIRS.length]!;
    const x = e.x + dx * dist;
    const y = e.y + dy * dist;
    if (circleOverlapsSolid(state.room, x, y, r)) continue;
    const h = spawnEnemy(state, kind, x, y, { areaLevel: e.areaLevel, parentId: e.id });
    aggro(state, h);
    spawned.push(h.id);
  }
  emit(state, { type: 'bossSummon', id: e.id, kind, spawned, x: e.x, y: e.y });
}
