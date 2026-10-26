import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Session } from '../../src/app/session';
import type { RuneCounts } from '../../src/app/loadout';
import { setLoadoutStorage } from '../../src/ui/loom/loadoutStore';
import { createItemGet, itemGetActions } from '../../src/ui/itemGet/itemGetFlow';
import { signal } from '@preact/signals';
import type { Screen } from '../../src/ui/hudBar';
import { itemGetView, suggestWeave, withElement } from '../../src/ui/itemGet/itemGetModel';
import { giveRune } from '../sim/hero/helpers';
import { step, NEUTRAL_INPUT, type SimEvent } from '../../src/sim';

beforeEach(() => setLoadoutStorage(null));
afterEach(() => setLoadoutStorage(null));

const NEW_GAME_SLOTS = ['Cast > Bolt[Fire]', 'Cast > Strike[]', null, null];
const counts = (free: Record<string, number>): RuneCounts =>
  Object.fromEntries(Object.entries(free).map(([k, n]) => [k, { free: n, total: n + 1 }])) as RuneCounts;

describe('the item-get panel text', () => {
  it('names the Frost rune, gives one line of flavor and what it does in the world', () => {
    const v = itemGetView('frost', { counts: {}, unlimited: true, slots: NEW_GAME_SLOTS });
    expect(v.title).toBe('Frost Rune');
    expect(v.flavor.length).toBeGreaterThan(10);
    expect(v.does.length).toBeGreaterThanOrEqual(2);
    expect(v.does.length).toBeLessThanOrEqual(3);
    const all = v.does.join(' ');
    for (const w of ['shallow water', 'walkable ice', 'deep water', 'bridge', 'fire', 'freezes'])
      expect(all).toContain(w);
  });

  it('names the Storm rune and says it electrifies water and metal, shocks and arcs', () => {
    const v = itemGetView('storm', { counts: {}, unlimited: true, slots: NEW_GAME_SLOTS });
    expect(v.title).toBe('Storm Rune');
    const all = v.does.join(' ');
    for (const w of ['Electrifies water and metal', 'Shocks', 'Arcs between wet enemies'])
      expect(all).toContain(w);
  });

  it('names the Tide rune (F6): borrowed water for 10 s, douses, strands swimmers', () => {
    const v = itemGetView('tide', { counts: {}, unlimited: true, slots: NEW_GAME_SLOTS });
    expect(v.title).toBe('Tide Rune');
    expect(v.flavor.length).toBeGreaterThan(10);
    expect(v.does.length).toBeGreaterThanOrEqual(2);
    expect(v.does.length).toBeLessThanOrEqual(3);
    const all = v.does.join(' ');
    for (const w of ['water for 10 s', 'pits', 'mud', 'Douses', 'strand']) expect(all).toContain(w);
  });

  it("names the Gale rune (the Coil's drop): gusts fan fire, drift smoke, clear fog, spin vanes", () => {
    const v = itemGetView('gale', { counts: {}, unlimited: true, slots: NEW_GAME_SLOTS });
    expect(v.title).toBe('Gale Rune');
    expect(v.flavor).toContain('Coil');
    expect(v.does.length).toBeGreaterThanOrEqual(2);
    expect(v.does.length).toBeLessThanOrEqual(3);
    const all = v.does.join(' ');
    for (const w of ['2 s gust', 'downwind', 'smoke and steam', 'fog', 'wind vanes', 'Physical', 'twice as far'])
      expect(all).toContain(w);
  });
});

describe('the weave suggestion', () => {
  it('suggests a new Cast > Bolt[Frost] in the first free slot when Cast and Bolt are free', () => {
    const s = suggestWeave('frost', {
      counts: counts({ cast: 1, bolt: 1, frost: 1 }),
      unlimited: false,
      slots: NEW_GAME_SLOTS,
    });
    expect(s).toEqual({
      kind: 'new',
      slot: 2,
      notation: 'Cast > Bolt[Frost]',
      stub: 'Cast > Bolt[]',
      text: 'Weave it in the Loom (Tab) — try Cast > Bolt[Frost] in Q',
      why: '',
    });
  });

  it('falls back to the next free form, e.g. Lob', () => {
    const s = suggestWeave('storm', {
      counts: counts({ cast: 1, bolt: 0, lob: 1 }),
      unlimited: false,
      slots: NEW_GAME_SLOTS,
    });
    expect(s.notation).toBe('Cast > Lob[Storm]');
  });

  it('suggests swapping into an existing weave when no Cast or form rune is free', () => {
    const cases: Record<string, number>[] = [
      { cast: 0, bolt: 1 },
      { cast: 1, bolt: 0, strike: 0 },
    ];
    for (const free of cases) {
      const s = suggestWeave('frost', { counts: counts(free), unlimited: false, slots: NEW_GAME_SLOTS });
      expect(s.kind).toBe('swap');
      expect(s.slot).toBe(0);
      expect(s.notation).toBe('Cast > Bolt[Frost]');
      expect(s.text).toBe(
        'Swap it into a weave in the Loom (Tab) — try Cast > Bolt[Frost] in LMB (instead of Fire)',
      );
      expect(s.why).toBe('Every Cast and form rune you own is already woven.');
    }
  });

  it('suggests a swap when every slot is full, and skips weaves it would not fit', () => {
    const slots = ['Cast > Bolt[Fire, Split]', 'Cast > Strike[]', 'Pulse > Nova[Fire]', 'Cast > Lob[Fire]'];
    const s = suggestWeave('frost', {
      counts: counts({ cast: 3, bolt: 1 }),
      unlimited: false,
      slots,
      fits: (_n, slot) => slot !== 0,
    });
    // LMB doesn't fit (say, Capacity): the next Cast weave with an element to replace is Lob in E.
    expect(s).toMatchObject({ kind: 'swap', slot: 3, notation: 'Cast > Lob[Frost]' });
    expect(s.why).toBe('All four weave slots are in use.');
  });

  it('adds the element to a weave without one when nothing can be replaced', () => {
    const s = suggestWeave('frost', {
      counts: counts({}),
      unlimited: false,
      slots: ['Cast > Strike[]', null, null, null],
    });
    expect(s).toMatchObject({ kind: 'swap', slot: 0, notation: 'Cast > Strike[Frost]' });
    expect(s.text).not.toContain('instead of');
  });

  it('withElement replaces the first element in the root brackets, else puts it first', () => {
    expect(withElement('Cast > Bolt[Fire, Split] > On Hit > Nova[Fire]', 'Storm')).toEqual({
      notation: 'Cast > Bolt[Storm, Split] > On Hit > Nova[Fire]',
      replaced: 'Fire',
    });
    expect(withElement('Cast > Bolt[Split]', 'Frost')).toEqual({
      notation: 'Cast > Bolt[Frost, Split]',
      replaced: null,
    });
    expect(withElement('Cast > Strike[]', 'Frost')?.notation).toBe('Cast > Strike[Frost]');
  });
});

describe('the item-get flow on a real adventure session', () => {
  const session = () => {
    const s = new Session({ seed: 1, roomId: 'test/wilds', sceneId: 'adventure', mode: 'adventure' });
    giveRune(s.state, 'frost');
    return s;
  };
  const moment = (source: 'shrine' | 'boss', rune: 'frost' | 'storm' = 'frost'): SimEvent => ({
    type: 'elementUnlocked',
    rune,
    roomId: 'kiln/k6_frost_shrine',
    x: 0,
    y: 0,
    source,
  });

  it('a new game hero (both Casts woven) is told to swap Frost into LMB; a third Cast and a Lob make it a new weave', () => {
    const s = session();
    const ig = createItemGet(s);
    expect(ig.build('frost').suggestion).toMatchObject({
      kind: 'swap',
      slot: 0,
      notation: 'Cast > Bolt[Frost]',
    });
    giveRune(s.state, 'cast');
    giveRune(s.state, 'lob');
    expect(ig.build('frost').suggestion).toMatchObject({
      kind: 'new',
      slot: 2,
      notation: 'Cast > Lob[Frost]',
    });
  });

  it('a shrine moment is due at once, a boss moment two seconds of sim time later, each once', () => {
    const s = session();
    const ig = createItemGet(s);
    ig.handleEvents([moment('shrine'), moment('shrine')]);
    expect(ig.due()).toBe('frost');
    expect(ig.due()).toBeNull();
    ig.handleEvents([moment('boss', 'storm')]);
    expect(ig.due()).toBeNull();
    for (let i = 0; i < 119; i++) step(s.state, NEUTRAL_INPUT);
    expect(ig.due()).toBeNull();
    step(s.state, NEUTRAL_INPUT);
    expect(ig.due()).toBe('storm');
    expect(ig.due()).toBeNull();
  });

  it('ignores moments outside adventure mode and forgets queued ones on clear', () => {
    const arena = new Session({ seed: 1, roomId: 'test/arena', sceneId: 'arena', mode: 'arena' });
    const a = createItemGet(arena);
    a.handleEvents([moment('shrine')]);
    expect(a.due()).toBeNull();
    const ig = createItemGet(session());
    ig.handleEvents([moment('shrine')]);
    ig.clear();
    expect(ig.due()).toBeNull();
  });
});

describe('opening and closing the panel', () => {
  const host = () => {
    const log: string[] = [];
    const screen = signal<Screen>('play');
    const armed = signal<string | null>(null);
    const h = {
      screen,
      enterModal: () => {
        log.push('pause');
        screen.value = 'itemGet';
      },
      leaveModal: () => {
        log.push('resume');
        screen.value = 'play';
      },
      openLoom: () => {
        log.push('loom');
        screen.value = 'loom';
      },
      loom: {
        selectSlot: (n: number) => log.push(`slot ${n}`),
        loadNotation: (n: string) => log.push(`draft ${n}`),
        armed,
      },
      fanfare: () => log.push('fanfare'),
      holdRune: (r: string | null) => log.push(`hold ${r}`),
    };
    return { h: h as unknown as Parameters<typeof itemGetActions>[1], log, screen, armed };
  };
  const withNewWeave = () => {
    const s = new Session({ seed: 1, roomId: 'test/wilds', sceneId: 'adventure', mode: 'adventure' });
    giveRune(s.state, 'frost');
    giveRune(s.state, 'cast');
    giveRune(s.state, 'lob');
    return createItemGet(s);
  };

  it('opens only from play: pauses, plays the fanfare and starts the pose', () => {
    const ig = withNewWeave();
    const { h, log, screen } = host();
    screen.value = 'inventory';
    itemGetActions(ig, h).open('frost');
    expect(log).toEqual([]);
    screen.value = 'play';
    itemGetActions(ig, h).open('frost');
    expect(log).toEqual(['pause', 'fanfare', 'hold frost']);
    expect(ig.view.peek()?.title).toBe('Frost Rune');
  });

  it('Continue resumes; Open the Loom opens it on the suggested slot with the suggested weave in place', () => {
    const ig = withNewWeave();
    const a = host();
    const act = itemGetActions(ig, a.h);
    act.open('frost');
    act.close(false);
    expect(a.log.slice(3)).toEqual(['hold null', 'resume']);
    expect(ig.view.peek()).toBeNull();
    const b = host();
    const act2 = itemGetActions(ig, b.h);
    act2.open('frost');
    act2.close(true);
    expect(b.log.slice(3)).toEqual(['hold null', 'resume', 'loom', 'slot 2', 'draft Cast > Lob[Frost]']);
    expect(b.armed.value).toBeNull();
  });
});
