import { TILE_CELLS } from '../core/constants';
import { tileForChar } from '../../../data/tiles';
import { WIND_BY_NAME, type WindDir } from '../grid/windDir';

/** `@fog tx0 ty0 tx1 ty1` (M8): a rectangle of tiles, corners inclusive. */
export interface FogRect {
  tx0: number;
  ty0: number;
  tx1: number;
  ty1: number;
}

export interface RoomHeader {
  id: string;
  name: string;
  level: number;
  exits: { dir: string; room: string }[];
  /** M4: `rarity` from a trailing `magic` or `rare` word (CONTENT §5 monster rarity). */
  spawns: { marker: string; kind: 'enemy' | 'pack'; id: string; count: number; rarity?: 'magic' | 'rare' }[];
  links: { door: string; condition: string }[];
  /**
   * `@note <char> <text>` (M4): when an object of that tile character activates (a switch is
   * powered, a door opens, a chest opens, a pickup is taken, a Loom Stone wakes), the sim sends a
   * 'note' event with the text for the UI to show.
   */
  notes: { char: string; text: string }[];
  /**
   * `@clear exit <w|e|n|s>` (M4): the room's first-clear rewards are also paid when the player
   * leaves through that edge, even with enemies left (E3: a burnt bridge strands part of the pack).
   * Null when absent.
   */
  clearOnExit: 'w' | 'e' | 'n' | 's' | null;
  /**
   * M8 headers (CONTENT §6.2), present only when the file has them, so rooms from before M8 parse
   * to the same header. `fog`: `@fog` rectangles in file order (they add up; the grid's fogMask).
   * `wind`: `@wind`, the way the room wind blows (1–8, grid/windDir.ts). `pulse`: `@pulse`, the
   * seconds between world-owned pulses of every metal pylon (world/rift/pulse.ts).
   */
  fog?: FogRect[];
  wind?: WindDir;
  pulse?: number;
  /**
   * `@look fen|foundry` (M8): the region look the renderer draws the room in, for rooms whose id
   * doesn't say it (rift chunks and arenas built from Fen rooms). Purely visual.
   */
  look?: RoomLook;
}

export type RoomLook = 'fen' | 'foundry';

/** A parsed room file (CONTENT §6), before it becomes simulation data. */
export interface RoomData {
  header: RoomHeader;
  tilesW: number;
  tilesH: number;
  /** One string per tile row, all tilesW long. */
  rows: string[];
}

export class RoomParseError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(`line ${line}: ${message}`);
  }
}

export function parseRoom(text: string): RoomData {
  const header: RoomHeader = {
    id: '',
    name: '',
    level: 1,
    exits: [],
    spawns: [],
    links: [],
    notes: [],
    clearOnExit: null,
  };
  const rows: string[] = [];
  let firstRowLine = 0;
  const lines = text.split('\n');

  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const line = raw.replace(/\r$/, '');
    if (line.trim() === '') return;
    if (line.startsWith('@')) {
      if (rows.length > 0) throw new RoomParseError('header after the grid started', lineNo);
      parseHeaderLine(header, line, lineNo);
      return;
    }
    if (rows.length === 0) firstRowLine = lineNo;
    for (const ch of line) {
      if (!tileForChar(ch)) throw new RoomParseError(`unknown tile character '${ch}'`, lineNo);
    }
    rows.push(line);
  });

  if (!header.id) throw new RoomParseError('missing @id', 1);
  if (rows.length === 0) throw new RoomParseError('no grid rows', lines.length);
  const tilesW = rows[0]!.length;
  rows.forEach((r, i) => {
    if (r.length !== tilesW) {
      throw new RoomParseError(`row is ${r.length} wide, expected ${tilesW}`, firstRowLine + i);
    }
  });
  return { header, tilesW, tilesH: rows.length, rows };
}

const EXIT_DIRS: readonly string[] = ['w', 'e', 'n', 's'];

function parseHeaderLine(h: RoomHeader, line: string, lineNo: number): void {
  const [key, ...args] = line.slice(1).trim().split(/\s+/);
  const need = (n: number): void => {
    if (args.length < n) throw new RoomParseError(`@${key} needs ${n} argument(s)`, lineNo);
  };
  switch (key) {
    case 'id':
      need(1);
      h.id = args[0]!;
      break;
    case 'name':
      need(1);
      h.name = args.join(' ');
      break;
    case 'level': {
      need(1);
      const level = Number(args[0]);
      if (!Number.isInteger(level) || level < 1)
        throw new RoomParseError('@level must be a positive integer', lineNo);
      h.level = level;
      break;
    }
    case 'exit':
      need(2);
      if (!EXIT_DIRS.includes(args[0]!))
        throw new RoomParseError('@exit direction must be w, e, n or s', lineNo);
      h.exits.push({ dir: args[0]!, room: args[1]! });
      break;
    case 'spawn': {
      need(2);
      const [kind, id] = args[1]!.split(':');
      if ((kind !== 'enemy' && kind !== 'pack') || !id) {
        throw new RoomParseError('@spawn target must be enemy:<id> or pack:<id>', lineNo);
      }
      // M4 (enemies agent): `@spawn <d> enemy:<id> [count] [magic|rare]`, `@spawn <d> pack:<id> [magic|rare]`.
      const rest = args.slice(2);
      const last = rest[rest.length - 1];
      const rarity = last === 'magic' || last === 'rare' ? last : undefined;
      if (rarity) rest.pop();
      const count = rest[0] ? Number(rest[0]) : 1;
      if (!Number.isInteger(count) || count < 1 || rest.length > 1)
        throw new RoomParseError('@spawn count must be a positive integer', lineNo);
      h.spawns.push(
        rarity ? { marker: args[0]!, kind, id, count, rarity } : { marker: args[0]!, kind, id, count },
      );
      break;
    }
    case 'link':
      need(2);
      h.links.push({ door: args[0]!, condition: args[1]! });
      break;
    case 'note': {
      need(2);
      if (args[0]!.length !== 1) throw new RoomParseError('@note needs one tile character', lineNo);
      // Keep the text as written (single spaces between words).
      h.notes.push({ char: args[0]!, text: args.slice(1).join(' ') });
      break;
    }
    case 'clear': {
      need(2);
      const dir = args[1];
      if (args[0] !== 'exit' || (dir !== 'w' && dir !== 'e' && dir !== 'n' && dir !== 's'))
        throw new RoomParseError('@clear takes "exit <w|e|n|s>"', lineNo);
      h.clearOnExit = dir;
      break;
    }
    case 'fog': {
      need(4);
      const n = args.slice(0, 4).map(Number);
      if (args.length > 4 || !n.every((v) => Number.isInteger(v) && v >= 0))
        throw new RoomParseError('@fog takes four tile coordinates: tx0 ty0 tx1 ty1', lineNo);
      const [a, b, c, d] = n as [number, number, number, number];
      (h.fog ??= []).push({
        tx0: Math.min(a, c),
        ty0: Math.min(b, d),
        tx1: Math.max(a, c),
        ty1: Math.max(b, d),
      });
      break;
    }
    case 'wind': {
      need(1);
      const dir = WIND_BY_NAME[args[0]!];
      if (dir === undefined || args.length > 1)
        throw new RoomParseError('@wind takes one of n, ne, e, se, s, sw, w, nw', lineNo);
      h.wind = dir;
      break;
    }
    case 'pulse': {
      need(1);
      const sec = Number(args[0]);
      if (!Number.isFinite(sec) || sec <= 0 || args.length > 1)
        throw new RoomParseError('@pulse takes a positive number of seconds', lineNo);
      h.pulse = sec;
      break;
    }
    case 'look': {
      need(1);
      const look = args[0];
      if ((look !== 'fen' && look !== 'foundry') || args.length > 1)
        throw new RoomParseError('@look takes fen or foundry', lineNo);
      h.look = look;
      break;
    }
    default:
      throw new RoomParseError(`unknown header @${key}`, lineNo);
  }
}

/** Simulation-side room: tile characters plus per-cell walkability. */
export interface Room {
  id: string;
  name: string;
  level: number;
  tilesW: number;
  tilesH: number;
  /** Size in cells. */
  width: number;
  height: number;
  /** Tile character codes, row-major, tilesW × tilesH. */
  tiles: Uint8Array;
  /** 1 where a cell blocks walking, row-major, width × height. */
  solid: Uint8Array;
  /** 1 where a cell stops projectiles and beams (tile `blocksShots`), row-major, width × height. */
  shotSolid: Uint8Array;
  /** Spawn-marker tiles (`1`–`9`) in row-major order, at tile centers in cells. */
  spawnMarkers: { marker: string; x: number; y: number }[];
  /** `@spawn` headers, in file order. */
  spawns: RoomHeader['spawns'];
  /** Every header (exits, links, notes, …) as parsed. */
  header: RoomHeader;
  /** Player start in cells: the first Loom Stone `x`, else the room center. */
  spawnX: number;
  spawnY: number;
}

export function buildRoom(data: RoomData): Room {
  const { tilesW, tilesH } = data;
  const width = tilesW * TILE_CELLS;
  const height = tilesH * TILE_CELLS;
  const tiles = new Uint8Array(tilesW * tilesH);
  const solid = new Uint8Array(width * height);
  const shotSolid = new Uint8Array(width * height);
  const spawnMarkers: Room['spawnMarkers'] = [];
  let spawnX = width / 2;
  let spawnY = height / 2;
  let foundSpawn = false;

  for (let ty = 0; ty < tilesH; ty++) {
    const row = data.rows[ty]!;
    for (let tx = 0; tx < tilesW; tx++) {
      const ch = row[tx]!;
      tiles[ty * tilesW + tx] = ch.charCodeAt(0);
      const def = tileForChar(ch)!;
      if (!def.walk) fillTile(solid, width, tx, ty);
      if (def.blocksShots) fillTile(shotSolid, width, tx, ty);
      if (ch >= '1' && ch <= '9') {
        spawnMarkers.push({ marker: ch, x: (tx + 0.5) * TILE_CELLS, y: (ty + 0.5) * TILE_CELLS });
      }
      if (ch === 'x' && !foundSpawn) {
        foundSpawn = true;
        spawnX = (tx + 0.5) * TILE_CELLS;
        spawnY = (ty + 0.5) * TILE_CELLS;
      }
    }
  }

  return {
    id: data.header.id,
    name: data.header.name,
    level: data.header.level,
    tilesW,
    tilesH,
    width,
    height,
    tiles,
    solid,
    shotSolid,
    spawnMarkers,
    spawns: data.header.spawns,
    header: data.header,
    spawnX,
    spawnY,
  };
}

/** Sets every cell of tile (tx, ty) in a width-wide cell mask. */
function fillTile(mask: Uint8Array, width: number, tx: number, ty: number): void {
  for (let cy = 0; cy < TILE_CELLS; cy++) {
    const row = (ty * TILE_CELLS + cy) * width;
    mask.fill(1, row + tx * TILE_CELLS, row + (tx + 1) * TILE_CELLS);
  }
}

/** True if the cell blocks walking. Everything outside the room is solid. */
export function isSolidCell(room: Room, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= room.width || cy >= room.height) return true;
  return room.solid[cy * room.width + cx] === 1;
}

/** True if the cell stops projectiles. Everything outside the room does. */
export function isShotSolidCell(room: Room, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= room.width || cy >= room.height) return true;
  return room.shotSolid[cy * room.width + cx] === 1;
}
