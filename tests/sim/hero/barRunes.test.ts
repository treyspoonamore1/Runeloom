/**
 * Rune items and the second weave bar (playtest 8): the two bars share the rune pouch, so one
 * item can sit in one slot of each bar, but never in two slots of one bar or in R (live on both
 * bars) and another slot. Rune XP goes only to the live slots' runes.
 */
import { describe, expect, it } from 'vitest';
import { runeXpToNext } from '../../../data/progression';
import {
  applyLoadoutEdit,
  freeRunes,
  grantRuneXp,
  recompileWeaves,
  refreshHero,
  runeCounts,
  setSlotWeave,
  slotOfRune,
  socketedUids,
  swapBar,
  type GameState,
} from '../../../src/sim';
import { plant } from '../meta/helpers';
import { adventure, giveRune } from './helpers';

const BOLT = 'Cast > Bolt[Fire]';

function errorOf(state: GameState, slot: number, n: string): string | null {
  const out = setSlotWeave(state, slot, n);
  if (out.applied) return null;
  return (
    out.preview.parseError?.message ?? (out.preview.compiled?.ok === false ? out.preview.compiled.error.message : '?')
  );
}

const xpOf = (s: GameState, uid: number) => s.hero.runes.find((r) => r.uid === uid)!.xp;

describe('the two bars share the rune pouch', () => {
  it("bar 2 can socket the items bar 1 uses: the new game's Bolt and Strike fit on bar 2 too", () => {
    const s = adventure();
    expect(errorOf(s, 5, BOLT)).toBeNull();
    expect(errorOf(s, 6, 'Cast > Strike[]')).toBeNull();
    expect(s.weaves.slots[5]!.runes).toEqual(s.weaves.slots[0]!.runes);
    expect(new Set(s.weaves.slots[6]!.runes)).toEqual(new Set(s.weaves.slots[1]!.runes));
    expect(s.weaves.slots[5]!.program).not.toBeNull();
    // Replayed Loom edits follow the same rule.
    expect(applyLoadoutEdit(s, { tick: 0, kind: 'weave', slot: 8, value: null })).toBe(true);
  });

  it('no sharing within a bar: a second slot on the same bar needs its own items', () => {
    const s = adventure();
    expect(errorOf(s, 2, BOLT)).toMatch(/^Needs 1 Cast rune; you have 0 free/);
    expect(errorOf(s, 5, BOLT)).toBeNull();
    expect(errorOf(s, 7, BOLT)).toMatch(/^Needs 1 Bolt rune; you have 0 free/);
    // The item count per slot: free for its own slot and for the other bar, not for its bar.
    expect(runeCounts(s, 5).bolt).toEqual({ free: 1, total: 1 });
    expect(runeCounts(s, 7).bolt).toEqual({ free: 0, total: 1 });
    expect(runeCounts(s, 2).bolt).toEqual({ free: 0, total: 1 });
    expect(runeCounts(s).bolt).toEqual({ free: 0, total: 1 });
    expect(freeRunes(s, 3).map((r) => r.rune)).toEqual([]);
  });

  it('R (Twin Threads) is on both bars: its items clash with every slot', () => {
    const s = adventure();
    s.hero.hearth.mutations.twin_threads = 1;
    refreshHero(s);
    expect(errorOf(s, 5, BOLT)).toBeNull();
    expect(errorOf(s, 4, BOLT)).toMatch(/you have 0 free/);
    setSlotWeave(s, 5, null);
    expect(errorOf(s, 4, BOLT)).toMatch(/you have 0 free/); // still in bar 1's LMB
    setSlotWeave(s, 0, null);
    expect(errorOf(s, 4, BOLT)).toBeNull();
    expect(errorOf(s, 0, BOLT)).toMatch(/you have 0 free/);
    expect(errorOf(s, 5, BOLT)).toMatch(/you have 0 free/);
  });

  it('planted runes are taken for both bars; a rune in any slot counts as socketed', () => {
    const s = adventure();
    const [lob] = plant(s, ['lob']);
    expect(errorOf(s, 5, 'Cast > Lob[Fire]')).toMatch(/Lob rune; you have 0 free/);
    const own = giveRune(s, 'lob');
    expect(errorOf(s, 5, 'Cast > Lob[Fire]')).toBeNull();
    expect(s.weaves.slots[5]!.runes).toContain(own.uid);
    expect(s.weaves.slots[5]!.runes).not.toContain(lob!.uid);
    expect(slotOfRune(s, own.uid)).toBe(5);
    expect(socketedUids(s).has(own.uid)).toBe(true);
  });
});

describe('rune XP goes only to the live slots', () => {
  function twoBars(): { s: GameState; lob: number; cast: number; strike: number } {
    const s = adventure();
    const lob = giveRune(s, 'lob').uid;
    expect(errorOf(s, 5, 'Cast > Lob[Fire]')).toBeNull();
    const cast = s.weaves.slots[0]!.runes![0]!;
    expect(s.weaves.slots[5]!.runes![0]).toBe(cast); // shared with bar 1's LMB
    const strike = s.weaves.slots[1]!.runes![1]!;
    return { s, lob, cast, strike };
  }

  it("the inactive bar's runes gain nothing; a shared item gains once", () => {
    const { s, lob, cast, strike } = twoBars();
    grantRuneXp(s, 10);
    expect(xpOf(s, lob)).toBe(0);
    expect(xpOf(s, cast)).toBe(10);
    expect(xpOf(s, strike)).toBe(10);
    swapBar(s);
    grantRuneXp(s, 10);
    expect(xpOf(s, lob)).toBe(10);
    expect(xpOf(s, cast)).toBe(20);
    expect(xpOf(s, strike)).toBe(10); // bar 1's RMB isn't live now
  });

  it("a level-up of a shared item recompiles the other bar's weave too", () => {
    const { s, lob, cast } = twoBars();
    const changed = grantRuneXp(s, runeXpToNext(1));
    expect(s.hero.runes.find((r) => r.uid === cast)!.level).toBe(2);
    expect(s.hero.runes.find((r) => r.uid === lob)!.level).toBe(1);
    expect(changed).toContain(0);
    expect(changed).toContain(5);
    recompileWeaves(s, changed);
    expect(s.weaves.slots[5]!.program).not.toBeNull();
  });
});
