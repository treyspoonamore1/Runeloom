/** The second weave bar in the UI: the HUD strip and its other-bar preview, the Loom, the console, sound. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Session } from '../../src/app/session';
import { getLoadout, setWeave } from '../../src/app/loadout';
import { barSnap, slotSnaps, type CasterView } from '../../src/ui/hudSlots';
import { readSnap, snapEqual } from '../../src/ui/hudModel';
import { CommandRegistry } from '../../src/ui/console/commands';
import { registerM2Commands, type M2Env } from '../../src/ui/console/m2';
import { LoomState } from '../../src/ui/loom/loomState';
import { setLoadoutStorage } from '../../src/ui/loom/loadoutStore';
import { placements } from '../../src/ui/loom/model';
import { setFixtures } from '../../src/ui/fixtures/mode';
import { newGameHero } from '../../src/ui/fixtures/hero';
import { setFixtureHero } from '../../src/ui/fixtures/store';
import { suggestWeave } from '../../src/ui/itemGet/itemGetModel';
import { cuesForEvent } from '../../src/audio/cues';
import { refreshHero, swapBar } from '../../src/sim';

const idle: CasterView = { mana: 50, castSlot: -1, castLeft: 0, castTime: 0 };
const noTimers = () => ({ cooldownLeft: 0, cooldownTotal: 0 });
const arena = () => new Session({ seed: 1, roomId: 'test/arena', sceneId: 'arena', mode: 'arena' });

beforeEach(() => setLoadoutStorage(null));
afterEach(() => {
  setLoadoutStorage(null);
  setFixtures(false);
});

describe('HUD: the live bar and a preview of the other', () => {
  it('shows the live bar (and R) in the slot row and the other bar small beside it', () => {
    const s = arena();
    expect(setWeave(s, 5, 'Cast > Lob[Fire]').applied).toBe(true);
    let l = getLoadout(s);
    expect(slotSnaps(l, idle, noTimers).map((x) => x.slot)).toEqual([0, 1, 2, 3]);
    expect(barSnap(l)).toMatchObject({ active: 0 });
    expect(barSnap(l).other.map((m) => [m.slot, m.key, m.form])).toEqual([
      [5, 'LMB', 'lob'],
      [6, 'RMB', null],
      [7, 'Q', null],
      [8, 'E', null],
    ]);
    swapBar(s.state);
    l = getLoadout(s);
    const snaps = slotSnaps(l, idle, noTimers);
    expect(snaps.map((x) => [x.slot, x.key])).toEqual([
      [5, 'LMB'],
      [6, 'RMB'],
      [7, 'Q'],
      [8, 'E'],
    ]);
    expect(snaps[0]).toMatchObject({ name: 'Fire Lob', form: 'lob' });
    expect(barSnap(l).other.map((m) => m.slot)).toEqual([0, 1, 2, 3]);
    expect(barSnap(l).other[0]!.form).toBe('bolt');
  });

  it('R stays in the live row on both bars (Twin Threads)', () => {
    const s = arena();
    s.state.hero.hearth.mutations.twin_threads = 1;
    refreshHero(s.state);
    swapBar(s.state);
    expect(slotSnaps(getLoadout(s), idle, noTimers).map((x) => x.key)).toEqual(['LMB', 'RMB', 'Q', 'E', 'R']);
    expect(barSnap(getLoadout(s)).other).toHaveLength(4);
  });

  it('snapEqual sees a swap', () => {
    const s = arena();
    const snap = () => {
      const l = getLoadout(s);
      return readSnap(s.state, slotSnaps(l, idle, noTimers), barSnap(l));
    };
    const a = snap();
    expect(snapEqual(a, snap())).toBe(true);
    swapBar(s.state);
    expect(snapEqual(a, snap())).toBe(false);
  });

  it('a swap plays its light sound', () => {
    expect(cuesForEvent({ type: 'barSwap', bar: 1 }, arena().state).map((c) => c.id)).toEqual(['barSwap']);
  });
});

describe('the Loom edits both bars', () => {
  it('drafts are per slot; a bar-2 slot sees the pouch free of bar 1, but not of its own bar', () => {
    setFixtures(true);
    setFixtureHero(newGameHero());
    const s = new Session({ seed: 1, roomId: 'test/wilds', sceneId: 'adventure', mode: 'adventure' });
    const st = new LoomState(s);
    // Bar 1 uses every rune item.
    expect(Object.fromEntries(st.free.value!)).toEqual({ cast: 0, bolt: 0, strike: 0, fire: 0 });
    st.selectSlot(5);
    expect(Object.fromEntries(st.free.value!)).toEqual({ cast: 2, bolt: 1, strike: 1, fire: 1 });
    st.loadNotation('Cast > Bolt[Fire]');
    expect(st.status.kind).toBe('ok');
    expect(s.state.weaves.slots[5]!.notation).toBe('Cast > Bolt[Fire]');
    expect(Object.fromEntries(st.free.value!)).toEqual({ cast: 1, bolt: 0, strike: 1, fire: 0 });
    // Bar 2's RMB: its LMB took the Fire, so no free Fire for it; bar 1's Fire doesn't count.
    st.selectSlot(6);
    expect(st.free.value!.get('fire')).toBe(0);
    expect(placements(st.draft, 'fire', st.editOpts).every((x) => !x.ok)).toBe(true);
    expect(st.drafts.value[0]).not.toBe(st.drafts.value[5]);
  });
});

describe('console and item-get suggestions', () => {
  it('weave lmb2 / weave 6 set bar 2 slots; weaves lists both bars and the live one', () => {
    const reg = new CommandRegistry<M2Env>();
    registerM2Commands(reg);
    const env: M2Env = { session: arena() };
    const run = (line: string) => reg.execute(line, env);
    expect(run('weave lmb2 Cast > Lob[Fire]').lines[0]).toMatch(/^Bar 2 LMB: Cast > Lob\[Fire\]/);
    expect(env.session.state.weaves.slots[5]!.notation).toBe('Cast > Lob[Fire]');
    expect(run('weave 9 Cast > Strike[]').ok).toBe(true);
    expect(env.session.state.weaves.slots[8]!.notation).toBe('Cast > Strike[]');
    const lines = run('weaves').lines;
    expect(lines.some((l) => /^6 Bar 2 LMB +Cast > Lob\[Fire\]/.test(l))).toBe(true);
    expect(lines.at(-1)).toBe('Live bar: 1 of 2 (X swaps)');
  });

  it('suggestions go to the live bar: slot ids map the entries', () => {
    const sug = suggestWeave('frost', {
      counts: {},
      unlimited: true,
      slots: ['Cast > Bolt[Fire]', null, null, null],
      slotIds: [5, 6, 7, 8],
    });
    expect(sug).toMatchObject({ kind: 'new', slot: 6 });
    expect(sug.text).toContain('Bar 2 RMB');
  });
});
