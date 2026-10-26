/**
 * Helpers for the Glasswater Fen and Drowned Foundry puzzle tests (BUILD_PLAN M8 phase 1 task 10,
 * data/rooms/SOLUTIONS.md): an adventure entered into a Fen room the way play reaches it, with a
 * tier 8 character's runes (every M2–M7 rune, CONTENT §13), Tide from F6 on, and the weaves a
 * solution uses. The puzzles are not about mana, so spells cost none (a tier 8 character has
 * plenty); enemies are frozen unless a test says otherwise.
 */
import { expect } from 'vitest';
import { fenRooms } from '../../../data/progression';
import { runeIds, runes, type RuneId } from '../../../data/runes';
import {
  createAdventure,
  enterRoom,
  runScript,
  setSlotWeave,
  type Edge,
  type GameState,
  type ScriptCommand,
  type ScriptResult,
  type WorldObject,
} from '../../../src/sim';
import { giveRune } from '../hero/helpers';
import { weaveRunes } from './regionSolve';
import { ROOMS } from './worldHelpers';
import { T, type PuzzleStep } from '../../../src/sim/bots/fenPuzzles';

export type FenShort = keyof typeof fenRooms;

/** Play order: the overworld (G7 off G5), the Foundry's first half, F6's Tide, the second half. */
export const FEN_ORDER = Object.keys(fenRooms) as FenShort[];

/** Every rune a tier 8 character owns (CONTENT §13): all but the M8 ones. */
export const TIER8_RUNES: readonly RuneId[] = runeIds.filter((r) => runes[r].ships !== 'M8');

/** Runes on arriving in `room`: a tier 8 character's, plus Tide once F6 is behind (F7 on). */
export function fenRunesBy(room: FenShort): RuneId[] {
  const out = new Set<RuneId>(TIER8_RUNES);
  if (FEN_ORDER.indexOf(room) > FEN_ORDER.indexOf('f6')) out.add('tide');
  return [...out].sort();
}

export interface FenSetup {
  /** Edge of the room the player arrives through (null: the room's default spawn). */
  arrive: Edge | null;
  /** Weaves for slots 0..4 (null: empty). */
  weaves: (string | null)[];
  /** Runes to leave out (the "can't be solved without" attempts). */
  without?: RuneId[];
  /** Runes beyond those of the rooms before this one (Gale for G7's cache, after the Coil). */
  extra?: RuneId[];
  /** Enemy AI frozen (default true: the puzzle isn't the fight). */
  noAI?: boolean;
  /** No damage (default true). */
  god?: boolean;
  /** Kill every enemy on arrival (rooms with `cleared` doors, or enemies near the puzzle). */
  killAll?: boolean;
}

const OPPOSITE: Record<Edge, Edge> = { w: 'e', e: 'w', n: 's', s: 'n' };

/** An adventure in Fen room `room` with a tier 8 character's runes and the solution's weaves. */
export function prepareFen(room: FenShort, setup: FenSetup): GameState {
  const id = fenRooms[room];
  const state = createAdventure({ seed: 1, rooms: ROOMS, startRoomId: id });
  const unlocked = [...fenRunesBy(room), ...(setup.extra ?? [])].filter((r) => !setup.without?.includes(r));
  for (let slot = 0; slot < 5; slot++) setSlotWeave(state, slot, null);
  const hero = state.hero;
  hero.runes = hero.runes.filter((r) => unlocked.includes(r.rune));
  hero.unlockedRunes = hero.unlockedRunes.filter((r) => unlocked.includes(r));
  for (const r of unlocked) if (!hero.runes.some((i) => i.rune === r)) giveRune(state, r);
  const need = new Map<RuneId, number>();
  for (const w of setup.weaves) for (const r of w ? weaveRunes(w) : []) need.set(r, (need.get(r) ?? 0) + 1);
  for (const [r, n] of need) {
    if (!unlocked.includes(r)) throw new Error(`${room}: ${r} isn't unlocked by then`);
    for (let have = hero.runes.filter((i) => i.rune === r).length; have < n; have++) giveRune(state, r);
  }
  setup.weaves.forEach((w, slot) => {
    if (w === null) return;
    const out = setSlotWeave(state, slot, w);
    if (!out.applied) throw new Error(`${room}: weave ${w} didn't apply`);
  });
  if (setup.arrive) enterRoom(state, id, { kind: 'edge', from: OPPOSITE[setup.arrive] });
  state.cheats.noAI = setup.noAI ?? true;
  state.cheats.god = setup.god ?? true;
  state.cheats.infiniteMana = true;
  if (setup.killAll) killAll(state);
  return state;
}

/** Removes every enemy (as the console's `killall`), so `cleared` doors can open. */
export function killAll(state: GameState): void {
  for (const e of state.enemies) {
    e.life = 0;
    e.dead = true;
  }
}

export {
  allOn,
  anyOn,
  BOLT_FIRE,
  BOLT_STORM,
  cast,
  into,
  LOB_FIRE,
  LOB_FROST,
  LOB_STORM,
  objectsOf as objects,
  powered,
  STRIKE,
  T,
} from '../../../src/sim/bots/fenPuzzles';

/** A tile's center as a point. */
export const at = (tx: number, ty: number) => ({ x: T(tx), y: T(ty) });
/** The door object on tile (tx, ty) (several tiles make one door; each is an object). */
export const doorAt = (s: GameState, tx: number, ty: number): WorldObject =>
  s.objects.find((o) => o.kind === 'door' && o.tx === tx && o.ty === ty)!;

/** Ticks each solution took, printed after a test file (the report quotes them). */
export const fenTicks: Record<string, number> = {};

/** Runs a script and expects it to finish; logs its ticks under `name`. */
export function solveFen(
  name: string,
  state: GameState,
  script: ScriptCommand[],
  max?: number,
): ScriptResult {
  const r = runScript(state, script, max);
  fenTicks[name] = r.ticks;
  expect(r.error, `${name} at (${state.player.x.toFixed(1)}, ${state.player.y.toFixed(1)})`).toBeUndefined();
  return r;
}

/**
 * Runs a shared solution step (bots/fenPuzzles.ts, foundryPuzzles.ts: the scripts the Fen
 * campaign bot plays) in `room` arrived through `arrive`, and expects it to finish.
 */
export function solveStep(
  room: FenShort,
  arrive: Edge | null,
  step: PuzzleStep,
  setup: Omit<FenSetup, 'arrive' | 'weaves'> = {},
  max?: number,
): GameState {
  const s = prepareFen(room, { ...setup, arrive, weaves: step.weaves });
  solveFen(step.name, s, step.script(s), max);
  return s;
}

/** Runs each script in turn on the same state (failures allowed) and returns their errors. */
export function attempts(state: GameState, scripts: ScriptCommand[][], maxTicks = 30 * 60): string[] {
  const errors: string[] = [];
  for (const sc of scripts) {
    const r = runScript(state, sc, maxTicks);
    if (r.error) errors.push(r.error);
  }
  return errors;
}
