/**
 * Room cross-reference checks for `npm run validate` (pure, unit tested in
 * tests/tools/roomChecks.test.ts): exits, @link doors and conditions, spawn markers, enemy and
 * pack ids, @note characters and keys per dungeon.
 */
import {
  EXIT_CHAR,
  OBJECT_KIND_BY_CHAR,
  OPPOSITE,
  parseLinkCondition,
  type Edge,
  type RoomData,
} from '../../src/sim';

export interface RoomCheckOptions {
  isEnemy(id: string): boolean;
  /** Null when data/packs.ts doesn't exist yet: pack ids are then not checked. */
  isPack: ((id: string) => boolean) | null;
}

export interface RoomCheckResult {
  errors: string[];
  warnings: string[];
}

const EDGES: readonly Edge[] = ['w', 'e', 'n', 's'];
const WATCHED: Readonly<Record<string, string>> = {
  braziers: 'B',
  switch: 'S',
  plates: 'T',
};

/** Characters in the grid. */
function charsOf(room: RoomData): Set<string> {
  const s = new Set<string>();
  for (const row of room.rows) for (const ch of row) s.add(ch);
  return s;
}

/** Edges with an exit tile in their edge column or row. */
function exitEdges(room: RoomData): Set<Edge> {
  const out = new Set<Edge>();
  const last = room.rows.length - 1;
  room.rows.forEach((row, ty) => {
    if (row[0] === EXIT_CHAR.w) out.add('w');
    if (row[row.length - 1] === EXIT_CHAR.e) out.add('e');
    if (ty === 0 && row.includes(EXIT_CHAR.n)) out.add('n');
    if (ty === last && row.includes(EXIT_CHAR.s)) out.add('s');
  });
  return out;
}

/** Exit characters that are not in their own edge column or row. */
function misplacedExits(room: RoomData): string[] {
  const out: string[] = [];
  const last = room.rows.length - 1;
  room.rows.forEach((row, ty) => {
    for (let tx = 0; tx < row.length; tx++) {
      const ch = row[tx]!;
      const ok =
        (ch === EXIT_CHAR.w && tx === 0) ||
        (ch === EXIT_CHAR.e && tx === row.length - 1) ||
        (ch === EXIT_CHAR.n && ty === 0) ||
        (ch === EXIT_CHAR.s && ty === last);
      const isExit = ch === EXIT_CHAR.w || ch === EXIT_CHAR.e || ch === EXIT_CHAR.n || ch === EXIT_CHAR.s;
      if (isExit && !ok) out.push(`'${ch}' at tile ${tx},${ty}`);
    }
  });
  return out;
}

export function checkRooms(rooms: ReadonlyMap<string, RoomData>, opts: RoomCheckOptions): RoomCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const keysByDungeon = new Map<string, { K: number; k: number; G: number; g: number }>();

  for (const [id, room] of rooms) {
    const at = `rooms/${id}.txt`;
    const chars = charsOf(room);
    const h = room.header;

    // Exits: each @exit leads to a room with an exit on the opposite edge; exit tiles have an @exit.
    const edges = exitEdges(room);
    const declared = new Set<string>();
    for (const ex of h.exits) {
      if (declared.has(ex.dir)) errors.push(`${at}: two @exit ${ex.dir} headers`);
      declared.add(ex.dir);
      const edge = ex.dir as Edge;
      if (!edges.has(edge))
        errors.push(`${at}: @exit ${edge} but no '${EXIT_CHAR[edge]}' tile on the ${edge} edge`);
      const target = rooms.get(ex.room);
      if (!target) {
        errors.push(`${at}: @exit ${edge} ${ex.room}: no such room`);
        continue;
      }
      const back = OPPOSITE[edge];
      if (!exitEdges(target).has(back))
        errors.push(
          `${at}: @exit ${edge} ${ex.room}, which has no '${EXIT_CHAR[back]}' exit on its ${back} edge`,
        );
      if (!target.header.exits.some((e) => e.dir === back && e.room === id))
        warnings.push(`${at}: @exit ${edge} ${ex.room} has no @exit ${back} ${id} back`);
    }
    for (const e of EDGES)
      if (edges.has(e) && !declared.has(e))
        errors.push(`${at}: '${EXIT_CHAR[e]}' tiles on the ${e} edge but no @exit ${e}`);
    for (const m of misplacedExits(room)) errors.push(`${at}: exit ${m} is not on its edge`);

    // @link: the door is in the grid, the condition is known and what it watches exists.
    for (const l of h.links) {
      if (!chars.has(l.door)) errors.push(`${at}: @link ${l.door}: no '${l.door}' in the grid`);
      if (OBJECT_KIND_BY_CHAR[l.door] !== 'door')
        errors.push(`${at}: @link ${l.door}: only 'D' doors take a @link`);
      const c = parseLinkCondition(l.condition);
      if (!c) {
        errors.push(`${at}: @link ${l.door} ${l.condition}: unknown condition`);
        continue;
      }
      const need = WATCHED[c.kind];
      if (need && !chars.has(need))
        errors.push(`${at}: @link ${l.door} ${l.condition}: no '${need}' in the grid`);
    }
    if (chars.has('D') && !h.links.some((l) => l.door === 'D'))
      warnings.push(`${at}: 'D' doors without a @link never open`);

    // @note: an object character that is in the grid.
    for (const n of h.notes) {
      if (!OBJECT_KIND_BY_CHAR[n.char]) errors.push(`${at}: @note ${n.char}: not an object character`);
      else if (!chars.has(n.char)) errors.push(`${at}: @note ${n.char}: no '${n.char}' in the grid`);
    }

    // Spawns: digits placed and declared both ways; known enemies and packs.
    const used = new Set([...chars].filter((ch) => ch >= '1' && ch <= '9'));
    const spawnDigits = new Set(h.spawns.map((s) => s.marker));
    for (const s of h.spawns) {
      if (!/^[1-9]$/.test(s.marker)) errors.push(`${at}: @spawn ${s.marker}: the marker must be a digit 1-9`);
      else if (!used.has(s.marker)) errors.push(`${at}: @spawn ${s.marker}: no '${s.marker}' in the grid`);
      if (!Number.isInteger(s.count) || s.count < 1)
        errors.push(`${at}: @spawn ${s.marker}: bad count ${s.count}`);
      if (s.kind === 'enemy' && !opts.isEnemy(s.id))
        errors.push(`${at}: @spawn ${s.marker} enemy:${s.id} is not in data/enemies.ts`);
      if (s.kind === 'pack') {
        if (opts.isPack === null)
          warnings.push(`${at}: @spawn ${s.marker} pack:${s.id} not checked (no data/packs.ts yet)`);
        else if (!opts.isPack(s.id))
          errors.push(`${at}: @spawn ${s.marker} pack:${s.id} is not in data/packs.ts`);
      }
    }
    for (const d of used)
      if (!spawnDigits.has(d))
        errors.push(`${at}: spawn marker ${d} is in the grid but has no @spawn header`);

    // Keys per dungeon (the id's region prefix).
    const dungeon = id.includes('/') ? id.slice(0, id.indexOf('/')) : id;
    const k = keysByDungeon.get(dungeon) ?? { K: 0, k: 0, G: 0, g: 0 };
    for (const row of room.rows)
      for (const ch of row) if (ch === 'K' || ch === 'k' || ch === 'G' || ch === 'g') k[ch]++;
    keysByDungeon.set(dungeon, k);
  }

  for (const [d, k] of keysByDungeon) {
    if (k.K > k.k)
      warnings.push(`dungeon ${d}: ${k.K} locked door tile(s) but only ${k.k} small-key chest(s)`);
    if (k.G > 0 && k.g === 0) errors.push(`dungeon ${d}: a big-key door but no big-key chest`);
  }
  return { errors, warnings };
}
