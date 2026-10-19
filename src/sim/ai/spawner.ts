import type { BehaviorDef } from '../../../data/enemies';
import { enemyDef } from '../../../data/enemies';
import { circleOverlapsSolid } from '../actors/collision';
import { spawnEnemy, type Enemy } from '../actors/enemies';
import { attackSpeedMult } from '../actors/rarity';
import { actionSpeed } from '../combat/ailments';
import { DT } from '../core/constants';
import { emit } from '../events';
import type { GameState } from '../state';
import { aggro, deaggro, measurePlayer, setMode, toPlayer } from './common';

type Spawner = Extract<BehaviorDef, { kind: 'spawner' }>;

const D = 0.7071067811865476;
// Spawn directions tried, clockwise from +x; the start rotates with each batch.
// prettier-ignore
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [D, D], [0, 1], [-D, D], [-1, 0], [-D, -D], [0, -1], [D, -D],
];

/**
 * Brood Kiln (CONTENT §5): never moves. It wakes when the player comes within aggroRange (or it
 * is hurt; no sight needed, it sits inside its own solid tile), then spawns `count` of its brood
 * at once and every `interval` s (÷ Hasted), up to `maxAlive` of its brood alive, around itself
 * on open ground; they arrive aggroed. EnemyAI.cooldowns[0] is the spawn timer. Frozen kilns are
 * skipped by the movement phase, so the timer stops and nothing spawns (CONTENT §5).
 */
export function stepSpawner(state: GameState, e: Enemy, b: Spawner): void {
  const ai = e.ai;
  e.vx = e.vy = 0;
  if (state.player.dead) {
    if (ai.mode !== 'idle') deaggro(e);
    return;
  }
  measurePlayer(state, e);
  const range = enemyDef(e.kind).aggroRange;
  if (ai.mode === 'idle') {
    if (toPlayer.dist > range && e.life >= e.maxLife && state.mode !== 'arena') return;
    aggro(state, e);
    ai.cooldowns[0] = 0;
  } else if (toPlayer.dist > state.tuning.ai.leashRange) {
    deaggro(e);
    return;
  }
  setMode(e, 'brood');
  const t = ai.cooldowns[0]! - DT * actionSpeed(state, e);
  if (t > 0) {
    ai.cooldowns[0] = t;
    return;
  }
  ai.cooldowns[0] = t + b.interval / attackSpeedMult(e);
  spawnBrood(state, e, b);
}

function spawnBrood(state: GameState, e: Enemy, b: Spawner): void {
  let alive = 0;
  for (const o of state.enemies) if (!o.dead && o.special.parentId === e.id) alive++;
  const n = b.count < b.maxAlive - alive ? b.count : b.maxAlive - alive;
  if (n <= 0) return;
  const r = enemyDef(b.spawn as Enemy['kind']).radius;
  const spawned: number[] = [];
  const start = state.aiRng.int(DIRS.length);
  for (let k = 0; k < DIRS.length && spawned.length < n; k++) {
    const [dx, dy] = DIRS[(start + k) % DIRS.length]!;
    const x = e.x + dx * b.distance;
    const y = e.y + dy * b.distance;
    if (circleOverlapsSolid(state.room, x, y, r)) continue;
    const m = spawnEnemy(state, b.spawn, x, y, { areaLevel: e.areaLevel, parentId: e.id });
    aggro(state, m);
    spawned.push(m.id);
  }
  if (spawned.length > 0) emit(state, { type: 'kilnSpawn', id: e.id, spawned, x: e.x, y: e.y });
}
