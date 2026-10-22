/**
 * Rift checks for `npm run validate` (M6): the room-chunk templates and boss arenas exist and have
 * their sockets where the generator expects them, rift spawns and bosses name real enemies and
 * packs, and a sample of generated rifts (every tier, every chemistry suffix) passes the ordinary
 * room checks and the rift solver. Templates themselves are not rooms (their sockets lead nowhere
 * until a rift joins them), so validate leaves them out of checkRooms.
 */
import { enemyDef, isEnemyKind } from '../../data/enemies';
import { isPackId } from '../../data/packs';
import {
  RIFT_TIERS,
  riftBosses,
  riftChunks,
  riftEntryChunk,
  riftMods,
  riftSpawns,
  type RiftModId,
} from '../../data/rift';
import { EXIT_CHAR, generateRift, parseRoom, solveRift, type Edge, type RoomData } from '../../src/sim';
import { checkRooms } from './roomChecks';

const SUFFIXES = (Object.keys(riftMods) as RiftModId[]).filter((id) => riftMods[id].kind === 'suffix');

/** Edges whose middle two tiles hold that edge's exit character. */
function sockets(room: RoomData): Set<Edge> {
  const out = new Set<Edge>();
  const w = room.tilesW;
  const h = room.tilesH;
  const mx = Math.floor(w / 2) - 1;
  const my = Math.floor(h / 2) - 1;
  const has = (x: number, y: number, ch: string) => room.rows[y]?.[x] === ch;
  if (has(mx, 0, EXIT_CHAR.n) && has(mx + 1, 0, EXIT_CHAR.n)) out.add('n');
  if (has(mx, h - 1, EXIT_CHAR.s) && has(mx + 1, h - 1, EXIT_CHAR.s)) out.add('s');
  if (has(0, my, EXIT_CHAR.w) && has(0, my + 1, EXIT_CHAR.w)) out.add('w');
  if (has(w - 1, my, EXIT_CHAR.e) && has(w - 1, my + 1, EXIT_CHAR.e)) out.add('e');
  return out;
}

const markersOf = (room: RoomData) => new Set(room.rows.join('').replace(/[^1-9]/g, ''));

export function checkRifts(templates: Record<string, string>, samplesPerTier = 3): string[] {
  const errors: string[] = [];
  const parsed = (id: string): RoomData | null => {
    const text = templates[id];
    if (text === undefined) {
      errors.push(`data/rift: no room template rooms/${id}.txt`);
      return null;
    }
    return parseRoom(text);
  };

  for (const c of [...riftChunks, riftEntryChunk]) {
    const room = parsed(`rift/chunks/${c}`);
    if (!room) continue;
    const s = sockets(room);
    for (const e of ['n', 'e', 's', 'w'] as const)
      if (!s.has(e))
        errors.push(`rooms/rift/chunks/${c}.txt: no 2-tile '${EXIT_CHAR[e]}' socket mid ${e} edge`);
    const markers = markersOf(room);
    if (c === riftEntryChunk && markers.size > 0)
      errors.push(`rooms/rift/chunks/${c}.txt: the entry has spawn markers`);
    if (c !== riftEntryChunk && markers.size === 0)
      errors.push(`rooms/rift/chunks/${c}.txt: no spawn markers`);
  }
  for (const b of riftBosses) {
    const at = `rooms/rift/bosses/${b.arena}.txt`;
    const room = parsed(`rift/bosses/${b.arena}`);
    if (room) {
      const s = sockets(room);
      if (!s.has('n') || !s.has('s')) errors.push(`${at}: needs 2-tile sockets mid n and s edges`);
      if (!room.rows.some((r) => r.includes('D'))) errors.push(`${at}: no 'D' door before the way home`);
      if ([...markersOf(room)].join() !== '1') errors.push(`${at}: marker 1 (the boss) and no other`);
    }
    if (!isEnemyKind(b.boss) || !enemyDef(b.boss).isBoss)
      errors.push(`data/rift bosses: ${b.boss} is not a boss`);
  }
  for (const s of riftSpawns) {
    if ('pack' in s && !isPackId(s.pack)) errors.push(`data/rift spawns: unknown pack ${s.pack}`);
    if ('enemy' in s && !isEnemyKind(s.enemy)) errors.push(`data/rift spawns: unknown enemy ${s.enemy}`);
  }
  if (errors.length > 0) return errors;

  // Sample rifts: each tier, cycling through every suffix pair.
  const home = '__home__';
  for (let tier = 1; tier <= RIFT_TIERS; tier++)
    for (let k = 0; k < samplesPerTier; k++) {
      const n = tier * samplesPerTier + k;
      const mods = [SUFFIXES[n % SUFFIXES.length]!, SUFFIXES[(n * 7 + 3) % SUFFIXES.length]!];
      const spec = {
        index: n,
        seed: n * 2654435761,
        tier,
        mods: [...new Set(mods)],
        home: { roomId: home, key: 'k' },
      };
      const rift = generateRift(spec, templates);
      const at = `rift tier ${tier} seed ${spec.seed} [${spec.mods.join(' ')}]`;
      const rooms = new Map(Object.entries(rift.rooms).map(([id, text]) => [id, parseRoom(text)]));
      const res = checkRooms(rooms, {
        isEnemy: isEnemyKind,
        isPack: isPackId,
        pendingRooms: new Set([home]),
      });
      errors.push(...res.errors.map((e) => `${at}: ${e}`));
      errors.push(...solveRift(rift).problems.map((p) => `${at}: ${p}`));
    }
  return errors;
}
