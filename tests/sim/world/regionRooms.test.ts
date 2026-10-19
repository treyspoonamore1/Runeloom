/**
 * The M4 region rooms (CONTENT §9): Emberwood E1–E8 and the Sunken Kiln K1–K10. Checks every room
 * file parses, sits at its id's path, has its CONTENT §9 area level, connects reciprocally along the
 * intended graph, holds its rewards, chests and doors, and is gated by what its puzzle teaches
 * (static tile reachability, tests/sim/world/roomReach.ts). K5 and K10 are authored by the enemies
 * work; until they land, their side of the graph is checked against the contract below.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { regionRooms } from '../../../data/progression';
import { isEnemyKind } from '../../../data/enemies';
import { parseRoom, type RoomData } from '../../../src/sim';
import { spawnMarkerDiffs } from '../../../tools/lib/checks';
import { loadRoomText, ROOMS_DIR } from '../../../tools/lib/rooms';
import { find, key, lineOfSight, reachable, touches, type Abilities, type Tile } from './roomReach';

type Short = keyof typeof regionRooms;
type Edge = 'w' | 'e' | 'n' | 's';

const LEVELS: Record<Short, number> = {
  e1: 1,
  e2: 2,
  e3: 3,
  e4: 4,
  e5: 4,
  e6: 5,
  e7: 5,
  e8: 6,
  k1: 7,
  k2: 7,
  k3: 7,
  k4: 8,
  k5: 8,
  k6: 8,
  k7: 9,
  k8: 9,
  k9: 10,
  k10: 10,
};

/** The region graph: E1→…→E6→E8 with E7 off E6, then the Kiln K1→…→K10. */
const GRAPH: Record<Short, Partial<Record<Edge, Short>>> = {
  e1: { e: 'e2' },
  e2: { w: 'e1', e: 'e3' },
  e3: { w: 'e2', s: 'e4' },
  e4: { n: 'e3', e: 'e5' },
  e5: { w: 'e4', e: 'e6' },
  e6: { w: 'e5', n: 'e7', e: 'e8' },
  e7: { s: 'e6' },
  e8: { w: 'e6', n: 'k1' },
  k1: { s: 'e8', n: 'k2' },
  k2: { s: 'k1', e: 'k3' },
  k3: { w: 'k2', e: 'k4' },
  k4: { w: 'k3', e: 'k5' },
  k5: { w: 'k4', e: 'k6' },
  k6: { w: 'k5', e: 'k7' },
  k7: { w: 'k6', e: 'k8' },
  k8: { w: 'k7', e: 'k9' },
  k9: { w: 'k8', n: 'k10' },
  k10: { s: 'k9' },
};

/** Authored by the enemies work, not here. */
const BOSS_ROOMS: readonly Short[] = ['k5', 'k10'];
const MINE = (Object.keys(regionRooms) as Short[]).filter((s) => !BOSS_ROOMS.includes(s));
/** Rooms before the Frost rune (CONTENT §9.1): solvable with fire alone. */
const BEFORE_FROST: readonly Short[] = [
  'e1',
  'e2',
  'e3',
  'e4',
  'e5',
  'e6',
  'e7',
  'e8',
  'k1',
  'k2',
  'k3',
  'k4',
];
const FROST_ROOMS: readonly Short[] = ['k6', 'k7', 'k8', 'k9'];

const HEART_SEEDS: readonly Short[] = ['e4', 'e6', 'k4', 'k7'];
const LOOM_SHARDS: readonly Short[] = ['e2', 'e7', 'k8'];
const LOOM_STONES: readonly Short[] = ['e1', 'e8', 'k1', 'k6'];
const LINKS: Partial<Record<Short, string>> = {
  e6: 'cleared',
  e7: 'timer:10:braziers:all',
  k1: 'braziers:all',
  k2: 'braziers:all',
  k7: 'braziers:all',
  k8: 'plates:all',
};
const PACKS = ['tinderling_swarm', 'archer_line', 'tar_crew', 'bog_nest', 'wisp_flight', 'caller_guard'];
const M4_KINDS = ['bog_lurker', 'tar_hulk', 'frost_wisp', 'stormcaller', 'kiln_mite', 'brood_kiln'];
const EXIT_CHAR: Record<Edge, string> = { w: '<', e: '>', n: '^', s: 'v' };
const OPPOSITE: Record<Edge, Edge> = { w: 'e', e: 'w', n: 's', s: 'n' };

const exists = (s: Short): boolean => existsSync(join(ROOMS_DIR, `${regionRooms[s]}.txt`));
const rooms = new Map<Short, RoomData>(
  (Object.keys(regionRooms) as Short[])
    .filter(exists)
    .map((s) => [s, parseRoom(loadRoomText(regionRooms[s]))]),
);
const room = (s: Short): RoomData => rooms.get(s)!;
const shortOf = (id: string): Short | undefined =>
  (Object.keys(regionRooms) as Short[]).find((s) => regionRooms[s] === id);

/** Where the player stands when arriving in play order: the exit toward the previous room. */
function entry(s: Short): Tile {
  const r = room(s);
  if (s === 'e1') return find(r, 'x')[0]!;
  const back: Record<Short, Edge> = {
    e1: 'w',
    e2: 'w',
    e3: 'w',
    e4: 'n',
    e5: 'w',
    e6: 'w',
    e7: 's',
    e8: 'w',
    k1: 's',
    k2: 's',
    k3: 'w',
    k4: 'w',
    k5: 'w',
    k6: 'w',
    k7: 'w',
    k8: 'w',
    k9: 'w',
    k10: 's',
  };
  return find(r, EXIT_CHAR[back[s]])[0]!;
}

function reaches(s: Short, ab: Abilities, ch: string): boolean {
  const seen = reachable(room(s), entry(s), ab);
  const tiles = find(room(s), ch);
  return tiles.length > 0 && tiles.every((t) => seen.has(key(t)) || touches(seen, t));
}

const ALL: Abilities = { fire: true, frost: true, doors: true };
const NO_FROST: Abilities = { fire: true, doors: true };

describe('region rooms', () => {
  it('every room I author exists; the boss rooms come from the enemies work', () => {
    for (const s of MINE) expect(exists(s), regionRooms[s]).toBe(true);
  });

  it.each(MINE)('%s parses, sits at its id path, has its CONTENT §9 level and a 40–80 × 20–45 grid', (s) => {
    const r = room(s);
    expect(r.header.id).toBe(regionRooms[s]);
    expect(r.header.name.length).toBeGreaterThan(0);
    expect(r.header.level).toBe(LEVELS[s]);
    expect(r.tilesW).toBeGreaterThanOrEqual(40);
    expect(r.tilesW).toBeLessThanOrEqual(80);
    expect(r.tilesH).toBeGreaterThanOrEqual(20);
    expect(r.tilesH).toBeLessThanOrEqual(45);
    expect(r.rows.join('')).toMatch(/^[\x20-\x7e]*$/);
  });

  it.each(MINE)('%s has exactly the graph exits, as edge tiles, and its neighbours point back', (s) => {
    const r = room(s);
    const want = GRAPH[s];
    const got = Object.fromEntries(r.header.exits.map((e) => [e.dir, e.room]));
    expect(got).toEqual(Object.fromEntries(Object.entries(want).map(([d, n]) => [d, regionRooms[n]])));
    for (const [dir, n] of Object.entries(want) as [Edge, Short][]) {
      const tiles = find(r, EXIT_CHAR[dir]);
      expect(tiles.length, `${s} ${dir} exit tiles`).toBeGreaterThan(0);
      for (const t of tiles) {
        const onEdge = { w: t.x === 0, e: t.x === r.tilesW - 1, n: t.y === 0, s: t.y === r.tilesH - 1 }[dir];
        expect(onEdge, `${s} ${EXIT_CHAR[dir]} at ${key(t)}`).toBe(true);
      }
      // Reciprocal: the neighbour's file (or, for boss rooms not yet authored, the contract).
      const back = rooms.get(n)?.header.exits.find((e) => e.dir === OPPOSITE[dir])?.room;
      const expected = rooms.has(n) ? back : GRAPH[n][OPPOSITE[dir]] && regionRooms[GRAPH[n][OPPOSITE[dir]]!];
      expect(expected, `${n} ${OPPOSITE[dir]} → ${s}`).toBe(regionRooms[s]);
    }
    // Nothing but walls and declared exits on the border.
    r.rows.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (x > 0 && y > 0 && x < r.tilesW - 1 && y < r.tilesH - 1) return;
        if (c === '#') return;
        const dir = (Object.keys(EXIT_CHAR) as Edge[]).find((d) => EXIT_CHAR[d] === c);
        expect(dir && want[dir], `${s} border tile '${c}' at ${x},${y}`).toBeTruthy();
      }),
    );
    for (const e of r.header.exits) expect(shortOf(e.room), e.room).toBeDefined();
  });

  it('holds 4 Heart Seeds, 3 Loom Shards, the Kiln keys and the Loom Stones where CONTENT §9 lists them', () => {
    const count = (s: Short, ch: string): number => find(room(s), ch).length;
    for (const s of MINE) {
      expect(count(s, 'H'), `${s} H`).toBe(HEART_SEEDS.includes(s) ? 1 : 0);
      expect(count(s, 'L'), `${s} L`).toBe(LOOM_SHARDS.includes(s) ? 1 : 0);
      expect(count(s, 'x') > 0, `${s} x`).toBe(LOOM_STONES.includes(s));
      expect(count(s, 'k') + count(s, 'K') > 0, `${s} small key`).toBe(s === 'k3');
      expect(count(s, 'g') + count(s, 'G') > 0, `${s} big key`).toBe(s === 'k9');
    }
    expect(count('k3', 'k')).toBe(1);
    expect(count('k9', 'g')).toBe(1);
    expect(count('k9', 'I')).toBeGreaterThanOrEqual(8);
  });

  it.each(MINE)('%s links its doors with a valid condition, and only rooms with doors have links', (s) => {
    const r = room(s);
    const links = r.header.links;
    if (LINKS[s]) expect(links).toEqual([{ door: 'D', condition: LINKS[s] }]);
    else expect(links).toEqual([]);
    expect(find(r, 'D').length > 0).toBe(!!LINKS[s]);
    if (LINKS[s]?.includes('braziers')) expect(find(r, 'B').length).toBeGreaterThanOrEqual(2);
    if (LINKS[s] === 'plates:all') expect(find(r, 'T').length).toBe(2);
  });

  it.each(MINE)('%s spawns: every marker is declared, packs and kinds are in CONTENT §5', (s) => {
    const r = room(s);
    const d = spawnMarkerDiffs(r);
    expect(d.usedNotDeclared).toEqual([]);
    expect(d.declaredNotUsed).toEqual([]);
    for (const sp of r.header.spawns) {
      if (sp.kind === 'pack') expect(PACKS, sp.id).toContain(sp.id);
      else expect(isEnemyKind(sp.id) || M4_KINDS.includes(sp.id), sp.id).toBe(true);
    }
    const rares = loadRoomText(regionRooms[s])
      .split('\n')
      .filter((l) => /^@spawn \d pack:\w+ rare\s*$/.test(l));
    expect(rares.length, `${s} rare packs`).toBe(s === 'e6' || s === 'e8' ? 1 : 0);
  });
});

describe('region rooms are gated by what they teach (static reachability)', () => {
  it.each(BEFORE_FROST)('%s: every exit, pickup and chest is reachable without Frost', (s) => {
    for (const ch of ['<', '>', '^', 'v', 'H', 'L', 'x', 'k'])
      if (find(room(s), ch).length > 0) expect(reaches(s, NO_FROST, ch), `${s} ${ch}`).toBe(true);
  });

  it.each(FROST_ROOMS)('%s: everything is reachable with Frost, and the way on is not without it', (s) => {
    for (const ch of ['<', '>', '^', 'v', 'H', 'L', 'x', 'g', 'B'])
      if (find(room(s), ch).length > 0) expect(reaches(s, ALL, ch), `${s} ${ch}`).toBe(true);
    const ahead = EXIT_CHAR[(Object.keys(GRAPH[s]) as Edge[]).find((d) => d !== 'w')!];
    expect(reaches(s, NO_FROST, ahead)).toBe(false);
  });

  it('frost rewards: the K7 Heart Seed, K8 Loom Shard and K9 big key need Frost', () => {
    expect(reaches('k7', NO_FROST, 'H')).toBe(false);
    expect(reaches('k8', NO_FROST, 'L')).toBe(false);
    expect(reaches('k9', NO_FROST, 'g')).toBe(false);
  });

  it('fire gates: E1 bramble wall, E2 and E4 rewards, the K3 key, the K4 barricades', () => {
    expect(reaches('e1', {}, '>')).toBe(false);
    expect(reaches('e1', { fire: true }, '>')).toBe(true);
    expect(reaches('e2', {}, '>')).toBe(true);
    expect(reaches('e2', {}, 'L')).toBe(false);
    expect(reaches('e4', {}, 'H')).toBe(false);
    expect(reaches('k3', { doors: true }, 'k')).toBe(false);
    expect(reaches('k3', { doors: true }, '>')).toBe(false);
    expect(reaches('k4', { doors: true }, '>')).toBe(false);
    expect(reaches('k4', { doors: true }, 'H')).toBe(false);
  });

  it('door gates: E6 Heart Seed, E7 Loom Shard, the K1/K2 way on, and the K3 locked door needs its key', () => {
    expect(reaches('e6', { fire: true }, 'H')).toBe(false);
    expect(reaches('e7', { fire: true }, 'L')).toBe(false);
    expect(reaches('k1', { fire: true }, '^')).toBe(false);
    expect(reaches('k2', { fire: true }, '>')).toBe(false);
    // From the east side, K3's locked door stays shut without a key.
    const r = room('k3');
    const fromEast = reachable(r, find(r, '>')[0]!, { doors: true });
    expect(find(r, '<').some((t) => fromEast.has(key(t)))).toBe(false);
  });

  it('K2: no brazier is in line of sight, and each is within Lob range (10 tiles) of the floor', () => {
    const r = room('k2');
    const floor = [...reachable(r, entry('k2'), NO_FROST)].map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x: x!, y: y! };
    });
    for (const b of find(r, 'B')) {
      expect(
        floor.some((t) => lineOfSight(r, t, b)),
        `LOS to ${key(b)}`,
      ).toBe(false);
      expect(
        floor.some((t) => Math.hypot(t.x - b.x, t.y - b.y) <= 10),
        `Lob to ${key(b)}`,
      ).toBe(true);
    }
  });

  it('E7: no single spot has a bolt line (63 cells, under 16 tiles) to two of the three braziers', () => {
    const r = room('e7');
    const bs = find(r, 'B');
    expect(bs.length).toBe(3);
    for (const k of reachable(r, entry('e7'), NO_FROST)) {
      const [x, y] = k.split(',').map(Number);
      const t = { x: x!, y: y! };
      const seen = bs.filter((b) => Math.hypot(t.x - b.x, t.y - b.y) < 16 && lineOfSight(r, t, b)).length;
      expect(seen, `from ${k}`).toBeLessThanOrEqual(1);
    }
  });
});
