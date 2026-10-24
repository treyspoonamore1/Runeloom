/**
 * The Hearth's hub room checks for `npm run validate` (M7, pure, unit tested in
 * tests/tools/hubChecks.test.ts): the room exists, its one Loom Stone is data/hearth.ts
 * `hearthStone`, every station is there as one rectangle of its character, and it is a safe room
 * (no enemies, no exits, nothing that burns).
 */
import { hearthRoom, hearthStone, STATION_IDS } from '../../data/hearth';
import { materials } from '../../data/materials';
import { tileGround } from '../../data/tileGround';
import { tileForChar } from '../../data/tiles';
import { OBJECT_CHAR, type RoomData } from '../../src/sim';

const EXITS = new Set(['<', '>', '^', 'v']);

export function checkHub(rooms: ReadonlyMap<string, RoomData>): string[] {
  const at = `rooms/${hearthRoom}.txt`;
  const room = rooms.get(hearthRoom);
  if (!room) return [`${at}: the Hearth's hub room is missing (data/hearth.ts hearthRoom)`];
  const errors: string[] = [];
  const tilesOf = (ch: string): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    room.rows.forEach((row, ty) => {
      for (let tx = 0; tx < row.length; tx++) if (row[tx] === ch) out.push([tx, ty]);
    });
    return out;
  };
  const stones = tilesOf('x').map(([tx, ty]) => `loom_stone@${tx},${ty}`);
  if (stones.length !== 1 || stones[0] !== hearthStone.key)
    errors.push(`${at}: needs exactly one Loom Stone at data/hearth.ts hearthStone.key ${hearthStone.key}, has ${stones.join(', ') || 'none'}`);
  for (const id of STATION_IDS) {
    const ch = OBJECT_CHAR[id];
    const tiles = tilesOf(ch);
    if (tiles.length === 0) {
      errors.push(`${at}: no '${ch}' (${id})`);
      continue;
    }
    const xs = tiles.map((t) => t[0]);
    const ys = tiles.map((t) => t[1]);
    const w = Math.max(...xs) - Math.min(...xs) + 1;
    const h = Math.max(...ys) - Math.min(...ys) + 1;
    if (w * h !== tiles.length) errors.push(`${at}: '${ch}' (${id}) tiles must form one rectangle`);
  }
  const h = room.header;
  if (h.spawns.length > 0) errors.push(`${at}: the hub has no enemies (@spawn)`);
  if (h.exits.length > 0) errors.push(`${at}: the hub has no exits (it is reached by fast travel)`);
  const burns = new Set<string>();
  for (const row of room.rows)
    for (const ch of row) {
      if (ch >= '1' && ch <= '9') burns.add(`spawn marker '${ch}'`);
      if (EXITS.has(ch)) burns.add(`exit '${ch}'`);
      const def = tileForChar(ch);
      const g = def ? tileGround[def.id as keyof typeof tileGround] : undefined;
      if (!g || g === 'neighbor') continue;
      if (materials[g.ground].flammable || g.oil) burns.add(`'${ch}' (${def!.id}) burns`);
    }
  for (const b of burns) errors.push(`${at}: a safe room: ${b}`);
  return errors;
}
