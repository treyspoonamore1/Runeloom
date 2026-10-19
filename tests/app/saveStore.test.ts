import { describe, expect, it } from 'vitest';
import { memoryBackend, SaveStore } from '../../src/app/saveStore';
import { parseSave, SAVE_FORMAT, SAVE_VERSION, type SaveData } from '../../src/app/saveFormat';
import { demoHero } from '../../src/ui/fixtures/hero';
import { createWorldState } from '../../src/sim/world/worldState';

function save(level: number, roomId = 'emberwood/e2_thicket'): SaveData {
  const hero = demoHero();
  hero.level = level;
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    seed: 7,
    tick: 3600,
    hero,
    world: createWorldState(roomId),
    weaves: { spindleId: 'ashwood', notations: ['Cast > Bolt[Fire]', null, null, null] },
  };
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
    expect(await store.read('slot2')).toEqual({ ok: false, error: 'Not a Runeloom save' });
  });
});

describe('save format', () => {
  it('round-trips through JSON text', () => {
    const s = save(6);
    const p = parseSave(JSON.stringify(s));
    expect(p.ok && p.save).toEqual(s);
  });

  it('explains what is wrong with text that is not a usable save', () => {
    expect(parseSave('hello')).toEqual({ ok: false, error: "That isn't save data (it isn't JSON)" });
    expect(parseSave('{"a":1}')).toEqual({ ok: false, error: 'Not a Runeloom save' });
    const newer = { ...save(1), version: SAVE_VERSION + 1 };
    expect(parseSave(JSON.stringify(newer)).ok).toBe(false);
    const broken = { ...save(1), hero: undefined };
    expect(parseSave(JSON.stringify(broken))).toEqual({
      ok: false,
      error: 'The save is damaged: parts of it are missing',
    });
  });
});
