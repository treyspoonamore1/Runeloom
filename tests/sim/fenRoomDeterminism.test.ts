/**
 * BUILD_PLAN M8 phase 1 acceptance "Determinism and saves", in a real Fen room: G5 Fogbank (fog
 * over most of the room, Bellows Toads blowing it off with gusts, Sparkflies) with the player
 * casting Gale gusts (Strike[Gale]), borrowed water (Lob[Tide]) and Storm into its channels,
 * enemies awake and hitting back (god mode). Two runs of a seed hash the same; a save made there
 * mid-fight, with borrowed water and gusts live, round-trips and plays on deterministically.
 * (tests/sim/m8Determinism.test.ts covers a synthetic room with room wind and vents.)
 */
import { describe, expect, it } from 'vitest';
import { AIR } from '../../data/materials';
import { fenRooms } from '../../data/progression';
import {
  Button,
  createAdventure,
  hashProgress,
  hashState,
  loadSave,
  makeSave,
  parseSave,
  setSlotWeave,
  step,
  type GameState,
  type InputFrame,
} from '../../src/sim';
import { giveRune } from './hero/helpers';
import { ROOMS } from './world/worldHelpers';

const G5 = fenRooms.g5;
const WEAVES = ['Cast > Bolt[Fire]', 'Cast > Strike[Gale]', 'Cast > Lob[Tide]', 'Cast > Lob[Storm]'];
const SLOT = [Button.Cast1, Button.Cast2, Button.Cast3, Button.Cast4];

function game(seed: number): GameState {
  const s = createAdventure({ seed, rooms: ROOMS, startRoomId: G5 });
  for (const r of [
    'cast',
    'cast',
    'cast',
    'cast',
    'bolt',
    'strike',
    'lob',
    'lob',
    'fire',
    'gale',
    'tide',
    'storm',
  ] as const)
    giveRune(s, r);
  s.hero.unlockedRunes.sort(); // as unlockRune keeps them (saves store them sorted)
  for (let slot = 0; slot < 5; slot++) setSlotWeave(s, slot, null);
  WEAVES.forEach((w, slot) => {
    if (!setSlotWeave(s, slot, w).applied) throw new Error(`weave ${w} didn't apply`);
  });
  s.cheats.god = true;
  s.cheats.infiniteMana = true;
  return s;
}

/** Tick t's input: wander, and every half second cast one of the four weaves at a channel. */
function input(s: GameState, t: number): InputFrame {
  const a = (t * 0.011) % (2 * Math.PI);
  const k = Math.floor(t / 30) % 4;
  const press = t % 30 < 12;
  return {
    moveX: Math.cos(a) * 0.6,
    moveY: Math.sin(a * 1.3) * 0.6,
    aimX: s.player.x + 14 * Math.cos(a * 2),
    aimY: s.player.y + 14 * Math.sin(a * 2),
    buttons: (press ? SLOT[k]! : 0) | (t % 211 === 0 ? Button.Dodge : 0),
  };
}

interface Seen {
  fog: boolean;
  gusts: boolean;
  borrowed: boolean;
}

function play(s: GameState, from: number, ticks: number, seen?: Seen): number[] {
  const hashes: number[] = [];
  for (let t = from; t < from + ticks; t++) {
    step(s, input(s, t));
    if (seen) {
      const g = s.grid;
      if (g.air.some((x) => x === AIR.fog)) seen.fog = true;
      if (g.gusts.length > 0) seen.gusts = true;
      if (g.borrowed.some((b) => b === 1)) seen.borrowed = true;
    }
    if (t % 60 === 0) hashes.push(hashState(s));
  }
  return hashes;
}

const load = (json: string): GameState =>
  loadSave(parseSave(json), (init) =>
    createAdventure({ seed: init.seed, rooms: ROOMS, hero: init.hero, world: init.world }),
  );

describe('determinism and saves in G5 Fogbank (fog, gusts, borrowed water)', () => {
  it('two runs of a seed hash the same every second, with fog, gusts and borrowed terrain live', () => {
    const seen: Seen = { fog: false, gusts: false, borrowed: false };
    const a = play(game(7), 0, 2400, seen);
    const b = play(game(7), 0, 2400);
    expect(seen).toEqual({ fog: true, gusts: true, borrowed: true });
    expect(a).toEqual(b);
    expect(play(game(8), 0, 2400).at(-1)).not.toBe(a.at(-1));
  }, 120_000);

  it('a save made mid-fight round-trips there and plays on the same from both loads', () => {
    const s = game(3);
    play(s, 0, 900);
    expect(s.room.id).toBe(G5);
    expect(s.grid.borrowed.some((b) => b === 1) || s.grid.gusts.length > 0).toBe(true);
    const json = JSON.stringify(makeSave(s));
    const save = parseSave(json);
    expect(save).toEqual(JSON.parse(json));
    const a = load(json);
    const b = load(json);
    expect(hashProgress(a)).toBe(hashProgress(s));
    expect(a.room.id).toBe(G5);
    // The room comes back from its file: the fog bank is there, borrowed terrain is not.
    expect(a.grid.air.some((x) => x === AIR.fog)).toBe(true);
    expect(a.grid.borrowed.every((x) => x === 0)).toBe(true);
    for (const g of [a, b]) {
      g.cheats.god = true;
      g.cheats.infiniteMana = true;
    }
    expect(play(a, 900, 900)).toEqual(play(b, 900, 900));
    expect(hashProgress(a)).toBe(hashProgress(b));
  }, 120_000);
});
