import { TILE_CELLS } from '../core/constants';
import { tileForChar } from '../../../data/tiles';

export interface RoomHeader {
  id: string;
  name: string;
  level: number;
  exits: { dir: string; room: string }[];
  spawns: { marker: string; kind: 'enemy' | 'pack'; id: string; count: number }[];
  links: { door: string; condition: string }[];
}

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
  const header: RoomHeader = { id: '', name: '', level: 1, exits: [], spawns: [], links: [] };
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
      h.exits.push({ dir: args[0]!, room: args[1]! });
      break;
    case 'spawn': {
      need(2);
      const [kind, id] = args[1]!.split(':');
      if ((kind !== 'enemy' && kind !== 'pack') || !id) {
        throw new RoomParseError('@spawn target must be enemy:<id> or pack:<id>', lineNo);
      }
      const count = args[2] ? Number(args[2]) : 1;
      h.spawns.push({ marker: args[0]!, kind, id, count });
      break;
    }
    case 'link':
      need(2);
      h.links.push({ door: args[0]!, condition: args[1]! });
      break;
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
  let spawnX = width / 2;
  let spawnY = height / 2;
  let foundSpawn = false;

  for (let ty = 0; ty < tilesH; ty++) {
    const row = data.rows[ty]!;
    for (let tx = 0; tx < tilesW; tx++) {
      const ch = row[tx]!;
      tiles[ty * tilesW + tx] = ch.charCodeAt(0);
      const def = tileForChar(ch)!;
      if (!def.walk) {
        for (let cy = 0; cy < TILE_CELLS; cy++) {
          solid.fill(
            1,
            (ty * TILE_CELLS + cy) * width + tx * TILE_CELLS,
            (ty * TILE_CELLS + cy) * width + (tx + 1) * TILE_CELLS,
          );
        }
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
    spawnX,
    spawnY,
  };
}

/** True if the cell blocks walking. Everything outside the room is solid. */
export function isSolidCell(room: Room, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= room.width || cy >= room.height) return true;
  return room.solid[cy * room.width + cx] === 1;
}
