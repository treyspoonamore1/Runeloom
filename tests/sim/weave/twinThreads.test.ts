/**
 * Twin Threads (M7, CONTENT §11): a weave slot on R, live on both weave bars. The loadout always
 * has nine slots (bar 1, R, bar 2); R is locked unless the hero owns the mutation.
 */
import { describe, expect, it } from 'vitest';
import {
  applyLoadoutEdit,
  applyLoadoutSpec,
  Button,
  createGame,
  hashProgress,
  hashState,
  listensFor,
  loadSave,
  LOCKED_SLOT_MESSAGE,
  makeSave,
  openSlotCount,
  parseSave,
  refreshHero,
  runFrames,
  setSlotWeave,
  slotOpen,
  SLOT_BUTTONS,
  type GameState,
  type InputFrame,
  type SaveData,
} from '../../../src/sim';
import { slotOfRune } from '../../../src/sim/hero/runes';
import { addEnemy, arena, ofType, tick, ticks, weaveArena } from './runtimeHelpers';
import { adventure, giveRune, OPEN_ROOM } from '../hero/helpers';
import { hub, ok } from '../meta/helpers';

const R = Button.Cast5;

function twin(state: GameState, owned = true): GameState {
  if (owned) state.hero.hearth.mutations.twin_threads = 1;
  else delete state.hero.hearth.mutations.twin_threads;
  refreshHero(state);
  return state;
}

describe('Twin Threads: the fifth weave slot', () => {
  it('R is its own button bit, after the four slot buttons', () => {
    const bar = [Button.Cast1, Button.Cast2, Button.Cast3, Button.Cast4];
    expect(SLOT_BUTTONS).toEqual([...bar, R, ...bar]);
    expect(R & (Button.Dodge | Button.Interact)).toBe(0);
  });

  it('is locked without the mutation: weaves are refused, R does nothing', () => {
    const s = arena();
    expect(openSlotCount(s)).toBe(8);
    expect([0, 1, 2, 3, 4, 5, 8, 9].map((i) => slotOpen(s, i))).toEqual([
      true,
      true,
      true,
      true,
      false,
      true,
      true,
      false,
    ]);
    const r = setSlotWeave(s, 4, 'Cast > Bolt[Fire]');
    expect(r.applied).toBe(false);
    expect(r.preview.compiled?.ok === false && r.preview.compiled.error.message).toBe(LOCKED_SLOT_MESSAGE);
    expect(s.weaves.slots[4]!.notation).toBeNull();
    expect(applyLoadoutEdit(s, { tick: 0, kind: 'weave', slot: 4, value: 'Cast > Bolt[Fire]' })).toBe(false);
    // Emptying it is always fine.
    expect(setSlotWeave(s, 4, null).applied).toBe(true);
    const ev = ticks(s, 30, R);
    expect(ofType(ev, 'castStart')).toHaveLength(0);
    expect(ofType(ev, 'triggerFired')).toHaveLength(0);
  });

  it('a weave given for the locked slot (spec or replay) stays but never fires', () => {
    const s = weaveArena([null, null, null, null, 'Cast > Bolt[Fire]']);
    expect(s.weaves.slots[4]).toMatchObject({ notation: 'Cast > Bolt[Fire]', program: null });
    expect(s.weaves.slots[4]!.error).toBe(LOCKED_SLOT_MESSAGE);
    expect(ofType(ticks(s, 30, R), 'castStart')).toHaveLength(0);
  });

  it('with the mutation R casts the fifth slot, and the other four are unchanged', () => {
    const s = twin(weaveArena(['Cast > Strike[]', null, null, null, 'Cast > Bolt[Fire]']));
    expect(openSlotCount(s)).toBe(9);
    expect(s.weaves.slots[4]!.program?.notation).toBe('Cast > Bolt[Fire]');
    const ev = ticks(s, 30, R);
    expect(ofType(ev, 'castStart').length).toBeGreaterThan(0);
    expect(new Set(ofType(ev, 'castStart').map((e) => e.slot))).toEqual(new Set([4]));
    expect(new Set(ofType(ev, 'triggerFired').map((e) => e.slot))).toEqual(new Set([4]));
    expect(ofType(ev, 'spellSpawn').some((e) => e.form === 'bolt')).toBe(true);
    // LMB still casts its own weave; holding both casts the lower slot first, as before.
    ticks(s, 60);
    const both = ticks(s, 1, Button.Cast1 | R);
    expect(ofType(both, 'castStart').map((e) => e.slot)).toEqual([0]);
    expect(setSlotWeave(s, 4, 'Cast > Nova[Fire, Pierce]').applied).toBe(false);
    expect(setSlotWeave(s, 4, 'Cast > Lob[Fire]').applied).toBe(true);
  });

  it('automatic triggers in the fifth slot fire as slot 4 (On Dodge, Pulse), only when it is open', () => {
    for (const owned of [false, true]) {
      const s = twin(weaveArena([null, null, null, null, 'OnDodge > Nova[Frost]']), owned);
      expect(listensFor(s, 'dodge_start')).toBe(owned);
      const ev = [...tick(s, Button.Dodge, undefined, [1, 0]), ...ticks(s, 5)];
      expect(ofType(ev, 'triggerFired').map((e) => [e.slot, e.trigger])).toEqual(
        owned ? [[4, 'on_dodge']] : [],
      );
      const p = twin(weaveArena([null, null, null, null, 'Pulse > Bolt[Fire]']), owned);
      addEnemy(p, 'dummy', 100, 60);
      const pv = ticks(p, 130);
      expect(ofType(pv, 'triggerFired').map((e) => e.slot)).toEqual(owned ? [4, 4] : []);
    }
  });

  it('losing the mutation (debug) locks the slot again: its weave keeps its notation and stops firing', () => {
    const s = twin(weaveArena([null, null, null, null, 'Pulse > Bolt[Fire]']));
    addEnemy(s, 'dummy', 100, 60);
    expect(ofType(ticks(s, 1), 'triggerFired')).toHaveLength(1);
    twin(s, false);
    expect(s.weaves.slots[4]).toMatchObject({ notation: 'Pulse > Bolt[Fire]', program: null });
    expect(ofType(ticks(s, 300), 'triggerFired')).toHaveLength(0);
  });

  it('heroes without the mutation step exactly as a four-slot loadout did', () => {
    const run = (fifth: string | null) => {
      const s = weaveArena(['Cast > Bolt[Fire]', 'Cast > Strike[]', 'Pulse > Bolt[Fire]', null, fifth]);
      addEnemy(s, 'dummy', 110, 60);
      for (let i = 0; i < 200; i++) tick(s, i % 40 < 20 ? Button.Cast1 | R : Button.Cast2);
      return s;
    };
    const a = run(null);
    const b = run('Cast > Bolt[Fire]');
    // The locked weave's notation is hashed, so compare everything but it.
    b.weaves.slots[4]!.notation = null;
    expect(hashState(b)).toBe(hashState(a));
  });
});

/** An adventure with Twin Threads and the runes for `Cast > Bolt[Fire]` in the fifth slot. */
function twinAdventure(seed = 3): GameState {
  const s = twin(adventure(seed));
  for (const r of ['cast', 'bolt', 'fire'] as const) giveRune(s, r);
  expect(setSlotWeave(s, 4, 'Cast > Bolt[Fire]').applied).toBe(true);
  return s;
}

function load(save: SaveData): GameState {
  return loadSave(save, (init) =>
    createGame({
      seed: init.seed,
      mode: 'adventure',
      roomText: OPEN_ROOM,
      hero: init.hero,
      world: init.world,
    }),
  );
}

describe('buying Twin Threads at the Hearth', () => {
  it("opens R at once (HearthEdit 'mutationBuy' refreshes the hero)", () => {
    const s = hub();
    for (const r of ['cast', 'bolt', 'fire'] as const) giveRune(s, r);
    expect(setSlotWeave(s, 4, 'Cast > Bolt[Fire]').applied).toBe(false);
    s.hero.hearth.ash += 10;
    ok(s, { kind: 'mutationBuy', mutation: 'twin_threads' });
    expect(openSlotCount(s)).toBe(9);
    expect(setSlotWeave(s, 4, 'Cast > Bolt[Fire]').applied).toBe(true);
    expect(s.weaves.slots[4]!.program).not.toBeNull();
  });
});

describe('Twin Threads in saves and replays', () => {
  it('a save keeps every slot and the R weave round-trips', () => {
    const s = twinAdventure();
    const json = JSON.stringify(makeSave(s));
    const save = parseSave(json);
    expect(save.weaves.notations).toHaveLength(9);
    expect(save.weaves.notations[4]).toBe('Cast > Bolt[Fire]');
    const loaded = load(save);
    expect(hashProgress(loaded)).toBe(hashProgress(s));
    expect(loaded.weaves.slots[4]!.program?.notation).toBe('Cast > Bolt[Fire]');
    expect(loaded.weaves.slots[4]!.runes).toEqual(s.weaves.slots[4]!.runes);
  });

  it('an older save with four slots loads with the fifth empty', () => {
    const raw = JSON.parse(JSON.stringify(makeSave(twinAdventure()))) as SaveData;
    raw.weaves.notations = raw.weaves.notations.slice(0, 4);
    raw.weaves.runes = raw.weaves.runes.slice(0, 4);
    const loaded = load(parseSave(raw));
    expect(loaded.weaves.slots).toHaveLength(9);
    expect(loaded.weaves.slots[4]).toMatchObject({ notation: null, runes: null, program: null });
    expect(loaded.weaves.slots[0]!.program?.notation).toBe('Cast > Bolt[Fire]');
  });

  it('a save with a fifth weave but no mutation empties it and frees its runes', () => {
    const s = twinAdventure();
    const uids = s.weaves.slots[4]!.runes!;
    const raw = JSON.parse(JSON.stringify(makeSave(s))) as SaveData;
    raw.hero.hearth.mutations = {};
    const loaded = load(parseSave(raw));
    expect(loaded.weaves.slots[4]).toMatchObject({ notation: null, runes: null });
    for (const u of uids) expect(slotOfRune(loaded, u)).toBe(-1);
  });

  it('a replay with a fifth-slot weave set mid-run and cast on R reproduces its hash', () => {
    const start = makeSave(twinAdventure(5));
    const enemyAt = (s: GameState) => addEnemy(s, 'dummy', 110, 60);
    const createState = () => {
      const s = load(parseSave(JSON.parse(JSON.stringify(start))));
      setSlotWeave(s, 4, null); // the edit below puts it back
      s.cheats.noAI = true;
      enemyAt(s);
      return s;
    };
    const frames: InputFrame[] = Array.from({ length: 240 }, (_, i) => ({
      moveX: 0,
      moveY: 0,
      aimX: 110,
      aimY: 60,
      buttons: i >= 20 && i % 30 < 15 ? R : 0,
    }));
    const edits = [{ tick: 10, kind: 'weave' as const, slot: 4, value: 'Cast > Bolt[Fire]' }];
    const opts = { seed: 5, mode: 'adventure' as const, loadoutEdits: edits, createState };
    const a = runFrames(frames, '', opts);
    const b = runFrames(frames, '', opts);
    expect(a.hash).toBe(b.hash);
    expect(a.state.weaves.slots[4]!.notation).toBe('Cast > Bolt[Fire]');
    expect(a.state.stats.fires).toBeGreaterThan(0);
    const none = runFrames(frames, '', { ...opts, loadoutEdits: [] });
    expect(none.hash).not.toBe(a.hash);
  });
});

describe('applyLoadoutSpec', () => {
  it('fills missing entries (R and bar 2) with empty slots', () => {
    const s = arena();
    applyLoadoutSpec(s, { spindleId: 'twig', notations: ['Cast > Bolt[Fire]'] });
    expect(s.weaves.slots.map((x) => x.notation)).toEqual(['Cast > Bolt[Fire]', ...Array<null>(8).fill(null)]);
  });
});
