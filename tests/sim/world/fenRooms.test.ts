/**
 * The Glasswater Fen and Drowned Foundry rooms (M8 phase 1, CONTENT §13): every file parses at its
 * id path with its area level, connects reciprocally along the intended graph (K10's storm door
 * north into G1), holds its Heart Seeds, Loom Shards, Loom Stones, keys, chests and shrine, links
 * its doors as §13 says, and is gated by the verb its room teaches (static tile reachability,
 * roomReach.ts; the scripted solutions prove the verbs open the doors).
 */
import { describe, expect, it } from 'vitest';
import {
  fenRooms,
  guaranteedRuneLevel,
  guaranteedRunes,
  regionRooms,
  roomChests,
} from '../../../data/progression';
import { isPackId } from '../../../data/packs';
import { createAdventure, parseRoom, type RoomData } from '../../../src/sim';
import { spawnMarkerDiffs } from '../../../tools/lib/checks';
import { loadRoomText } from '../../../tools/lib/rooms';
import { find, key, reachable, touches, type Abilities, type Tile } from './roomReach';
import { ROOMS } from './worldHelpers';

type Short = keyof typeof fenRooms;
type Edge = 'w' | 'e' | 'n' | 's';
const ALL_SHORTS = Object.keys(fenRooms) as Short[];

const LEVELS: Record<Short, number> = {
  g1: 18,
  g2: 18,
  g3: 19,
  g4: 19,
  g5: 20,
  g6: 20,
  g7: 20,
  g8: 21,
  f1: 21,
  f2: 21,
  f3: 22,
  f4: 22,
  f5: 22,
  f6: 22,
  f7: 23,
  f8: 23,
  f9: 24,
  f10: 24,
};

/** The graph (CONTENT §13 "Paths"): K10 → G1 → … → G6 → G8, G7 north of G5; F1 → … → F8 hub. */
const GRAPH: Record<Short, Partial<Record<Edge, string>>> = {
  g1: { s: regionRooms.k10, e: fenRooms.g2 },
  g2: { w: fenRooms.g1, e: fenRooms.g3 },
  g3: { w: fenRooms.g2, n: fenRooms.g4 },
  g4: { s: fenRooms.g3, n: fenRooms.g5 },
  g5: { s: fenRooms.g4, n: fenRooms.g7, e: fenRooms.g6 },
  g6: { w: fenRooms.g5, e: fenRooms.g8 },
  g7: { s: fenRooms.g5 },
  g8: { w: fenRooms.g6, e: fenRooms.f1 },
  f1: { w: fenRooms.g8, n: fenRooms.f2 },
  f2: { s: fenRooms.f1, n: fenRooms.f3 },
  f3: { s: fenRooms.f2, e: fenRooms.f4 },
  f4: { w: fenRooms.f3, e: fenRooms.f5 },
  f5: { w: fenRooms.f4, e: fenRooms.f6 },
  f6: { w: fenRooms.f5, e: fenRooms.f7 },
  f7: { w: fenRooms.f6, e: fenRooms.f8 },
  f8: { w: fenRooms.f7, e: fenRooms.f9, n: fenRooms.f10 },
  f9: { w: fenRooms.f8 },
  f10: { s: fenRooms.f8 },
};
/** Where play enters each room (the edge toward the previous room). */
const ENTRY: Record<Short, Edge> = {
  g1: 's',
  g2: 'w',
  g3: 'w',
  g4: 's',
  g5: 's',
  g6: 'w',
  g7: 's',
  g8: 'w',
  f1: 'w',
  f2: 's',
  f3: 's',
  f4: 'w',
  f5: 'w',
  f6: 'w',
  f7: 'w',
  f8: 'w',
  f9: 'w',
  f10: 's',
};
/** The boss arenas (CONTENT §13.2, §13.3) keep the sizes the design gives them. */
const ARENAS: readonly Short[] = ['f5', 'f10'];

const HEART_SEEDS: readonly Short[] = ['g4', 'g7', 'f4', 'f9'];
const LOOM_SHARDS: readonly Short[] = ['g3', 'g5', 'f8'];
const LOOM_STONES: readonly Short[] = ['g1', 'g8', 'f6', 'f10'];
const LINKS: Partial<Record<Short, { door: string; condition: string }[]>> = {
  g1: [{ door: 'D', condition: 'switch:S' }],
  g3: [{ door: 'D', condition: 'switch:S' }],
  g5: [{ door: 'D', condition: 'timer:12:switch:S' }],
  g7: [
    { door: 'D', condition: 'timer:15:braziers:all' },
    { door: 'd', condition: 'vanes:all' },
  ],
  g8: [{ door: 'D', condition: 'switch:S' }],
  f1: [{ door: 'D', condition: 'switch:S' }],
  f2: [{ door: 'D', condition: 'timer:3:switch:S' }],
  f3: [{ door: 'D', condition: 'plates:all' }],
  f5: [{ door: 'D', condition: 'cleared' }],
  f8: [
    { door: 'D', condition: 'switch:S' },
    { door: 'd', condition: 'switch:S' },
  ],
  f9: [{ door: 'D', condition: 'plates:all' }],
  f10: [{ door: 'D', condition: 'sealed' }],
};
const EXIT_CHAR: Record<Edge, string> = { w: '<', e: '>', n: '^', s: 'v' };

const rooms = new Map<Short, RoomData>(ALL_SHORTS.map((s) => [s, parseRoom(loadRoomText(fenRooms[s]))]));
const room = (s: Short): RoomData => rooms.get(s)!;
const entry = (s: Short): Tile => find(room(s), EXIT_CHAR[ENTRY[s]])[0]!;

/** Every tile of `ch` is reached (stood on, or touched for solid objects) with `ab`. */
function reaches(s: Short, ab: Abilities, ch: string): boolean {
  const seen = reachable(room(s), entry(s), ab);
  const tiles = find(room(s), ch);
  return tiles.length > 0 && tiles.every((t) => seen.has(key(t)) || touches(seen, t));
}

/** A tier 8 character's verbs before the Foundry's Tide: Fire, Frost and the doors Storm opens. */
const OVERWORLD: Abilities = { fire: true, frost: true, doors: true };
const EVERYTHING: Abilities = {
  fire: true,
  frost: true,
  doors: true,
  sideDoors: true,
  tide: true,
  bigKey: true,
  keys: 1,
};

describe('Fen and Foundry rooms', () => {
  it.each(ALL_SHORTS)(
    '%s parses at its id path with its CONTENT §13 area level, ASCII, sized like region 1',
    (s) => {
      const r = room(s);
      expect(r.header.id).toBe(fenRooms[s]);
      expect(r.header.name.length).toBeGreaterThan(0);
      expect(r.header.level).toBe(LEVELS[s]);
      expect(r.rows.join('')).toMatch(/^[\x20-\x7e]*$/);
      if (ARENAS.includes(s)) return;
      expect(r.tilesW).toBeGreaterThanOrEqual(40);
      expect(r.tilesW).toBeLessThanOrEqual(80);
      expect(r.tilesH).toBeGreaterThanOrEqual(20);
      expect(r.tilesH).toBeLessThanOrEqual(45);
    },
  );

  it('the boss arenas are the sizes CONTENT gives: the Belfry 104×80 cells, the Glass Eye 128×96', () => {
    expect([room('f5').tilesW * 4, room('f5').tilesH * 4]).toEqual([104, 80]);
    expect([room('f10').tilesW * 4, room('f10').tilesH * 4]).toEqual([128, 96]);
  });

  it.each(ALL_SHORTS)('%s has exactly its graph exits, as edge tiles, and its neighbours point back', (s) => {
    const r = room(s);
    const got = Object.fromEntries(r.header.exits.map((e) => [e.dir, e.room]));
    expect(got).toEqual(GRAPH[s]);
    for (const [dir, n] of Object.entries(GRAPH[s]) as [Edge, string][]) {
      const tiles = find(r, EXIT_CHAR[dir]);
      expect(tiles.length, `${s} ${dir}`).toBeGreaterThan(0);
      const back = parseRoom(ROOMS[n]!).header.exits.find((e) => e.room === r.header.id);
      expect(back?.dir, `${n} back to ${s}`).toBe({ w: 'e', e: 'w', n: 's', s: 'n' }[dir]);
    }
  });

  it("K10's storm door: an exit north to G1 behind a door that needs the Warden, the switch and tier 6", () => {
    const k10 = parseRoom(ROOMS[regionRooms.k10]!);
    expect(k10.header.exits).toEqual([
      { dir: 's', room: regionRooms.k9 },
      { dir: 'n', room: fenRooms.g1 },
    ]);
    expect(k10.header.links).toEqual([
      { door: 'D', condition: 'cleared' },
      { door: 'D', condition: 'switch:S' },
      { door: 'D', condition: 'rifttier:6' },
    ]);
    // The exit tile is reached only through the door.
    const r = k10;
    const start = find(r, 'v')[0]!;
    expect(find(r, '^').some((t) => reachable(r, start, { fire: true, frost: true }).has(key(t)))).toBe(
      false,
    );
    expect(find(r, '^').every((t) => reachable(r, start, { doors: true }).has(key(t)))).toBe(true);
  });

  it('holds 4 Heart Seeds, 3 Loom Shards, its Loom Stones, the Foundry keys, the Tide shrine and two chests', () => {
    const count = (s: Short, ch: string): number => find(room(s), ch).length;
    for (const s of ALL_SHORTS) {
      expect(count(s, 'H'), `${s} H`).toBe(HEART_SEEDS.includes(s) ? 1 : 0);
      expect(count(s, 'L'), `${s} L`).toBe(LOOM_SHARDS.includes(s) ? 1 : 0);
      expect(count(s, 'x'), `${s} x`).toBe(LOOM_STONES.includes(s) ? 1 : 0);
      expect(count(s, 'k'), `${s} k`).toBe(s === 'f3' ? 1 : 0);
      expect(count(s, 'K'), `${s} K`).toBe(s === 'f4' ? 1 : 0);
      expect(count(s, 'g'), `${s} g`).toBe(s === 'f9' ? 1 : 0);
      expect(count(s, 'G') > 0, `${s} G`).toBe(s === 'f8');
      expect(count(s, 'R'), `${s} R`).toBe(s === 'f6' ? 1 : 0);
      expect(count(s, '$'), `${s} $`).toBe(s === 'g7' || s === 'f1' ? 1 : 0);
    }
    expect(Object.keys(roomChests).sort()).toEqual([fenRooms.f1, fenRooms.g7].sort());
  });

  it.each(ALL_SHORTS)('%s links its doors as CONTENT §13 says', (s) => {
    const r = room(s);
    expect(r.header.links).toEqual(LINKS[s] ?? []);
    expect(find(r, 'D').length > 0, `${s} D`).toBe(LINKS[s]?.some((l) => l.door === 'D') ?? false);
    expect(find(r, 'd').length > 0, `${s} d`).toBe(LINKS[s]?.some((l) => l.door === 'd') ?? false);
  });

  it('room headers: G4 pulses every 2 s; fog over G1, G5 and G7; no room wind in the Fen', () => {
    for (const s of ALL_SHORTS) expect(room(s).header.wind, s).toBeUndefined();
    for (const s of ALL_SHORTS) expect(room(s).header.pulse, s).toBe(s === 'g4' ? 2 : undefined);
    for (const s of ALL_SHORTS)
      expect((room(s).header.fog ?? []).length > 0, s).toBe(['g1', 'g5', 'g7'].includes(s));
  });

  it.each(ALL_SHORTS)('%s spawns: every marker declared, known packs', (s) => {
    const d = spawnMarkerDiffs(room(s));
    expect(d.usedNotDeclared).toEqual([]);
    expect(d.declaredNotUsed).toEqual([]);
    for (const sp of room(s).header.spawns) if (sp.kind === 'pack') expect(isPackId(sp.id), sp.id).toBe(true);
  });

  it('guaranteed runes: CONTENT §13.1, at fenRuneLevel', () => {
    const want: Partial<Record<Short, string[]>> = {
      g1: ['storm'],
      g3: ['chain'],
      g4: ['frost'],
      g5: ['sigil'],
      g6: ['saturate'],
      g7: ['lingering'],
      g8: ['pulse'],
      f2: ['split'],
      f4: ['fire'],
      f5: ['on_hit', 'infuse'],
      f6: ['tide'],
      f7: ['swath'],
      f8: ['tide'],
      f9: ['lob'],
      f10: ['gale', 'nova'],
    };
    for (const s of ALL_SHORTS) expect(guaranteedRunes[fenRooms[s]], s).toEqual(want[s]);
    for (const s of ALL_SHORTS) expect(guaranteedRuneLevel(fenRooms[s])).toBe(10);
    expect(guaranteedRuneLevel(regionRooms.k10)).toBe(1);
  });

  it("F8's two switch doors each count only their own sealed switch (the nearest door)", () => {
    const s = createAdventure({ seed: 1, rooms: ROOMS, startRoomId: fenRooms.f8 });
    const sw = s.objects.filter((o) => o.kind === 'sealed_switch');
    expect(sw.map((o) => `${o.tx},${o.ty}:${o.link}`).sort()).toEqual(['20,27:d', '47,15:D']);
  });
});

/**
 * The spawns CONTENT §13 gives each room, by marker. Until the bosses work (`bellwether`,
 * `glasswater_coil`) is merged, F5 and F10 spawn region-1 stand-ins on the same markers
 * (notes/m8-rooms-decisions.md).
 */
const FEN_SPAWNS: Record<Short, string[]> = {
  g1: ['@spawn 1 pack:sparkfly_cloud'],
  g2: ['@spawn 1 pack:pike_shoal', '@spawn 2 pack:mire_herd'],
  g3: ['@spawn 1 pack:crab_cast'],
  g4: ['@spawn 1 pack:heron_wade'],
  g5: ['@spawn 1 pack:toad_chorus', '@spawn 2 pack:sparkfly_cloud'],
  g6: ['@spawn 1 pack:heron_wade', '@spawn 2 pack:mire_herd rare', '@spawn 3 enemy:bellshell'],
  g7: ['@spawn 1 pack:sparkfly_cloud'],
  g8: ['@spawn 1 pack:crab_cast rare', '@spawn 2 pack:heron_wade', '@spawn 3 pack:pike_shoal'],
  f1: ['@spawn 1 pack:crab_cast', '@spawn 2 pack:sparkfly_cloud'],
  f2: ['@spawn 1 pack:heron_wade'],
  f3: ['@spawn 1 enemy:bellshell', '@spawn 2 pack:sparkfly_cloud'],
  f4: ['@spawn 1 pack:foundry_crew'],
  f5: ['@spawn 1 enemy:bellwether'],
  f6: [],
  f7: ['@spawn 1 enemy:slagshell', '@spawn 2 pack:foundry_crew'],
  f8: ['@spawn 1 pack:crab_cast', '@spawn 2 pack:sparkfly_cloud'],
  f9: ['@spawn 1 pack:mire_herd'],
  f10: ['@spawn 1 enemy:glasswater_coil'],
};

describe('Fen and Foundry spawns (CONTENT §13 "Enemies")', () => {
  const BOSS_ROOMS: readonly Short[] = ['f5', 'f10'];
  const spawnLines = (s: Short) =>
    loadRoomText(fenRooms[s])
      .split('\n')
      .filter((l) => l.startsWith('@spawn'));

  it.each(ALL_SHORTS.filter((s) => !BOSS_ROOMS.includes(s)))('%s spawns what CONTENT §13 lists', (s) => {
    expect(spawnLines(s)).toEqual(FEN_SPAWNS[s]);
  });

  // TODO(bosses merge): F5 and F10 spawn stand-ins until `bellwether` and `glasswater_coil` exist.
  it.skip.each(BOSS_ROOMS)('%s spawns its boss', (s) => {
    expect(spawnLines(s)).toEqual(FEN_SPAWNS[s]);
  });

  it.each(ALL_SHORTS)('%s: its stand-in spawns use the same markers as CONTENT §13', (s) => {
    const markers = (lines: string[]) => lines.map((l) => l.split(' ')[1]).sort();
    expect(markers(room(s).header.spawns.map((sp) => `@spawn ${sp.marker}`))).toEqual(markers(FEN_SPAWNS[s]));
  });

  it("the Fen's first Rare is in G6, and G8 has one", () => {
    const rares = (s: Short) => room(s).header.spawns.filter((sp) => sp.rarity === 'rare').length;
    for (const s of ALL_SHORTS) expect(rares(s), s).toBe(s === 'g6' || s === 'g8' ? 1 : 0);
  });
});

describe('Fen and Foundry rooms are gated by what they teach (static reachability)', () => {
  it.each(ALL_SHORTS)('%s: every exit, pickup, chest and shrine is reachable with every verb', (s) => {
    for (const ch of ['<', '>', '^', 'v', 'H', 'L', 'x', 'k', 'g', 'R', '$'])
      if (find(room(s), ch).length > 0) expect(reaches(s, EVERYTHING, ch), `${s} ${ch}`).toBe(true);
  });

  it('overworld rooms need no Tide or Gale for their way on and rewards (G7 cache aside)', () => {
    for (const s of ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8'] as Short[])
      for (const ch of ['<', '>', '^', 'v', 'H', 'L', 'x'])
        if (find(room(s), ch).length > 0) expect(reaches(s, OVERWORLD, ch), `${s} ${ch}`).toBe(true);
  });

  it('Storm (the switch doors): G1, G8 and F1 ways on, G5 east door, the G3 vault, F2 north door', () => {
    const noDoors: Abilities = { fire: true, frost: true };
    expect(reaches('g1', noDoors, '>')).toBe(false);
    expect(reaches('g3', noDoors, 'L')).toBe(false);
    expect(reaches('g3', noDoors, '^')).toBe(true);
    expect(reaches('g5', noDoors, '>')).toBe(false);
    expect(reaches('g5', noDoors, '^')).toBe(true);
    expect(reaches('g8', noDoors, '>')).toBe(false);
    expect(reaches('f1', noDoors, '^')).toBe(false);
    expect(reaches('f2', noDoors, '^')).toBe(false);
  });

  it('Frost: the G4 Heart Seed (the crossing is a soft gate: wading reaches the north exit), the F3 key', () => {
    expect(reaches('g4', { fire: true, doors: true }, 'H')).toBe(false);
    expect(reaches('g4', { fire: true, doors: true }, '^')).toBe(true);
    expect(reaches('g4', OVERWORLD, 'H')).toBe(true);
    // F3's door opens on plates (the frozen-pool slide, scripted); without it, no key.
    expect(reaches('f3', { fire: true, frost: true }, 'k')).toBe(false);
    expect(reaches('f3', { fire: true }, '>')).toBe(true);
  });

  it('Fire: the G5 Loom Shard behind bramble, the F4 Heart Seed behind its barricade; the G7 Heart Seed behind the brazier door', () => {
    expect(reaches('g5', { frost: true, doors: true }, 'L')).toBe(false);
    expect(reaches('g5', OVERWORLD, 'L')).toBe(true);
    expect(reaches('f4', { frost: true, doors: true }, 'H')).toBe(false);
    expect(reaches('f4', OVERWORLD, 'H')).toBe(true);
    expect(reaches('g7', { fire: true, frost: true }, 'H')).toBe(false);
  });

  it('keys: F4 opens on to the Belfry only with F3 small key; F8 north only with F9 big key', () => {
    expect(reaches('f4', OVERWORLD, '>')).toBe(false);
    expect(reaches('f4', { ...OVERWORLD, keys: 1 }, '>')).toBe(true);
    expect(reaches('f8', { ...EVERYTHING, bigKey: false }, '^')).toBe(false);
  });

  it('Tide: F1 alcove, F6 and F7 ways on, F8 east door and vault, F9 big key and Heart Seed', () => {
    const noTide: Abilities = { ...EVERYTHING, tide: false };
    expect(reaches('f1', noTide, '$')).toBe(false);
    expect(reaches('f6', noTide, '>')).toBe(false);
    expect(reaches('f6', noTide, 'R')).toBe(true);
    expect(reaches('f7', noTide, '>')).toBe(false);
    // F8's doors open on Tide + Storm (scripted); F9's chasm needs Tide and Frost together.
    expect(reaches('f8', { ...EVERYTHING, doors: false }, '>')).toBe(false);
    expect(reaches('f8', { ...EVERYTHING, sideDoors: false }, 'L')).toBe(false);
    expect(reaches('f9', noTide, 'g')).toBe(false);
    expect(reaches('f9', { ...EVERYTHING, frost: false }, 'g')).toBe(false);
    expect(reaches('f9', { ...EVERYTHING, doors: false }, 'H')).toBe(false);
  });

  it('Gale: the G7 Windward Cache sits behind the wind-vane door', () => {
    expect(reaches('g7', { ...EVERYTHING, sideDoors: false }, '$')).toBe(false);
    expect(reaches('g7', EVERYTHING, '$')).toBe(true);
  });

  it('F10: the Loom Stone by the south door, the sealed north door never opens', () => {
    expect(reaches('f10', { doors: false }, 'x')).toBe(true);
    const r = room('f10');
    const n = find(r, 'D')[0]!;
    expect(n.y).toBe(0);
    expect(find(r, 'Y')).toEqual([{ x: n.x - 1, y: 0 }]);
  });
});
