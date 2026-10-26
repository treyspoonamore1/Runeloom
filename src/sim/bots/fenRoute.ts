/**
 * The Fen campaign bot's route (bots/fenRun.ts, BUILD_PLAN M8 phase 1 "Campaign bot"): the rooms
 * in CONTENT §13's path order, with the puzzle steps each visit plays (the shared scripted
 * solutions, bots/fenPuzzles.ts and foundryPuzzles.ts) and, for rooms without a puzzle exit, a
 * walk out through the exit toward the next room.
 *
 *   K10 → G1 → G2 → G3 → G4 → G5 → G7 → G5 → G6 → G8 → F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8
 *   → F9 → F8 → F10
 *
 * G7 (the side room's Heart Seed) is on the route; its Windward Cache (Gale, after the Coil) and
 * F1's alcove (Tide, a backtrack from F6) are not: optional revisits a player may skip.
 */
import { fenRooms } from '../../../data/progression';
import type { GameState } from '../state';
import { exitTilesOn } from '../world/exits';
import { parseRoom } from '../world/room';
import type { Edge } from '../world/worldState';
import {
  anyOn,
  BOLT_FIRE,
  BOLT_STORM,
  cast,
  fenOverworldSteps as O,
  into,
  LOB_FROST,
  LOB_TIDE,
  STRIKE,
  T,
} from './fenPuzzles';
import type { FenShort, PuzzleStep } from './fenPuzzles';
import { foundrySteps as F } from './foundryPuzzles';
import type { ScriptCommand } from './script';

export interface FenVisit {
  room: FenShort;
  /** Log label (a revisit is "g5 (back)"). */
  label: string;
  /**
   * Puzzle steps, in order; the last one may walk out of the room. 'fight' fights again: packs
   * the bot can only reach once a step has opened the way (beyond F7's fire walls, F9's chasm).
   */
  steps: (PuzzleStep | 'fight')[];
  /** Walk out toward this room after the steps (when the last step doesn't). */
  exitTo?: FenShort;
  /** A boss room: the fight is the boss. */
  boss?: 'bellwether' | 'glasswater_coil';
}

/** F9 back west: bridge the chasm again from the key side (Tide, then Frost) and walk out to F8. */
export const f9Back: PuzzleStep = {
  name: 'f9 back',
  weaves: [BOLT_FIRE, STRIKE, LOB_TIDE, LOB_FROST],
  script: () => [
    { do: 'moveTo', x: T(31), y: T(13) },
    cast(2, 114, T(13)),
    cast(2, 106, T(13)),
    cast(3, 114, T(13)),
    cast(3, 106, T(13)),
    { do: 'moveTo', x: T(24), y: T(13) },
    { do: 'moveTo', x: T(1), y: T(15) },
    { do: 'walk', dirX: -1, dirY: 0, s: 3, until: into(fenRooms.f8) },
  ],
};

/**
 * K10's storm door (CONTENT §9.1): a Storm Bolt on its switch in the north wall (it hums once the
 * best tier ever is 6), then north through the door to G1.
 */
export const stormDoorStep: PuzzleStep = {
  name: 'k10 storm door',
  weaves: [BOLT_FIRE, STRIKE, BOLT_STORM, LOB_FROST],
  script: () => [
    { do: 'moveTo', x: T(3), y: T(4) },
    cast(2, T(3), T(0)),
    { do: 'until', cond: (st) => anyOn(st, 'door'), timeout: 3, label: 'storm door opens' },
    { do: 'moveTo', x: T(1), y: T(2) },
    { do: 'walk', dirX: 0, dirY: -1, s: 3, until: into(fenRooms.g1) },
  ],
};

export const fenRoute: readonly FenVisit[] = [
  { room: 'g1', label: 'g1', steps: [O.g1] },
  { room: 'g2', label: 'g2', steps: [], exitTo: 'g3' },
  { room: 'g3', label: 'g3', steps: [O.g3] },
  { room: 'g4', label: 'g4', steps: [O.g4Seed, O.g4Crossing] },
  { room: 'g5', label: 'g5', steps: [O.g5Shard], exitTo: 'g7' },
  { room: 'g7', label: 'g7', steps: [O.g7], exitTo: 'g5' },
  { room: 'g5', label: 'g5 (back)', steps: [O.g5] },
  { room: 'g6', label: 'g6', steps: [], exitTo: 'g8' },
  { room: 'g8', label: 'g8', steps: [O.g8] },
  { room: 'f1', label: 'f1', steps: [F.f1] },
  { room: 'f2', label: 'f2', steps: [F.f2] },
  { room: 'f3', label: 'f3', steps: [F.f3] },
  { room: 'f4', label: 'f4', steps: [F.f4] },
  { room: 'f5', label: 'f5', steps: [F.f5], boss: 'bellwether' },
  { room: 'f6', label: 'f6', steps: [F.f6Shrine, F.f6] },
  { room: 'f7', label: 'f7', steps: [F.f7Cross, 'fight'], exitTo: 'f8' },
  { room: 'f8', label: 'f8', steps: [F.f8Vault, F.f8East] },
  { room: 'f9', label: 'f9', steps: [F.f9Seed, F.f9Key, 'fight', f9Back] },
  { room: 'f8', label: 'f8 (back)', steps: [F.f8North] },
  { room: 'f10', label: 'f10', steps: [], boss: 'glasswater_coil' },
];

/** The edge of the current room whose exit leads to `toId`, or null. */
export function edgeTo(state: GameState, toId: string): Edge | null {
  const text = state.rooms[state.room.id];
  if (text === undefined) return null;
  const ex = parseRoom(text).header.exits.find((e) => e.room === toId);
  return ex ? (ex.dir as Edge) : null;
}

const OUT: Readonly<Record<Edge, readonly [number, number]>> = {
  w: [-1, 0],
  e: [1, 0],
  n: [0, -1],
  s: [0, 1],
};

/** A step that walks out of the current room through the exit toward `to`. */
export function exitStep(state: GameState, to: FenShort): PuzzleStep {
  const toId = fenRooms[to];
  const edge = edgeTo(state, toId);
  if (edge === null) throw new Error(`fenRoute: ${state.room.id} has no exit to ${toId}`);
  const tiles = exitTilesOn(state.room, edge);
  const mid = tiles[Math.floor((tiles.length - 1) / 2)]!;
  // Middle of the opening (between two tiles when it is an even run), one tile inside the edge.
  const along = tiles.length % 2 === 0 ? (mid + 1) * 4 : T(mid);
  const [dx, dy] = OUT[edge];
  const w = state.room.tilesW;
  const h = state.room.tilesH;
  const inside = edge === 'w' ? T(1) : edge === 'e' ? T(w - 2) : edge === 'n' ? T(1) : T(h - 2);
  const at = edge === 'w' || edge === 'e' ? { x: inside, y: along } : { x: along, y: inside };
  const script: ScriptCommand[] = [
    { do: 'moveTo', x: at.x, y: at.y, timeout: 40 },
    { do: 'walk', dirX: dx, dirY: dy, s: 3, until: into(toId) },
  ];
  return { name: `exit to ${to}`, weaves: [], script: () => script };
}
