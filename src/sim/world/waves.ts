import { enemyDef, type EnemyKind } from '../../../data/enemies';
import { waveTable, type WaveComposition } from '../../../data/waves';
import type { Tuning } from '../../../data/tuning';
import { aggro } from '../ai/common';
import { compactEnemies, spawnEnemy, type Enemy } from '../actors/enemies';
import { DT, TILE_CELLS } from '../core/constants';
import { emit } from '../events';
import type { GameState } from '../state';
import type { Room } from './room';

/** Timers within this many seconds of zero count as expired (absorbs 1/60 rounding). */
const TIME_EPSILON = 1e-9;

/** An enemy of the current wave that hasn't appeared yet. */
export interface PendingSpawn {
  kind: EnemyKind;
  areaLevel: number;
  /** Seconds until it appears. Its position is rolled then, so it is far from the player. */
  delay: number;
}

/**
 * Arena progress (state.mode 'arena'), hashed. The HUD reads it.
 * intermission (timer counts down) → fighting (enemies trickle in from the queue, timer counts
 * up) → once every enemy of the wave is dead, intermission again → next wave.
 */
export interface ArenaState {
  /** Current wave number while fighting, the last one during an intermission; 0 before wave 1. */
  wave: number;
  phase: 'intermission' | 'fighting';
  /** Intermission: seconds until the next wave. Fighting: seconds since the wave started. */
  timer: number;
  /** Enemies the current (or last) wave brings in total. */
  waveSize: number;
  /** Enemies of the wave still alive or yet to appear. */
  remaining: number;
  /** Area level of the current wave's enemies. */
  areaLevel: number;
  /** Enemies spawned by the arena since the game started. */
  spawnedTotal: number;
  /** Enemies killed in arena mode since the game started. */
  killedTotal: number;
  /** The wave's enemies still to come, in spawn order. */
  queue: PendingSpawn[];
}

export function createArenaState(tuning: Tuning, roomLevel: number): ArenaState {
  return {
    wave: 0,
    phase: 'intermission',
    timer: tuning.arena.firstWaveDelay,
    waveSize: 0,
    remaining: 0,
    areaLevel: roomLevel,
    spawnedTotal: 0,
    killedTotal: 0,
    queue: [],
  };
}

/** What wave n (1-based) brings (data/waves.ts). */
export function waveComposition(n: number): WaveComposition {
  const t = waveTable;
  if (n <= t.opening.length) return { ...t.opening[n - 1] };
  const k = n - t.opening.length;
  const raw = Math.round(t.base + t.perWave * n);
  const count = raw < t.maxCount ? raw : t.maxCount;
  const comp: WaveComposition = {};
  let used = 0;
  for (const s of t.shares) {
    const share = s.start + s.perWave * (k - 1);
    const m = Math.round(count * (share < s.max ? share : s.max));
    comp[s.kind] = (comp[s.kind] ?? 0) + m;
    used += m;
  }
  comp[t.filler] = (comp[t.filler] ?? 0) + Math.max(0, count - used);
  return comp;
}

/** Area level of wave n: the room's level, +1 every waveTable.levelEvery waves (DESIGN §7). */
export function waveAreaLevel(state: GameState, n: number): number {
  return state.room.level + Math.floor((n - 1) / waveTable.levelEvery);
}

/** Total enemies in a composition. */
export function compositionSize(comp: WaveComposition): number {
  let n = 0;
  for (const k of Object.keys(comp) as EnemyKind[]) n += comp[k] ?? 0;
  return n;
}

/** The composition as a list of kinds, in a random order from the AI stream (Fisher–Yates). */
function shuffledKinds(state: GameState, comp: WaveComposition): EnemyKind[] {
  const list: EnemyKind[] = [];
  for (const k of Object.keys(comp).sort() as EnemyKind[]) {
    for (let i = 0; i < (comp[k] ?? 0); i++) list.push(k);
  }
  for (let i = list.length - 1; i > 0; i--) {
    const j = state.aiRng.int(i + 1);
    const t = list[i]!;
    list[i] = list[j]!;
    list[j] = t;
  }
  return list;
}

// Spawn tiles per room: derived from walkability only, so caching is safe.
const edgeTileCache = new WeakMap<Room, Map<number, Int32Array>>();

/**
 * Tile indices (ty × tilesW + tx) within `band` tiles of the room's outer edge whose tile and all
 * 8 neighbors are walkable, so any M1 body fits at the tile center. Row-major order.
 */
export function edgeSpawnTiles(room: Room, band: number): Int32Array {
  let byBand = edgeTileCache.get(room);
  if (!byBand) edgeTileCache.set(room, (byBand = new Map()));
  const cached = byBand.get(band);
  if (cached) return cached;
  const out: number[] = [];
  const { tilesW, tilesH } = room;
  const walk = (tx: number, ty: number): boolean => {
    if (tx < 0 || ty < 0 || tx >= tilesW || ty >= tilesH) return false;
    return room.solid[ty * TILE_CELLS * room.width + tx * TILE_CELLS] === 0;
  };
  for (let ty = 0; ty < tilesH; ty++) {
    for (let tx = 0; tx < tilesW; tx++) {
      const edge = Math.min(tx, ty, tilesW - 1 - tx, tilesH - 1 - ty);
      if (edge > band) continue;
      let ok = true;
      for (let oy = -1; oy <= 1 && ok; oy++)
        for (let ox = -1; ox <= 1 && ok; ox++) ok = walk(tx + ox, ty + oy);
      if (ok) out.push(ty * tilesW + tx);
    }
  }
  const tiles = Int32Array.from(out);
  byBand.set(band, tiles);
  return tiles;
}

// Scratch: candidate spawn tiles far enough from the player.
const far: number[] = [];

/**
 * A spawn point (cells) on a random edge tile at least minSpawnDistance from the player, jittered
 * by up to spawnJitter per axis; the farthest edge tile if none is far enough. Uses the AI stream.
 */
export function pickSpawnPoint(state: GameState, out: { x: number; y: number }): void {
  const t = state.tuning.arena;
  const room = state.room;
  const tiles = edgeSpawnTiles(room, t.spawnEdgeTiles);
  const p = state.player;
  // Pad by the jitter's longest reach (both axes: under 2 × jitter), so jittered points stay far.
  const min = t.minSpawnDistance + 2 * t.spawnJitter;
  const min2 = min * min;
  far.length = 0;
  let best = -1;
  let bestD2 = -1;
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i]!;
    const tx = tile % room.tilesW;
    const cx = (tx + 0.5) * TILE_CELLS;
    const cy = ((tile - tx) / room.tilesW + 0.5) * TILE_CELLS;
    const d2 = (cx - p.x) * (cx - p.x) + (cy - p.y) * (cy - p.y);
    if (d2 >= min2) far.push(tile);
    if (d2 > bestD2) {
      bestD2 = d2;
      best = tile;
    }
  }
  if (best < 0) {
    out.x = room.spawnX;
    out.y = room.spawnY;
    return;
  }
  const tile = far.length > 0 ? far[state.aiRng.int(far.length)]! : best;
  const tx = tile % room.tilesW;
  out.x = (tx + 0.5) * TILE_CELLS + state.aiRng.range(-t.spawnJitter, t.spawnJitter);
  out.y = ((tile - tx) / room.tilesW + 0.5) * TILE_CELLS + state.aiRng.range(-t.spawnJitter, t.spawnJitter);
}

const spot = { x: 0, y: 0 };

/** Spawns one aggroed enemy at a fresh spawn point. */
function spawnHunter(state: GameState, kind: EnemyKind, areaLevel: number): Enemy {
  pickSpawnPoint(state, spot);
  const e = spawnEnemy(state, kind, spot.x, spot.y, { areaLevel });
  aggro(state, e);
  state.arena.spawnedTotal++;
  return e;
}

/** Spawns a composition at once, at spawn points from the AI stream, aggroed. Any mode. */
export function spawnGroup(state: GameState, comp: WaveComposition, areaLevel: number): Enemy[] {
  return shuffledKinds(state, comp).map((k) => spawnHunter(state, k, areaLevel));
}

/** Console `wave <n>`-style helper: spawns wave n's enemies at once (any mode). */
export function spawnWave(state: GameState, n: number): Enemy[] {
  return spawnGroup(state, waveComposition(n), waveAreaLevel(state, n));
}

/**
 * Starts arena wave n now: its enemies trickle in over spawnStagger seconds. Waves only advance
 * by themselves in arena mode.
 */
export function startArenaWave(state: GameState, n: number): void {
  const a = state.arena;
  const comp = waveComposition(n);
  const kinds = shuffledKinds(state, comp);
  a.wave = n;
  a.phase = 'fighting';
  a.timer = 0;
  a.areaLevel = waveAreaLevel(state, n);
  a.waveSize = kinds.length;
  const gap = kinds.length > 0 ? state.tuning.arena.spawnStagger / kinds.length : 0;
  a.queue = kinds.map((kind, i) => ({ kind, areaLevel: a.areaLevel, delay: i * gap }));
  a.remaining = liveEnemies(state) + a.queue.length;
}

/**
 * Kills every enemy except immortal dummies, with 'death' events, and cancels pending spawns.
 * Removes them from state.enemies right away. Returns how many died.
 */
export function killAllEnemies(state: GameState): number {
  let n = 0;
  for (const e of state.enemies) {
    if (e.dead || enemyDef(e.kind).immortal) continue;
    e.life = 0;
    e.dead = true;
    e.vx = e.vy = e.kbX = e.kbY = 0;
    emit(state, {
      type: 'death',
      id: e.id,
      kind: e.kind,
      x: e.x,
      y: e.y,
      killerId: -1,
      cause: 'console',
      shattered: false,
    });
    n++;
  }
  if (state.mode === 'arena') state.arena.killedTotal += n;
  state.arena.queue.length = 0;
  compactEnemies(state);
  state.enemyHash.rebuild(state.enemies);
  state.arena.remaining = liveEnemies(state);
  return n;
}

function liveEnemies(state: GameState): number {
  let n = 0;
  for (const e of state.enemies) if (!e.dead && !enemyDef(e.kind).immortal) n++;
  return n;
}

/**
 * The arena's part of a tick, before dead enemies are removed: counts this tick's kills, lets
 * queued enemies in, and moves between intermission and fighting. Does nothing outside arena mode.
 */
export function stepArena(state: GameState): void {
  if (state.mode !== 'arena') return;
  const a = state.arena;
  for (const e of state.enemies) if (e.dead && !enemyDef(e.kind).immortal) a.killedTotal++;

  let kept = 0;
  for (const q of a.queue) {
    if (q.delay <= TIME_EPSILON) spawnHunter(state, q.kind, q.areaLevel);
    else {
      q.delay -= DT;
      a.queue[kept++] = q;
    }
  }
  a.queue.length = kept;
  a.remaining = liveEnemies(state) + a.queue.length;

  if (a.phase === 'intermission') {
    a.timer -= DT;
    if (a.timer <= TIME_EPSILON) startArenaWave(state, a.wave + 1);
  } else {
    a.timer += DT;
    if (a.remaining === 0) {
      a.phase = 'intermission';
      a.timer = state.tuning.arena.intermission;
    }
  }
}
