/**
 * Saves and the second weave bar (playtest 8, save version 4): bar 2's slots and the live bar
 * are saved; saves from before load with bar 2 empty on bar 1; one rune item may be socketed on
 * both bars, but not twice on one bar.
 */
import { describe, expect, it } from 'vitest';
import {
  createGame,
  hashProgress,
  loadSave,
  makeSave,
  parseSave,
  SAVE_VERSION,
  setSlotWeave,
  swapBar,
  type GameState,
  type SaveData,
} from '../../src/sim';
import { adventure, giveRune, OPEN_ROOM } from './hero/helpers';

function load(save: SaveData): GameState {
  return loadSave(save, (init) =>
    createGame({ seed: init.seed, mode: 'adventure', roomText: OPEN_ROOM, hero: init.hero, world: init.world }),
  );
}

/** A new-game adventure with bar 2 woven (sharing bar 1's items, plus a Fire Lob of its own), on bar 2. */
function twoBars(): GameState {
  const s = adventure(4);
  giveRune(s, 'lob');
  giveRune(s, 'fire');
  s.hero.unlockedRunes.sort(); // as a loaded hero has them
  expect(setSlotWeave(s, 5, 'Cast > Bolt[Fire]').applied).toBe(true);
  expect(setSlotWeave(s, 7, 'Cast > Lob[Fire]').applied).toBe(true);
  swapBar(s);
  return s;
}

const raw = (s: GameState) => JSON.parse(JSON.stringify(makeSave(s))) as SaveData;

describe('saves with two weave bars', () => {
  it('is save version 4', () => {
    expect(SAVE_VERSION).toBe(4);
    expect(makeSave(adventure()).version).toBe(4);
  });

  it('round-trips bar 2, its shared and own rune items, and the live bar', () => {
    const s = twoBars();
    const save = parseSave(JSON.stringify(makeSave(s)));
    expect(save.weaves.notations).toHaveLength(9);
    expect(save.weaves.activeBar).toBe(1);
    expect(save.weaves.runes[5]).toEqual(s.weaves.slots[0]!.runes);
    const loaded = load(save);
    expect(hashProgress(loaded)).toBe(hashProgress(s));
    expect(loaded.weaves.activeBar).toBe(1);
    expect(loaded.weaves.swapLeft).toBe(0);
    for (const i of [0, 1, 5, 7]) {
      expect(loaded.weaves.slots[i]!.program?.notation).toBe(s.weaves.slots[i]!.notation);
      expect(loaded.weaves.slots[i]!.runes).toEqual(s.weaves.slots[i]!.runes);
    }
  });

  it('hashProgress sees the live bar', () => {
    const s = twoBars();
    const h = hashProgress(s);
    swapBar(s);
    expect(hashProgress(s)).not.toBe(h);
  });

  it('a version 3 save (five slots, no live bar) loads with bar 2 empty, on bar 1', () => {
    const v3 = raw(adventure(2));
    v3.version = 3 as never;
    v3.weaves.notations = v3.weaves.notations.slice(0, 5);
    v3.weaves.runes = v3.weaves.runes.slice(0, 5);
    delete (v3.weaves as Partial<SaveData['weaves']>).activeBar;
    const save = parseSave(JSON.stringify(v3));
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.weaves.activeBar).toBe(0);
    expect(save.weaves.notations).toEqual(['Cast > Bolt[Fire]', 'Cast > Strike[]', ...Array<null>(7).fill(null)]);
    const loaded = load(save);
    expect(loaded.weaves.activeBar).toBe(0);
    expect(loaded.weaves.slots.slice(5).every((x) => x.notation === null && x.runes === null)).toBe(true);
    expect(loaded.weaves.slots[0]!.program?.notation).toBe('Cast > Bolt[Fire]');
  });

  it('empties a slot whose items are already used on its own bar, but keeps sharing across bars', () => {
    const v = raw(twoBars());
    // Bar 1's Q claims LMB's items: not allowed on one bar, so it loads empty.
    v.weaves.notations[2] = v.weaves.notations[0]!;
    v.weaves.runes[2] = [...v.weaves.runes[0]!];
    const save = parseSave(v);
    expect(save.weaves.notations[2]).toBeNull();
    expect(save.weaves.runes[2]).toBeNull();
    expect(save.weaves.notations[0]).toBe('Cast > Bolt[Fire]');
    expect(save.weaves.notations[5]).toBe('Cast > Bolt[Fire]');
  });

  it('rejects a live bar other than 0 or 1', () => {
    const v = raw(twoBars());
    v.weaves.activeBar = 2;
    expect(() => parseSave(v)).toThrow(/weaves.activeBar/);
  });
});
