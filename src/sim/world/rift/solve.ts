/**
 * The rift solver (M6 acceptance: "connected and completable"): from the entry, every room a
 * player walks into lets them reach each of its used exits and every spawn marker (its enemies
 * can be fought), and the room graph reaches the boss, whose arena leads home once the boss dies.
 *
 * Within a room it flood-fills tiles from where the player arrives (the entry: the room's spawn
 * point; any other room: the exit it was entered by). A marker in water counts when its water
 * touches a reached tile (M8: the Glasswater Coil is fought from the shore). Walkable tiles pass, and so do the ones a
 * player opens with fire or that open themselves: bramble, crates, barricades, oil barrels and
 * doors (the boss door opens when the boss dies). Deep water, pits, walls and pylons stop it.
 */
import { tileForChar } from '../../../../data/tiles';
import { EXIT_CHAR, OPPOSITE } from '../exits';
import { parseRoom, type RoomData } from '../room';
import type { Edge } from '../worldState';
import type { GeneratedRift } from './generate';

/** Tiles a player gets through: walkable, or opened by fire or by the boss's death. */
const OPENABLE = '*cb|D';

const EDGES: readonly Edge[] = ['n', 'e', 's', 'w'];

export interface RiftSolveResult {
  ok: boolean;
  /** What is wrong, room by room ("rift/3/r4: marker 2 unreachable"). Empty when ok. */
  problems: string[];
  /** Rooms the walk visited, in visit order. */
  visited: string[];
}

function passable(ch: string): boolean {
  return OPENABLE.includes(ch) || tileForChar(ch)?.walk === true;
}

/** Tiles reachable from `starts` (tile indices), as a mask. */
function flood(data: RoomData, starts: number[]): Uint8Array {
  const w = data.tilesW;
  const h = data.tilesH;
  const seen = new Uint8Array(w * h);
  const queue: number[] = [];
  for (const s of starts) {
    if (seen[s]) continue;
    seen[s] = 1;
    queue.push(s);
  }
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k]!;
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (seen[j] || !passable(data.rows[ny]![nx]!)) continue;
      seen[j] = 1;
      queue.push(j);
    }
  }
  return seen;
}

/** Water tiles (a swimmer's world): shallow, deep, oily water. */
const WATER = '~wO';

/**
 * M8: a spawn marker in water (a swimmer: the Glasswater Coil in the Eye, a pike shoal) can be
 * fought from the shore: true if the water body it sits in touches a reached tile.
 */
function waterReached(data: RoomData, marker: number, reach: Uint8Array): boolean {
  const w = data.tilesW;
  const h = data.tilesH;
  const seen = new Uint8Array(w * h);
  const queue = [marker];
  seen[marker] = 1;
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k]!;
    if (reach[i]) return true;
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (seen[j]) continue;
      if (reach[j]) return true;
      if (!WATER.includes(data.rows[ny]![nx]!)) continue;
      seen[j] = 1;
      queue.push(j);
    }
  }
  return false;
}

function tilesOf(data: RoomData, pred: (ch: string) => boolean): number[] {
  const out: number[] = [];
  data.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (pred(row[x]!)) out.push(y * data.tilesW + x);
  });
  return out;
}

export function solveRift(rift: GeneratedRift): RiftSolveResult {
  const problems: string[] = [];
  const visited: string[] = [];
  const parsed = new Map<string, RoomData>();
  for (const [id, text] of Object.entries(rift.rooms)) parsed.set(id, parseRoom(text));
  const home = rift.spec.home.roomId;
  // Breadth-first over rooms; each queued with the edge it is entered by (null: the entry).
  const queue: { id: string; from: Edge | null }[] = [{ id: rift.entryId, from: null }];
  const seen = new Set<string>([rift.entryId]);
  let bossReached = false;
  for (let k = 0; k < queue.length; k++) {
    const { id, from } = queue[k]!;
    visited.push(id);
    const data = parsed.get(id);
    if (!data) {
      problems.push(`${id}: no such room`);
      continue;
    }
    let starts: number[];
    if (from === null) {
      // The entry has no Loom Stone: the player stands at the room's center.
      const cx = Math.floor(data.tilesW / 2);
      const cy = Math.floor(data.tilesH / 2);
      starts = [cy * data.tilesW + cx];
    } else starts = tilesOf(data, (ch) => ch === EXIT_CHAR[from]);
    if (
      starts.length === 0 ||
      !passable(data.rows[Math.floor(starts[0]! / data.tilesW)]![starts[0]! % data.tilesW]!)
    ) {
      problems.push(`${id}: nowhere to arrive${from ? ` from the ${from} edge` : ''}`);
      continue;
    }
    const reach = flood(data, starts);
    for (const marker of tilesOf(data, (ch) => ch >= '1' && ch <= '9'))
      if (!reach[marker] && !waterReached(data, marker, reach))
        problems.push(
          `${id}: spawn marker at tile ${marker % data.tilesW},${Math.floor(marker / data.tilesW)} unreachable`,
        );
    for (const ex of data.header.exits) {
      const edge = ex.dir as Edge;
      if (!EDGES.includes(edge)) continue;
      const tiles = tilesOf(data, (ch) => ch === EXIT_CHAR[edge]);
      if (tiles.length === 0) {
        problems.push(`${id}: @exit ${edge} has no exit tiles`);
        continue;
      }
      if (!tiles.some((t) => reach[t])) {
        problems.push(`${id}: the ${edge} exit can't be reached`);
        continue;
      }
      if (ex.room === home) {
        if (id === rift.bossId) bossReached = true;
        continue;
      }
      if (seen.has(ex.room)) continue;
      seen.add(ex.room);
      queue.push({ id: ex.room, from: OPPOSITE[edge] });
    }
  }
  if (!seen.has(rift.bossId)) problems.push(`${rift.bossId}: the boss room can't be reached`);
  else if (!bossReached) problems.push(`${rift.bossId}: no way home from the boss room`);
  for (const id of Object.keys(rift.rooms)) if (!seen.has(id)) problems.push(`${id}: not connected`);
  return { ok: problems.length === 0, problems, visited };
}
