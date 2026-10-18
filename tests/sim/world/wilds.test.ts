import { describe, expect, it } from 'vitest';
import { MAT } from '../../../data/materials';
import { findScene } from '../../../src/app/scenes';
import {
  circleOverlapsSolid,
  createGame,
  edgeSpawnTiles,
  kiterInput,
  pickSpawnPoint,
  SIM_HZ,
  spawnGroup,
  NEUTRAL_INPUT,
  startArenaWave,
  step,
  TILE_CELLS,
  type GameState,
} from '../../../src/sim';
import { loadRoomText } from '../../../tools/lib/rooms';

const wilds = (): GameState => createGame({ seed: 1, roomText: loadRoomText('test/wilds'), mode: 'arena' });

describe('scenes', () => {
  it('arena is the Wilds and arena_flat keeps the old flat arena; the M0 room and the lab are unchanged or new', () => {
    expect(findScene('arena')).toMatchObject({ roomId: 'test/wilds', mode: 'arena' });
    expect(findScene('arena_flat')).toMatchObject({ roomId: 'test/arena', mode: 'arena' });
    expect(findScene('room')).toMatchObject({ roomId: 'test/m0_room' });
    expect(findScene('room')!.mode).toBeUndefined();
    expect(findScene('lab')).toMatchObject({ roomId: 'test/lab' });
    expect(findScene('lab')!.mode ?? 'sandbox').toBe('sandbox');
  });
});

describe('test/wilds', () => {
  it('has the terrain M3 shows off', () => {
    const g = wilds().grid;
    const count = (m: keyof typeof MAT): number => g.ground.filter((c) => c === MAT[m]).length;
    for (const m of [
      'grass',
      'shallow_water',
      'deep_water',
      'wood',
      'mud',
      'metal_floor',
      'metal_pylon',
      'bramble',
      'crate',
      'oil_barrel',
      'wall',
    ] as const)
      expect(count(m), m).toBeGreaterThan(0);
    expect(g.surface.some((s) => s === 1)).toBe(true);
    expect(count('oil_barrel')).toBe(2 * TILE_CELLS * TILE_CELLS);
  });

  it('has walkable edges for wave spawns, far from the start', () => {
    const state = wilds();
    const tiles = edgeSpawnTiles(state.room, state.tuning.arena.spawnEdgeTiles);
    expect(tiles.length).toBeGreaterThan(100);
  });

  it('picks wave spawn points on open ground, at least 25 cells from the player', () => {
    const state = wilds();
    const p = { x: 0, y: 0 };
    for (let i = 0; i < 300; i++) {
      pickSpawnPoint(state, p);
      expect(circleOverlapsSolid(state.room, p.x, p.y, 1.5), `spawn ${i} at ${p.x}, ${p.y}`).toBe(false);
      expect(Math.hypot(p.x - state.player.x, p.y - state.player.y)).toBeGreaterThanOrEqual(25);
    }
  });

  it('runs a wave: 6 Tinderlings appear and hunt the player', () => {
    const state = wilds();
    startArenaWave(state, 1);
    for (let i = 0; i < 60 * 8; i++) step(state, NEUTRAL_INPUT);
    expect(state.enemies.length).toBe(6);
    for (const e of state.enemies) expect(e.ai.mode).not.toBe('idle');
  });

  it('stays fair to the kiter bot: it clears the 20-enemy wave in arena mode without dying', () => {
    const state = createGame({
      seed: 1,
      roomText: loadRoomText('test/wilds'),
      mode: 'arena',
      spawnRoomEnemies: false,
    });
    spawnGroup(state, { tinderling: 12, ember_archer: 5, shieldbearer: 3 }, 1);
    let deaths = 0;
    for (let i = 0; i < 90 * SIM_HZ && state.enemies.length > 0; i++) {
      step(state, kiterInput(state));
      for (const e of state.events) if (e.type === 'playerDeath') deaths++;
    }
    expect(deaths).toBe(0);
    expect(state.enemies).toHaveLength(0);
  }, 30_000);
});
