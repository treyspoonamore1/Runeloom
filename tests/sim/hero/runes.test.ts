import { describe, expect, it } from 'vitest';
import {
  applyLoadoutEdit,
  createGame,
  newGameHero,
  newGameRunes,
  previewWeave,
  runeCounts,
  runeOrder,
  setSlotWeave,
  slotOfRune,
  parseWeave,
} from '../../../src/sim';
import { adventure, giveRune, OPEN_ROOM } from './helpers';

function tree(n: string) {
  const p = parseWeave(n);
  if (!p.ok) throw new Error(p.error.message);
  return p.tree;
}

function errorOf(state: ReturnType<typeof adventure>, slot: number, n: string): string | null {
  const out = setSlotWeave(state, slot, n);
  if (out.applied) return null;
  return (
    out.preview.parseError?.message ??
    (out.preview.compiled?.ok === false ? out.preview.compiled.error.message : '?')
  );
}

describe('new-game hero (CONTENT §9.1)', () => {
  it('has the Twig Spindle equipped, Cast, Bolt, Strike and Fire unlocked, and both weaves set', () => {
    const state = adventure();
    const h = state.hero;
    expect(h.items).toHaveLength(1);
    expect(h.items[0]!.base).toBe('twig');
    expect(h.equipped.spindle).toBe(h.items[0]!.uid);
    expect(h.unlockedRunes).toEqual(['bolt', 'cast', 'fire', 'strike']);
    expect(newGameRunes().sort()).toEqual(['bolt', 'cast', 'cast', 'fire', 'strike']);
    expect(state.weaves.spindleId).toBe('twig');
    expect(state.weaves.slots.map((s) => s.notation)).toEqual([
      'Cast > Bolt[Fire]',
      'Cast > Strike[]',
      null,
      null,
    ]);
    expect(state.weaves.slots[0]!.program).not.toBeNull();
    expect(state.weaves.slots[1]!.program).not.toBeNull();
    // Every rune item is socketed, each in exactly one place.
    const all = state.weaves.slots.flatMap((s) => s.runes ?? []);
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(h.runes.map((r) => r.uid).sort());
  });

  it("a hero without socketed runes can't fire in adventure mode", () => {
    const state = createGame({ seed: 1, roomText: OPEN_ROOM, mode: 'adventure', hero: newGameHero() });
    // createGame's default loadout has notations but no socketed runes.
    expect(state.weaves.slots[0]!.program).toBeNull();
    expect(state.weaves.slots[0]!.error).toMatch(/No runes/);
  });
});

describe('rune ownership and the one-place rule', () => {
  it('rejects a weave the hero has no free runes for, saying which', () => {
    const state = adventure();
    expect(errorOf(state, 2, 'Cast > Bolt[Fire]')).toBe('Needs 1 Cast rune; you have 0 free');
    giveRune(state, 'cast');
    expect(errorOf(state, 2, 'Cast > Bolt[Fire]')).toBe('Needs 1 Bolt rune; you have 0 free');
    giveRune(state, 'bolt');
    giveRune(state, 'on_hit');
    giveRune(state, 'nova');
    giveRune(state, 'fire');
    expect(errorOf(state, 2, 'Cast > Bolt[Fire] > OnHit > Nova[Fire]')).toBe(
      'Needs 2 Fire runes; you have 1 free',
    );
    expect(state.weaves.slots[2]!.notation).toBeNull();
    expect(state.weaves.slots[2]!.runes).toBeNull();
  });

  it('compile errors come before ownership errors', () => {
    const state = adventure();
    expect(errorOf(state, 2, 'Cast > Nova[Fire, Pierce]')).toBe("Nova can't take Pierce");
  });

  it('sockets specific items, each in one place, and frees them when the slot changes', () => {
    const state = adventure();
    const cast = giveRune(state, 'cast');
    const lob = giveRune(state, 'lob');
    const fire = giveRune(state, 'fire');
    expect(errorOf(state, 2, 'Cast > Lob[Fire]')).toBeNull();
    expect(state.weaves.slots[2]!.runes).toEqual([cast.uid, lob.uid, fire.uid]);
    expect(slotOfRune(state, lob.uid)).toBe(2);
    expect(runeCounts(state).lob).toEqual({ free: 0, total: 1 });
    // The same runes can't go in a second slot...
    expect(errorOf(state, 3, 'Cast > Lob[Fire]')).toBe('Needs 1 Cast rune; you have 0 free');
    // ...but re-setting the slot that holds them reuses them.
    expect(errorOf(state, 2, 'Cast > Lob[Fire]')).toBeNull();
    // Emptying the slot returns them to the pouch.
    expect(errorOf(state, 2, null as unknown as string)).toBeNull();
    expect(slotOfRune(state, lob.uid)).toBe(-1);
    expect(runeCounts(state).lob).toEqual({ free: 1, total: 1 });
  });

  it("previewWeave counts the edited slot's own runes as free", () => {
    const state = adventure();
    const p = previewWeave(state, 'Cast > Bolt[Fire]');
    expect(p.compiled?.ok).toBe(false);
    expect(previewWeave(state, 'Cast > Bolt[Fire]', 0).compiled?.ok).toBe(true);
    expect(runeCounts(state, 0).bolt).toEqual({ free: 1, total: 1 });
  });

  it('prefers the highest-level free item, then the oldest', () => {
    const state = adventure();
    setSlotWeave(state, 0, null);
    const low = giveRune(state, 'bolt', 1);
    const high = giveRune(state, 'bolt', 7);
    const high2 = giveRune(state, 'bolt', 7);
    expect(errorOf(state, 0, 'Cast > Bolt[Fire]')).toBeNull();
    const socketed = state.weaves.slots[0]!.runes!;
    expect(socketed).toContain(high.uid);
    expect(socketed).not.toContain(high2.uid);
    expect(socketed).not.toContain(low.uid);
  });

  it('rune levels come from the socketed items: the form level scales damage, Pulse the period', () => {
    const state = adventure();
    const base = state.weaves.slots[0]!.program!.root.baseDamage;
    expect(base).toBe(12);
    const bolt = state.hero.runes.find((r) => r.rune === 'bolt')!;
    bolt.level = 5;
    setSlotWeave(state, 0, 'Cast > Bolt[Fire]');
    expect(state.weaves.slots[0]!.program!.root.baseDamage).toBeCloseTo(12 * 1.11 ** 4, 9);
    expect(state.weaves.slots[0]!.program!.runeLevel).toBe(1);
    // An element rune's level doesn't change the numbers (DECISIONS: form level only).
    state.hero.runes.find((r) => r.rune === 'fire')!.level = 9;
    setSlotWeave(state, 0, 'Cast > Bolt[Fire]');
    expect(state.weaves.slots[0]!.program!.root.baseDamage).toBeCloseTo(12 * 1.11 ** 4, 9);

    giveRune(state, 'pulse', 11);
    giveRune(state, 'lob');
    giveRune(state, 'fire');
    expect(errorOf(state, 2, 'Pulse > Lob[Fire]')).toBeNull();
    expect(state.weaves.slots[2]!.program!.trigger.period).toBeCloseTo(2 - 0.05 * 10, 9);
  });

  it('runeOrder lists trigger, then per spell: branch, form, items', () => {
    const order = runeOrder(tree('Cast > Bolt[Storm] { OnHit > Nova[Storm]; OnExpire > Lob[Fire] }'));
    expect(order.map((r) => r.rune)).toEqual([
      'cast',
      'bolt',
      'storm',
      'on_hit',
      'nova',
      'storm',
      'on_expire',
      'lob',
      'fire',
    ]);
    expect(order.map((r) => r.path.join('.'))).toEqual([
      'trigger',
      'root.form',
      'root.i0',
      'root.b0.branch',
      'root.b0.form',
      'root.b0.i0',
      'root.b1.branch',
      'root.b1.form',
      'root.b1.i0',
    ]);
  });

  it('the spindle follows the equipped item: Loom spindle edits are rejected in adventure mode', () => {
    const state = adventure();
    expect(applyLoadoutEdit(state, { tick: 0, kind: 'spindle', value: 'heartwood' })).toBe(false);
    expect(state.weaves.spindleId).toBe('twig');
  });

  it('sandbox games keep unlimited runes', () => {
    const state = createGame({ seed: 1, roomText: OPEN_ROOM });
    expect(setSlotWeave(state, 2, 'Cast > Bolt[Fire, Split, Pierce]').applied).toBe(true);
    expect(setSlotWeave(state, 3, 'Cast > Bolt[Fire, Split, Pierce]').applied).toBe(true);
    expect(state.weaves.slots.every((s) => s.runes === null)).toBe(true);
  });
});
