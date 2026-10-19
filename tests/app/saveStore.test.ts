import { describe, expect, it } from 'vitest';
import { memoryBackend, SaveStore } from '../../src/app/saveStore';
import { makeSave, parseSave, SAVE_VERSION, type SaveData } from '../../src/app/saveFormat';
import { roomTexts } from '../../src/app/rooms';
import { createAdventure } from '../../src/sim';
import { createWorldState } from '../../src/sim/world/worldState';

/** A real save: a new game in `roomId` with the hero at `level`. */
function save(level: number, roomId = 'emberwood/e2_thicket'): SaveData {
  const state = createAdventure({ seed: 7, rooms: roomTexts, world: createWorldState(roomId) });
  state.hero.level = level;
  return { ...makeSave(state), tick: 3600 };
}

describe('save store (in-memory backend)', () => {
  it('writes, lists in slot order, and reads back the same data', async () => {
    let now = 1000;
    const store = new SaveStore(memoryBackend(), true, () => now);
    await store.write('slot2', save(4), 'Thicket');
    now = 2000;
    await store.write('auto', save(5), 'Riverbend');
    const list = await store.list();
    expect(list.map((r) => r.slot)).toEqual(['auto', 'slot2']);
    expect(list[0]).toMatchObject({
      level: 5,
      roomName: 'Riverbend',
      savedAt: 2000,
      roomId: 'emberwood/e2_thicket',
      ticks: 3600,
    });
    const r = await store.read('slot2');
    expect(r.ok && r.save).toEqual(save(4));
  });

  it('Continue picks the newest slot', async () => {
    let now = 5;
    const store = new SaveStore(memoryBackend(), true, () => now);
    await store.write('auto', save(2), 'A');
    now = 9;
    await store.write('slot3', save(3), 'B');
    now = 7;
    await store.write('slot1', save(1), 'C');
    expect((await store.latest())?.slot).toBe('slot3');
  });

  it('overwrites a slot, removes one, and reports empty or broken slots', async () => {
    const backend = memoryBackend();
    const store = new SaveStore(backend, true, () => 1);
    await store.write('slot1', save(2), 'A');
    await store.write('slot1', save(8), 'B');
    expect((await store.list()).map((r) => r.level)).toEqual([8]);
    await store.remove('slot1');
    expect(await store.read('slot1')).toEqual({ ok: false, error: 'That slot is empty' });
    await backend.put({
      slot: 'slot2',
      savedAt: 1,
      roomName: '',
      level: 1,
      roomId: '',
      ticks: 0,
      data: '{"format":"other"}',
    });
    const bad = await store.read('slot2');
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.error).toMatch(/^Not a Runeloom save/);
  });
});

describe('save format', () => {
  it('round-trips through JSON text', () => {
    const s = save(6);
    const p = parseSave(JSON.stringify(s));
    expect(p.ok && p.save).toEqual(s);
  });

  it('explains what is wrong with text that is not a usable save', () => {
    const error = (text: string) => {
      const p = parseSave(text);
      return p.ok ? null : p.error;
    };
    expect(error('hello')).toMatch(/^Not a save file/);
    expect(error('{"a":1}')).toMatch(/^Not a Runeloom save/);
    const newer = { ...save(1), version: SAVE_VERSION + 1 };
    expect(error(JSON.stringify(newer))).toMatch(/newer version/);
    const broken = { ...save(1), hero: undefined };
    expect(error(JSON.stringify(broken))).toBe('Bad save: hero should be an object');
  });
});
