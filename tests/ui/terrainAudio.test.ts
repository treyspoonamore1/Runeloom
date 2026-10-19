import { describe, expect, it } from 'vitest';
import { sfx, terrainAudio } from '../../data/sfx';
import { terrainCues, TerrainSoundTracker } from '../../src/audio/terrainCues';
import { createGame, type GameState, type SimEvent } from '../../src/sim';
import arenaText from '../../data/rooms/test/arena.txt?raw';

const state = (): GameState => createGame({ seed: 1, roomText: arenaText, spawnRoomEnemies: false });
const box = (count: number) => ({ count, minX: 10, minY: 20, maxX: 13, maxY: 21 });
const zap = (type: 'waterElectrified' | 'metalElectrified', cells: number, handoff = false): SimEvent => ({
  type,
  chargeId: 1,
  x: 5,
  y: 6,
  cells,
  owner: 1,
  sourceId: 0,
  handoff,
});

/** Sets the cells of a w × h box at (x, y) burning. */
function burn(s: GameState, x: number, y: number, w: number, h: number): void {
  for (let cy = y; cy < y + h; cy++) for (let cx = x; cx < x + w; cx++) s.grid.fire[cy * s.grid.width + cx] = 192;
}

/** Plays `seconds` of frames at 60 fps and returns the cues. */
function run(t: TerrainSoundTracker, s: GameState, seconds: number, events: SimEvent[] = []): { id: string; gain?: number; x?: number }[] {
  const out = [];
  for (let f = 0; f < seconds * 60; f++) out.push(...t.cues(f === 0 ? events : [], s, 1 / 60));
  return out;
}

describe('terrainCues', () => {
  it('maps grid events to positioned terrain sounds', () => {
    const ids = (e: SimEvent) => terrainCues(e).map((c) => c.id);
    expect(ids({ type: 'steam', ...box(9) })).toEqual(['steamHiss']);
    expect(ids({ type: 'iceFormed', ...box(30) })).toEqual(['iceForm']);
    expect(ids({ type: 'iceBreaking', ...box(4) })).toEqual(['iceCrack']);
    expect(ids({ type: 'iceBroke', ...box(4) })).toEqual(['iceBreak']);
    expect(ids({ type: 'explosion', x: 3, y: 4, radius: 4, damage: 30, owner: 0, sourceId: 0 })).toEqual(['explosionBoom']);
    const c = terrainCues({ type: 'steam', ...box(9) })[0]!;
    expect([c.x, c.y]).toEqual([12, 21]);
  });

  it('leaves single-cell spread to the fire bed and whooshes on real ignitions', () => {
    expect(terrainCues({ type: 'cellIgnited', ...box(1) })).toEqual([]);
    const big = terrainCues({ type: 'cellIgnited', ...box(terrainAudio.whooshMinCells) });
    expect(big.map((c) => c.id)).toEqual(['igniteWhoosh']);
  });

  it('zaps bigger for bigger networks, by medium, softer on a hand-off', () => {
    const one = (e: SimEvent) => terrainCues(e)[0]!;
    expect(one(zap('waterElectrified', 20)).id).toBe('zapWater');
    expect(one(zap('waterElectrified', terrainAudio.bigNetwork)).id).toBe('zapWaterBig');
    expect(one(zap('metalElectrified', 20)).id).toBe('zapMetal');
    expect(one(zap('metalElectrified', 999)).id).toBe('zapMetalBig');
    expect(one(zap('waterElectrified', 20)).gain!).toBeLessThan(one(zap('waterElectrified', 140)).gain!);
    expect(one(zap('metalElectrified', 20, true)).gain!).toBeLessThan(one(zap('metalElectrified', 20)).gain!);
  });

  it('keeps the frequent terrain sounds quiet and rate-limited', () => {
    expect(sfx.fireCrackle.gain).toBeLessThanOrEqual(0.2);
    expect(sfx.fireCrackle.minGapMs).toBeGreaterThanOrEqual(30);
    expect(sfx.fireCrackle.priority).toBe(0);
    for (const id of ['igniteWhoosh', 'steamHiss', 'iceForm', 'iceCrack', 'zapWater', 'zapMetal'] as const)
      expect(sfx[id].minGapMs).toBeGreaterThanOrEqual(100);
    expect(sfx.explosionBoom.priority).toBeGreaterThan(sfx.fireCrackle.priority);
  });
});

describe('TerrainSoundTracker fire bed', () => {
  it('is silent with nothing burning', () => {
    const s = state();
    expect(run(new TerrainSoundTracker(() => 0.5), s, 2)).toEqual([]);
  });

  it('crackles faster and louder as more cells burn, never one sound per cell', () => {
    const small = state();
    burn(small, Math.floor(small.player.x), Math.floor(small.player.y), 2, 2);
    const big = state();
    burn(big, Math.floor(big.player.x) - 20, Math.floor(big.player.y) - 10, 40, 20);
    const a = run(new TerrainSoundTracker(() => 0.5), small, 3);
    const b = run(new TerrainSoundTracker(() => 0.5), big, 3);
    expect(a.every((c) => c.id === 'fireCrackle')).toBe(true);
    expect(b.length).toBeGreaterThan(a.length * 2);
    expect(b.length).toBeLessThanOrEqual(3 / terrainAudio.fastest / 0.6 + 1);
    expect(b[0]!.gain!).toBeGreaterThan(a[0]!.gain!);
  });

  it('places the crackle at the burning cells (so it pans)', () => {
    const s = state();
    const x = Math.floor(s.player.x) + 30;
    burn(s, x, Math.floor(s.player.y), 4, 4);
    const c = run(new TerrainSoundTracker(() => 0.5), s, 1)[0]!;
    expect(c.x).toBeCloseTo(x + 2, 5);
  });

  it('ignores fires far off screen', () => {
    const s = state();
    burn(s, 0, 0, 2, 2);
    s.player.x = s.grid.width - 2;
    s.player.y = s.grid.height - 2;
    if (s.grid.width - 4 > terrainAudio.viewHalfW * 2) expect(run(new TerrainSoundTracker(), s, 1)).toEqual([]);
  });
});

describe('TerrainSoundTracker crumble', () => {
  it('crumbles when a burn-out changes walkability, not for grass turning to ash', () => {
    const s = state();
    const t = new TerrainSoundTracker(() => 0.5);
    t.cues([], s, 1 / 60);
    const burnt: SimEvent = { type: 'burntOut', ...box(16) };
    expect(t.cues([burnt], s, 1 / 60).map((c) => c.id)).toEqual([]);
    s.grid.walkVersion++;
    expect(t.cues([burnt], s, 1 / 60).map((c) => c.id)).toEqual(['burntCrumble']);
    expect(t.cues([burnt], s, 1 / 60).map((c) => c.id)).toEqual([]);
  });
});
