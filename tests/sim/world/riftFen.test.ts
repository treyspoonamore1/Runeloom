/**
 * CONTENT §10.1 (BUILD_PLAN M8 phase 1 task 8): the Fen in rifts. From tier 9 the Fen's three
 * chunks (reedmarsh, pylon_flats, sluiceworks) and its packs join the pools; below it rifts are
 * built exactly as before. Water-only packs (pike_shoal) are only picked for markers in water.
 * The full acceptance run (1,000 rifts per tier 9–16) is `npm run sim -- --rifts --count 1000`.
 */
import { describe, expect, it } from 'vitest';
import { packs, type PackDef, type PackId } from '../../../data/packs';
import { riftChunkFromTier, riftChunksAt, riftSpawns, type RiftModId } from '../../../data/rift';
import { runeDiscovery } from '../../../data/progression';
import type { RuneId } from '../../../data/runes';
import {
  createGame,
  generateRift,
  parseRoom,
  rollKillLoot,
  solveRift,
  spawnEnemy,
  unlockRune,
  type RiftSpec,
} from '../../../src/sim';
import { rollDiscovery } from '../../../src/sim/items/drops';
import { adventure } from '../hero/helpers';
import { ROOMS } from './worldHelpers';

const FEN_CHUNKS = ['reedmarsh', 'pylon_flats', 'sluiceworks'] as const;
const FEN_PACKS: readonly string[] = [
  'pike_shoal',
  'crab_cast',
  'heron_wade',
  'sparkfly_cloud',
  'mire_herd',
  'foundry_crew',
  'toad_chorus',
];
const SUFFIXES: RiftModId[] = [
  'drought',
  'floodplain',
  'live_wires',
  'permafrost',
  'tinderbox',
  'choking_smoke',
  'gale',
];

function spec(seed: number, tier: number, mods: RiftModId[] = []): RiftSpec {
  return { index: 2, seed, tier, mods, home: { roomId: 'emberwood/e1_glade', key: 'stone' } };
}

const chunkOf = (template: string) => template.replace(/^rift\/(chunks|bosses)\//, '');
const spawnsOf = (text: string) => text.split('\n').filter((l) => l.startsWith('@spawn '));

describe('the Fen in rifts (CONTENT §10.1)', () => {
  it('the Fen chunks join the pool from tier 9', () => {
    for (const c of FEN_CHUNKS) expect(riftChunkFromTier[c]).toBe(9);
    for (let t = 1; t <= 8; t++) for (const c of FEN_CHUNKS) expect(riftChunksAt(t)).not.toContain(c);
    for (let t = 9; t <= 16; t++) for (const c of FEN_CHUNKS) expect(riftChunksAt(t)).toContain(c);
  });

  it('every Fen pack spawns from tier 9 (slagshells from 10); none earlier', () => {
    for (const p of FEN_PACKS) {
      const s = riftSpawns.find((x) => 'pack' in x && x.pack === p);
      expect(s, p).toBeDefined();
      expect(s!.fromTier).toBe(9);
    }
    expect(riftSpawns.find((x) => 'enemy' in x && x.enemy === 'slagshell')!.fromTier).toBe(10);
    expect(riftSpawns.find((x) => 'enemy' in x && x.enemy === 'bellshell')!.fromTier).toBe(9);
    const lowSeen = new Set<string>();
    const highChunks = new Set<string>();
    const highSpawns = new Set<string>();
    for (let seed = 0; seed < 120; seed++) {
      const low = generateRift(spec(seed, 1 + (seed % 8)), ROOMS);
      for (const p of low.plan) lowSeen.add(chunkOf(p.template));
      for (const text of Object.values(low.rooms))
        for (const l of spawnsOf(text)) for (const p of FEN_PACKS) expect(l).not.toContain(`pack:${p}`);
      const high = generateRift(spec(seed, 9 + (seed % 8)), ROOMS);
      for (const p of high.plan) highChunks.add(chunkOf(p.template));
      for (const text of Object.values(high.rooms))
        for (const l of spawnsOf(text)) highSpawns.add(l.split(' ')[2]!);
    }
    for (const c of FEN_CHUNKS) {
      expect(lowSeen).not.toContain(c);
      expect(highChunks).toContain(c);
    }
    for (const p of FEN_PACKS) expect(highSpawns).toContain(`pack:${p}`);
    expect(highSpawns).toContain('enemy:slagshell');
    expect(highSpawns).toContain('enemy:bellshell');
  });

  it('a water-only pack is picked only for a marker in water, after the suffixes', () => {
    let pikes = 0;
    for (let seed = 0; seed < 400; seed++) {
      const mods = seed % 3 === 0 ? [SUFFIXES[seed % SUFFIXES.length]!] : [];
      const r = generateRift(spec(seed, 9 + (seed % 8), mods), ROOMS);
      for (const [id, text] of Object.entries(r.rooms)) {
        if (id === r.bossId) continue;
        const n = parseRoom(text).header.spawns.filter(
          (sp) => sp.kind === 'pack' && (packs[sp.id as PackId] as PackDef).waterOnly === true,
        ).length;
        if (n === 0) continue;
        pikes += n;
        // Each spawns its pack (2–3 Glasspikes): the marker resolves to water in the built room.
        const s = createGame({ seed: 1, roomText: text });
        expect(s.enemies.filter((e) => e.kind === 'glasspike').length, id).toBeGreaterThanOrEqual(2 * n);
      }
    }
    expect(pikes).toBeGreaterThan(10);
  });

  it('rifts with Fen chunks and bosses are connected and completable under every suffix', () => {
    let fenRooms = 0;
    for (let tier = 9; tier <= 16; tier++)
      for (let k = 0; k < 30; k++) {
        const seed = tier * 1000 + k;
        const mods = [SUFFIXES[k % SUFFIXES.length]!, SUFFIXES[(k * 3 + tier) % SUFFIXES.length]!];
        const r = generateRift(spec(seed, tier, [...new Set(mods)]), ROOMS);
        fenRooms += r.plan.filter((p) => FEN_CHUNKS.some((c) => p.template.endsWith(c))).length;
        expect(solveRift(r).problems, `tier ${tier} seed ${seed}`).toEqual([]);
      }
    expect(fenRooms).toBeGreaterThan(100);
  });

  it("Fen chunks and arenas keep the Fen's look (@look) in the rift, whatever their room id", () => {
    const looks = new Map<string, string | undefined>();
    for (let seed = 0; seed < 40; seed++) {
      const r = generateRift(spec(seed, 9 + (seed % 8)), ROOMS);
      for (const p of r.plan) looks.set(chunkOf(p.template), parseRoom(r.rooms[p.id]!).header.look);
    }
    expect(looks.get('reedmarsh')).toBe('fen');
    expect(looks.get('pylon_flats')).toBe('fen');
    expect(looks.get('sluiceworks')).toBe('foundry');
    expect(looks.get('belfry')).toBe('foundry');
    expect(looks.get('glass_eye')).toBe('foundry');
    expect(looks.get('glade')).toBeUndefined();
  });

  it('below tier 9 the Fen changes nothing: the same spec builds the same rooms', () => {
    // Pinned from the generator before the Fen joined (commit 77a2807).
    const texts: string[] = [];
    for (let seed = 0; seed < 40; seed++)
      texts.push(
        ...Object.values(generateRift(spec(seed, 1 + (seed % 8), [SUFFIXES[seed % 6]!]), ROOMS).rooms),
      );
    let h = 2166136261;
    for (const t of texts)
      for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619) >>> 0;
    expect(h.toString(16)).toBe(PRE_FEN_HASH);
  });
});

/** FNV-1a over the room texts of 40 tier 1–8 rifts, generated at 77a2807. */
const PRE_FEN_HASH = '13a3bfa3';

describe('Tide and Gale in rune drops (CONTENT §10.1 Runes)', () => {
  const runesDropped = (state: ReturnType<typeof adventure>, n: number): Set<string> => {
    const out = new Set<string>();
    for (let i = 0; i < n; i++) {
      const e = spawnEnemy(state, 'tinderling', 140, 100, { areaLevel: 25 });
      e.rarity = 'rare';
      for (const c of rollKillLoot(state, e)) if (c.kind === 'rune') out.add(c.rune.rune);
      e.dead = true;
    }
    return out;
  };

  it('drop only once unlocked (the F6 shrine, the Coil), like every rune; discovery never offers them', () => {
    const s = adventure(4);
    const before = runesDropped(s, 1500);
    expect(before).not.toContain('tide');
    expect(before).not.toContain('gale');
    unlockRune(s, 'tide');
    unlockRune(s, 'gale');
    const after = runesDropped(s, 1500);
    expect(after).toContain('tide');
    expect(after).toContain('gale');
    for (const r of Object.keys(runeDiscovery.from)) unlockRune(s, r as RuneId);
    for (let i = 0; i < 50; i++) expect(['tide', 'gale']).not.toContain(rollDiscovery(s, 30, []));
  });
});
