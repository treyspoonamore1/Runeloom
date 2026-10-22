/** M6 rift generator, terrain suffixes and solver. */
import { describe, expect, it } from 'vitest';
import { RIFT_TIERS, riftLayout, riftMods, type RiftModId } from '../../../data/rift';
import { generateRift, parseRoom, solveRift, type RiftSpec } from '../../../src/sim';
import { Rng } from '../../../src/sim/core/rng';
import { applyRiftTerrain } from '../../../src/sim/world/rift/terrain';
import { ROOMS } from './worldHelpers';

const SUFFIXES = (Object.keys(riftMods) as RiftModId[]).filter((id) => riftMods[id].kind === 'suffix');

function spec(seed: number, tier = 1, mods: RiftModId[] = []): RiftSpec {
  return { index: 3, seed, tier, mods, home: { roomId: 'emberwood/e1_glade', key: 'stone' } };
}

describe('rift generator', () => {
  it('is deterministic per seed', () => {
    const a = generateRift(spec(77, 5, ['teeming', 'floodplain']), ROOMS);
    const b = generateRift(spec(77, 5, ['teeming', 'floodplain']), ROOMS);
    expect(b.rooms).toEqual(a.rooms);
    expect(b.plan).toEqual(a.plan);
    const c = generateRift(spec(78, 5, ['teeming', 'floodplain']), ROOMS);
    expect(c.rooms).not.toEqual(a.rooms);
  });

  it('builds 6–10 rooms plus a boss room, ids under rift/<index>/', () => {
    for (let seed = 0; seed < 50; seed++) {
      const r = generateRift(spec(seed), ROOMS);
      const n = r.plan.length - 1;
      expect(n).toBeGreaterThanOrEqual(riftLayout.minRooms);
      expect(n).toBeLessThanOrEqual(riftLayout.maxRooms);
      expect(r.plan[0]!.id).toBe('rift/3/entry');
      expect(r.plan[r.plan.length - 1]!.id).toBe('rift/3/boss');
      for (const id of Object.keys(r.rooms)) expect(id.startsWith('rift/3/')).toBe(true);
      expect(new Set(r.plan.map((p) => `${p.gx},${p.gy}`)).size).toBe(r.plan.length);
    }
  });

  it('never puts the same chunk in two joined rooms', () => {
    for (let seed = 0; seed < 50; seed++) {
      const r = generateRift(spec(seed), ROOMS);
      const byId = new Map(r.plan.map((p) => [p.id, p]));
      for (const p of r.plan)
        for (const other of Object.values(p.exits)) expect(byId.get(other!)!.template).not.toBe(p.template);
    }
  });

  it('writes the area level, home exits, the boss spawn and the boss door', () => {
    const r = generateRift(spec(9, 16), ROOMS);
    const entry = parseRoom(r.rooms[r.entryId]!);
    expect(entry.header.level).toBe(30);
    expect(entry.header.exits).toContainEqual({ dir: 's', room: 'emberwood/e1_glade' });
    const boss = parseRoom(r.rooms[r.bossId]!);
    expect(boss.header.exits).toContainEqual({ dir: 'n', room: 'emberwood/e1_glade' });
    expect(boss.header.spawns.map((s) => s.id)).toEqual([r.bossKind]);
    expect(boss.header.links).toContainEqual({ door: 'D', condition: 'cleared' });
  });

  it('keeps Tinderling packs out of the oil and bramble chunks', () => {
    for (let seed = 0; seed < 300; seed++) {
      const r = generateRift(spec(seed, 6), ROOMS);
      for (const p of r.plan) {
        if (!/oilworks|thicket/.test(p.template)) continue;
        expect(r.rooms[p.id]).not.toMatch(/pack:(tinderling_swarm|tar_crew)/);
      }
    }
  });

  it('walls off sockets nothing is joined to', () => {
    const r = generateRift(spec(4), ROOMS);
    for (const p of r.plan) {
      const data = parseRoom(r.rooms[p.id]!);
      const edges = new Set(data.header.exits.map((e) => e.dir));
      const text = data.rows.join('\n');
      if (!edges.has('w')) expect(text).not.toContain('<');
      if (!edges.has('e')) expect(text).not.toContain('>');
      if (!edges.has('n')) expect(data.rows[0]).not.toContain('^');
      if (!edges.has('s')) expect(data.rows[data.rows.length - 1]).not.toContain('v');
    }
  });
});

describe('rift solver (acceptance: every rift connected and completable)', () => {
  // `npm run sim -- --rifts --count 1000` runs the full 1,000 per tier; this samples each tier.
  it('solves sampled rifts of every tier with every suffix combination', () => {
    const bad: string[] = [];
    for (let tier = 1; tier <= RIFT_TIERS; tier++)
      for (let k = 0; k < 40; k++) {
        const mods = SUFFIXES.filter((_, i) => ((k * 11 + tier) >> i) & 1).slice(0, 2);
        const r = generateRift(spec(k * 7919 + tier * 104729, tier, ['hardened', ...mods]), ROOMS);
        const res = solveRift(r);
        if (!res.ok) bad.push(...res.problems);
      }
    expect(bad).toEqual([]);
  });

  it('reports a blocked socket', () => {
    const r = generateRift(spec(5), ROOMS);
    const room = r.plan[1]!;
    const edge = Object.keys(room.exits)[0] as 'n' | 'e' | 's' | 'w';
    const ch = { w: '<', e: '>', n: '^', s: 'v' }[edge];
    r.rooms[room.id] = r.rooms[room.id]!.split('\n')
      .map((line) => (line.startsWith('@') ? line : line.replaceAll(ch, '#')))
      .join('\n');
    expect(solveRift(r).ok).toBe(false);
  });
});

describe('rift terrain suffixes', () => {
  const grid = () =>
    ['#######', '#.~w,O#', '#.....#', '#.....#', '#.....#', '#..:..#', '#######'].map((r) => r.split(''));
  const apply = (mod: RiftModId, keepClear: { x: number; y: number } | null = null) => {
    const rows = grid();
    applyRiftTerrain(rows, [mod], new Rng(1), keepClear);
    return rows.map((r) => r.join(''));
  };

  it('Drought dries water to dirt and oily water to oil', () => {
    expect(apply('drought')[1]).toBe('#.,,,o#');
  });
  it('Permafrost freezes water', () => {
    expect(apply('permafrost')[1]).toBe('#.ii,O#');
  });
  it('Tinderbox turns floor into grass', () => {
    const rows = apply('tinderbox');
    expect(rows[2]).toBe('#"""""#');
    expect(rows[5]).toBe('#"""""#');
  });
  it('Floodplain floods about 40% of floor, never walls or exits', () => {
    const rows: string[][] = [];
    for (let y = 0; y < 60; y++) rows.push(['#', ...'.'.repeat(60), '<']);
    applyRiftTerrain(rows, ['floodplain'], new Rng(3));
    const flat = rows.flat();
    const share = flat.filter((c) => c === '~').length / (60 * 60);
    expect(share).toBeGreaterThan(0.35);
    expect(share).toBeLessThan(0.45);
    expect(flat.filter((c) => c === '#').length).toBe(60);
    expect(flat.filter((c) => c === '<').length).toBe(60);
  });
  it('Live Wires places pylons only inside open floor, spaced apart, off the kept-clear tile', () => {
    const rows: string[][] = [];
    for (let y = 0; y < 12; y++) rows.push([...'.'.repeat(12)]);
    applyRiftTerrain(rows, ['live_wires'], new Rng(2), { x: 6, y: 6 });
    const pylons: [number, number][] = [];
    rows.forEach((r, y) => r.forEach((c, x) => c === 'M' && pylons.push([x, y])));
    expect(pylons.length).toBe(riftMods.live_wires.extraPylons);
    for (const [x, y] of pylons) {
      expect(x >= 2 && x <= 9 && y >= 2 && y <= 9).toBe(true);
      expect(Math.abs(x - 6) > 2 || Math.abs(y - 6) > 2).toBe(true);
    }
    for (const a of pylons)
      for (const b of pylons)
        if (a !== b) expect(Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]))).toBeGreaterThan(2);
  });
  it('keeps the entry center clear under Live Wires', () => {
    for (let seed = 0; seed < 100; seed++) {
      const r = generateRift(spec(seed, 1, ['live_wires']), ROOMS);
      const rows = parseRoom(r.rooms[r.entryId]!).rows;
      for (let y = 8; y <= 12; y++) expect(rows[y]!.slice(14, 19)).not.toContain('M');
    }
  });
});
