import { describe, expect, it } from 'vitest';
import {
  circleOverlapsSolid,
  compositionSize,
  createGame,
  edgeSpawnTiles,
  hashState,
  killAllEnemies,
  pickSpawnPoint,
  spawnEnemy,
  spawnWave,
  startArenaWave,
  step,
  TILE_CELLS,
  waveAreaLevel,
  waveComposition,
  type GameState,
  type SimEvent,
} from '../../../src/sim';
import { defaultTuning } from '../../../data/tuning';
import { loadRoomText } from '../../../tools/lib/rooms';

const STILL = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 };

function arenaGame(seed = 1): GameState {
  return createGame({ seed, roomText: loadRoomText('test/arena'), mode: 'arena' });
}

function run(state: GameState, seconds: number): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    step(state, STILL);
    all.push(...state.events);
  }
  return all;
}

describe('wave composition', () => {
  it('opens with Tinderlings, then adds archers, then Shieldbearers', () => {
    expect(waveComposition(1)).toEqual({ tinderling: 6 });
    expect(waveComposition(2).ember_archer).toBeGreaterThan(0);
    expect(waveComposition(2).shieldbearer ?? 0).toBe(0);
    expect(waveComposition(3).shieldbearer).toBeGreaterThan(0);
  });

  it('grows by about 2 per wave and shifts toward archers and Shieldbearers', () => {
    let lastShare = 0;
    for (let n = 4; n <= 20; n++) {
      const c = waveComposition(n);
      expect(compositionSize(c)).toBe(6 + 2 * n);
      const share = ((c.ember_archer ?? 0) + (c.shieldbearer ?? 0)) / compositionSize(c);
      expect(share).toBeGreaterThanOrEqual(lastShare - 0.05);
      lastShare = share;
      expect(c.tinderling).toBeGreaterThan(0);
    }
    expect(lastShare).toBeGreaterThan(0.5);
    expect(compositionSize(waveComposition(1000))).toBe(80);
  });

  it('raises the area level by 1 every 3 waves', () => {
    const state = arenaGame();
    expect([1, 2, 3, 4, 6, 7, 10].map((n) => waveAreaLevel(state, n))).toEqual([1, 1, 1, 2, 2, 3, 4]);
    const [e] = spawnWave(state, 7);
    expect(e!.areaLevel).toBe(3);
    // DESIGN §7: life × 1.12^(level − 1).
    expect(e!.maxLife).toBeGreaterThan(18 * 1.12 * 1.12 - 1e-9);
  });
});

describe('spawn points', () => {
  it('are walkable for every M1 body, near the room edge and far from the player', () => {
    const state = arenaGame();
    const room = state.room;
    const t = defaultTuning.arena;
    expect(edgeSpawnTiles(room, t.spawnEdgeTiles).length).toBeGreaterThan(50);
    const out = { x: 0, y: 0 };
    for (const [px, py] of [
      [122, 70],
      [20, 20],
      [220, 120],
    ] as const) {
      state.player.x = px;
      state.player.y = py;
      for (let i = 0; i < 200; i++) {
        pickSpawnPoint(state, out);
        expect(circleOverlapsSolid(room, out.x, out.y, 2)).toBe(false);
        expect(Math.hypot(out.x - px, out.y - py)).toBeGreaterThanOrEqual(t.minSpawnDistance);
        const edge = Math.min(out.x, out.y, room.width - out.x, room.height - out.y);
        expect(edge).toBeLessThanOrEqual((t.spawnEdgeTiles + 1) * TILE_CELLS + t.spawnJitter);
      }
    }
  });

  it('come from the AI stream: same seed same points, and crits are untouched', () => {
    const a = arenaGame(3);
    const b = arenaGame(3);
    const crit = a.combatRng.getState();
    expect(spawnWave(a, 5).map((e) => [e.x, e.y])).toEqual(spawnWave(b, 5).map((e) => [e.x, e.y]));
    expect(a.combatRng.getState()).toEqual(crit);
    expect(spawnWave(arenaGame(4), 5).map((e) => e.x)).not.toEqual(
      spawnWave(arenaGame(3), 5).map((e) => e.x),
    );
  });
});

describe('arena loop', () => {
  it('starts wave 1 after 2 s, trickles it in over ~1.5 s, and runs 3 s intermissions', () => {
    const state = arenaGame();
    expect(state.enemies).toHaveLength(0); // arena mode skips the room's @spawn enemies
    expect(state.arena.phase).toBe('intermission');
    run(state, 1.9);
    expect(state.arena.wave).toBe(0);
    run(state, 0.2);
    expect(state.arena).toMatchObject({ wave: 1, phase: 'fighting', waveSize: 6 });
    expect(state.enemies.length).toBeLessThan(6);
    run(state, 1.5);
    expect(state.enemies).toHaveLength(6);
    expect(state.arena.spawnedTotal).toBe(6);
    expect(state.enemies.every((e) => e.ai.targetId === 0)).toBe(true);

    const deaths = killAllEnemies(state);
    expect(deaths).toBe(6);
    expect(state.events.filter((e) => e.type === 'death')).toHaveLength(6);
    step(state, STILL);
    expect(state.arena).toMatchObject({ phase: 'intermission', killedTotal: 6, remaining: 0 });
    run(state, 2.9);
    expect(state.arena.wave).toBe(1);
    run(state, 0.2);
    expect(state.arena).toMatchObject({ wave: 2, phase: 'fighting', waveSize: 10 });
  });

  it('startArenaWave jumps to a wave; killAllEnemies spares dummies and cancels pending spawns', () => {
    const state = arenaGame();
    const dummy = spawnEnemy(state, 'dummy', 122, 90);
    startArenaWave(state, 9);
    expect(state.arena).toMatchObject({ wave: 9, phase: 'fighting', areaLevel: 3 });
    run(state, 0.5);
    expect(state.enemies.length).toBeGreaterThan(1);
    killAllEnemies(state);
    expect(state.enemies).toEqual([dummy]);
    expect(state.arena.queue).toHaveLength(0);
    step(state, STILL);
    expect(state.arena.phase).toBe('intermission');
  });

  it('never advances outside arena mode', () => {
    const state = createGame({ seed: 1, roomText: loadRoomText('test/arena'), spawnRoomEnemies: false });
    run(state, 6);
    expect(state.arena.wave).toBe(0);
    expect(state.enemies).toHaveLength(0);
  });

  it('god mode keeps a passive player alive through a wave that hits them', () => {
    const state = arenaGame();
    state.cheats.god = true;
    startArenaWave(state, 6);
    const events = run(state, 25);
    const hits = events.filter((e) => e.type === 'hit' && e.target === 'player');
    expect(hits.length).toBeGreaterThan(20);
    expect(events.some((e) => e.type === 'playerDeath')).toBe(false);
    expect(state.player.life).toBe(state.player.maxLife);

    const mortal = arenaGame();
    startArenaWave(mortal, 6);
    expect(run(mortal, 25).some((e) => e.type === 'playerDeath')).toBe(true);
  });

  it('hashes the arena, the AI stream and the AI fields', () => {
    const base = () => {
      const s = arenaGame();
      run(s, 3);
      return s;
    };
    const h0 = hashState(base());
    const mutations: Array<(s: GameState) => void> = [
      (s) => s.aiRng.nextU32(),
      (s) => s.arena.wave++,
      (s) => (s.arena.timer += 0.1),
      (s) => s.arena.killedTotal++,
      (s) => s.arena.queue.push({ kind: 'tinderling', areaLevel: 1, delay: 1 }),
      (s) => (s.enemies[0]!.ai.offsetX += 0.1),
      (s) => (s.enemies[0]!.ai.los = !s.enemies[0]!.ai.los),
      (s) => (s.enemies[0]!.ai.strafeLeft += 0.1),
      (s) => (s.cheats.noAI = true),
    ];
    for (const m of mutations) {
      const s = base();
      m(s);
      expect(hashState(s)).not.toBe(h0);
    }
    expect(hashState(base())).toBe(h0);
  });
});
