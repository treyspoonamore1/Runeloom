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

  it('leaves ignitions to the tracker (their whoosh depends on how much already burns)', () => {
    expect(terrainCues({ type: 'cellIgnited', ...box(40) })).toEqual([]);
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
    expect(sfx.fireCrackle.bus).toBe('ambient');
    for (const id of ['igniteWhoosh', 'steamHiss', 'iceForm', 'iceCrack', 'zapWater', 'zapMetal'] as const)
      expect(sfx[id].minGapMs).toBeGreaterThanOrEqual(100);
    expect(sfx.explosionBoom.priority).toBeGreaterThan(sfx.fireCrackle.priority);
    // Fire sounds sit under combat sounds (default priority 1) when voices run out.
    for (const id of ['igniteWhoosh', 'burntCrumble', 'steamHiss'] as const) expect(sfx[id].priority).toBe(0);
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
    expect(b.length).toBeGreaterThan(a.length * 1.5);
    // The bed keeps going for its tail after the count, so allow the tail's crackles too.
    expect(b.length).toBeLessThanOrEqual((3 + terrainAudio.tailSeconds) / terrainAudio.fastest / 0.6 + 1);
    // Both start at the quietest level; the big fire swells louder.
    expect(b.at(-1)!.gain!).toBeGreaterThan(a.at(-1)!.gain! + 0.1);
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

describe('TerrainSoundTracker at scale (M4 playtest: rooms burning away)', () => {
  type C = { id: string; gain?: number };
  const crackles = (cs: C[]): C[] => cs.filter((c) => c.id === 'fireCrackle');

  it('saturates the bed early: a room ablaze is no louder or busier than a burning hedge', () => {
    const hedge = state();
    // 160 cells: 10 bramble tiles, the saturation point.
    burn(hedge, Math.floor(hedge.player.x) - 20, Math.floor(hedge.player.y) - 2, 40, 4);
    const room = state();
    burn(room, Math.floor(room.player.x) - 60, Math.floor(room.player.y) - 30, 120, 60);
    const a = crackles(run(new TerrainSoundTracker(() => 0.5), hedge, 6));
    const b = crackles(run(new TerrainSoundTracker(() => 0.5), room, 6));
    expect(b.length).toBeLessThanOrEqual(a.length + 1);
    const loudest = (cs: { gain?: number }[]) => Math.max(...cs.map((c) => c.gain!));
    expect(loudest(b)).toBeLessThanOrEqual(terrainAudio.loudest + 1e-9);
    expect(loudest(b)).toBeCloseTo(loudest(a), 2);
    // At most one crackle per `fastest × 0.6` seconds, however much burns.
    expect(b.length).toBeLessThanOrEqual(6 / (terrainAudio.fastest * 0.6) + 1);
    expect(b.length / 6).toBeLessThan(8);
    expect(terrainAudio.loudest * sfx.fireCrackle.gain).toBeLessThanOrEqual(0.12);
  });

  it('swells smoothly instead of jumping to full', () => {
    const s = state();
    burn(s, Math.floor(s.player.x) - 60, Math.floor(s.player.y) - 30, 120, 60);
    const gains = crackles(run(new TerrainSoundTracker(() => 0.5), s, 3)).map((c) => c.gain!);
    expect(gains[0]!).toBeLessThan(terrainAudio.quietest + 0.1);
    for (let i = 1; i < gains.length; i++) expect(gains[i]!).toBeGreaterThanOrEqual(gains[i - 1]! - 1e-9);
    expect(gains.at(-1)!).toBeGreaterThan(terrainAudio.loudest - 0.05);
  });

  it('fades out over its tail once the fire is out, then goes silent', () => {
    const s = state();
    burn(s, Math.floor(s.player.x) - 20, Math.floor(s.player.y) - 10, 40, 20);
    const t = new TerrainSoundTracker(() => 0.5);
    run(t, s, 2);
    s.grid.fire.fill(0);
    const tail = crackles(run(t, s, terrainAudio.tailSeconds + 0.5));
    expect(tail.length).toBeGreaterThan(1);
    for (let i = 1; i < tail.length; i++) expect(tail[i]!.gain!).toBeLessThan(tail[i - 1]!.gain!);
    expect(run(t, s, 1)).toEqual([]);
  });

  it('whooshes for a lone ignition, even a single bramble cell', () => {
    const s = state();
    const c = run(new TerrainSoundTracker(() => 0.5), s, 0.1, [{ type: 'cellIgnited', ...box(1) }]);
    expect(c.map((x) => x.id)).toContain('igniteWhoosh');
    expect(c.find((x) => x.id === 'igniteWhoosh')!.gain!).toBeGreaterThan(0.5);
  });

  it('spaces whooshes and crumbles out and softens them under a big fire', () => {
    const s = state();
    burn(s, Math.floor(s.player.x) - 60, Math.floor(s.player.y) - 30, 120, 60);
    const t = new TerrainSoundTracker(() => 0.5);
    const out: { id: string; gain?: number }[] = [];
    // A grid tick (every 3rd frame) ignites 40 cells and burns 40 bramble cells out, for 10 s.
    for (let f = 0; f < 600; f++) {
      const ev: SimEvent[] = [];
      if (f % 3 === 0) {
        ev.push({ type: 'cellIgnited', ...box(40) }, { type: 'burntOut', ...box(40) });
        s.grid.walkVersion++;
      }
      out.push(...t.cues(ev, s, 1 / 60));
    }
    const whooshes = out.filter((c) => c.id === 'igniteWhoosh');
    const crumbles = out.filter((c) => c.id === 'burntCrumble');
    // 200 grid ticks: before the M4 fix that was one whoosh per 120 ms (83) and a crumble per 200 ms (50).
    expect(whooshes.length).toBeLessThanOrEqual(10 / terrainAudio.whooshGapMax + 2);
    expect(crumbles.length).toBeLessThanOrEqual(10 / terrainAudio.crumbleGapMax + 2);
    for (const c of [...whooshes.slice(1), ...crumbles.slice(1)]) expect(c.gain!).toBeLessThanOrEqual(terrainAudio.busyGain + 1e-9);
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
