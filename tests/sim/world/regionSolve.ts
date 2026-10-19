/**
 * Helpers for the region puzzle-solution tests (BUILD_PLAN M4 task 10, data/rooms/SOLUTIONS.md):
 * a new-game adventure entered into a region room the way play reaches it, with the runes the
 * player has unlocked by then (CONTENT §9.1) and the weaves a solution uses.
 */
import { guaranteedRunes, newGame, regionRooms } from '../../../data/progression';
import { runeIds, runes, type RuneId } from '../../../data/runes';
import {
  createAdventure,
  enterRoom,
  setSlotWeave,
  type Edge,
  type GameState,
  type WorldObject,
} from '../../../src/sim';
import { expect } from 'vitest';
import { runScript, type ScriptCommand, type ScriptResult } from '../../../src/sim';
import { giveRune } from '../hero/helpers';
import { ROOMS } from './worldHelpers';

export type Short = keyof typeof regionRooms;

/** Play order (E7 is the side room off E6, done before E8). */
export const PLAY_ORDER = Object.keys(regionRooms) as Short[];

/** Runes unlocked on arriving in `room`: the new-game runes plus every earlier room's guarantees. */
export function runesBy(room: Short): RuneId[] {
  const out = new Set<RuneId>(newGame.runes);
  for (const s of PLAY_ORDER.slice(0, PLAY_ORDER.indexOf(room)))
    for (const r of guaranteedRunes[regionRooms[s]] ?? []) out.add(r);
  return [...out].sort();
}

const BY_NOTATION = new Map<string, RuneId>(runeIds.map((id) => [runes[id].notation, id]));

/** Rune ids a weave notation uses, with repeats (one rune item each). */
export function weaveRunes(notation: string): RuneId[] {
  return (notation.match(/[A-Za-z]+/g) ?? []).map((w) => {
    const id = BY_NOTATION.get(w);
    if (!id) throw new Error(`unknown rune "${w}" in ${notation}`);
    return id;
  });
}

export interface RoomSetup {
  /** Edge of the room the player arrives through (null: the room's default spawn, its Loom Stone). */
  arrive: Edge | null;
  /** Weaves for slots 0..3 (null: empty). */
  weaves: (string | null)[];
  /** Runes to leave out of the unlocked set (the no-Frost attempts). */
  without?: RuneId[];
  /** Runes the room itself pays on entry (K6 has no enemies, so its Frost is paid at once). */
  extra?: RuneId[];
  /** Freeze enemy AI: the puzzle isn't the fight. */
  noAI?: boolean;
  god?: boolean;
}

export interface Prepared {
  state: GameState;
  /** Rune items added beyond one of each unlocked rune (duplicate drops a solution relies on). */
  duplicates: RuneId[];
}

/**
 * A new-game adventure in `room`: the hero holds one item of every rune unlocked by then plus
 * the duplicates the weaves need, the weaves are socketed with setSlotWeave, and the player
 * arrives through `arrive` (enterRoom). Throws if a weave uses a rune not unlocked by then.
 */
export function prepare(room: Short, setup: RoomSetup): Prepared {
  const id = regionRooms[room];
  const state = createAdventure({ seed: 1, rooms: ROOMS, startRoomId: id });
  const unlocked = [...runesBy(room), ...(setup.extra ?? [])].filter((r) => !setup.without?.includes(r));
  for (let slot = 0; slot < 4; slot++) setSlotWeave(state, slot, null);
  const hero = state.hero;
  hero.runes = hero.runes.filter((r) => unlocked.includes(r.rune));
  hero.unlockedRunes = hero.unlockedRunes.filter((r) => unlocked.includes(r));
  for (const r of unlocked) if (!hero.runes.some((i) => i.rune === r)) giveRune(state, r);

  const duplicates: RuneId[] = [];
  const need = new Map<RuneId, number>();
  for (const w of setup.weaves) for (const r of w ? weaveRunes(w) : []) need.set(r, (need.get(r) ?? 0) + 1);
  for (const [r, n] of need) {
    if (!unlocked.includes(r)) throw new Error(`${room}: ${r} isn't unlocked by then`);
    for (let have = hero.runes.filter((i) => i.rune === r).length; have < n; have++) {
      giveRune(state, r);
      duplicates.push(r);
    }
  }
  setup.weaves.forEach((w, slot) => {
    if (w === null) return;
    const out = setSlotWeave(state, slot, w);
    if (!out.applied) throw new Error(`${room}: weave ${w} didn't apply`);
  });
  if (setup.arrive) enterRoom(state, id, { kind: 'edge', from: OPPOSITE[setup.arrive] });
  state.cheats.noAI = !!setup.noAI;
  state.cheats.god = !!setup.god;
  return { state, duplicates };
}

const OPPOSITE: Record<Edge, Edge> = { w: 'e', e: 'w', n: 's', s: 'n' };

/** Cell coordinate of tile t's center. */
export const T = (t: number): number => (t + 0.5) * 4;
/** A tile's center as a point. */
export const at = (tx: number, ty: number) => ({ x: T(tx), y: T(ty) });

export const objects = (s: GameState, kind: WorldObject['kind']): WorldObject[] =>
  s.objects.filter((o) => o.kind === kind);
export const allOn = (s: GameState, kind: WorldObject['kind']): boolean =>
  objects(s, kind).length > 0 && objects(s, kind).every((o) => o.on);
export const anyOn = (s: GameState, kind: WorldObject['kind']): boolean => objects(s, kind).some((o) => o.on);

/** True when no cell of tiles (tx0..tx1, ty0..ty1) is still `mat` (e.g. the bramble burned away). */
export function noneLeft(
  s: GameState,
  mat: number,
  tx0: number,
  ty0: number,
  tx1: number,
  ty1: number,
): boolean {
  const g = s.grid;
  for (let cy = ty0 * 4; cy < (ty1 + 1) * 4; cy++)
    for (let cx = tx0 * 4; cx < (tx1 + 1) * 4; cx++) if (g.ground[cy * g.width + cx] === mat) return false;
  return true;
}

/** True when nothing burns in tiles (tx0..tx1, ty0..ty1). */
export function noFire(s: GameState, tx0: number, ty0: number, tx1: number, ty1: number): boolean {
  const g = s.grid;
  for (let cy = ty0 * 4; cy < (ty1 + 1) * 4; cy++)
    for (let cx = tx0 * 4; cx < (tx1 + 1) * 4; cx++) if (g.fire[cy * g.width + cx]! > 0) return false;
  return true;
}

export const BOLT = 'Cast > Bolt[Fire]';
export const STRIKE = 'Cast > Strike[]';
export const SWATH = 'Cast > Swath[Fire]';
export const LOB = 'Cast > Lob[Fire]';
export const FROST_LOB = 'Cast > Lob[Frost]';
/** A Lob[Frost] (slot 2) at cell (x, y). */
export const freeze = (x: number, y: number): ScriptCommand => ({ do: 'cast', slot: 2, at: { x, y } });
export const into = (id: string) => (s: GameState) => s.room.id === id;
/** Small keys held for the Kiln. */
export const keys = (s: GameState): number => s.world.keys['kiln'] ?? 0;

/** Ticks each solution took, printed after a test file (the report quotes them). */
export const ticksLog: Record<string, number> = {};

/** Runs a script and expects it to finish; logs its ticks under `name`. */
export function solve(name: string, state: GameState, script: ScriptCommand[], max?: number): ScriptResult {
  const r = runScript(state, script, max);
  ticksLog[name] = r.ticks;
  expect(r.error, `${name} at (${state.player.x.toFixed(1)}, ${state.player.y.toFixed(1)})`).toBeUndefined();
  return r;
}
