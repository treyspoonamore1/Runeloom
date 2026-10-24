import { beforeEach, describe, expect, it, vi } from 'vitest';

const apply = vi.fn();
vi.mock('../../src/app/hearth', async (orig) => ({
  ...(await orig<typeof import('../../src/app/hearth')>()),
  applyOfflineGains: (...args: unknown[]) => apply(...args),
}));

import { createAdventureFlow } from '../../src/app/adventure';
import { findScene } from '../../src/app/scenes';
import { makeSave } from '../../src/app/saveFormat';
import { memoryBackend, SaveStore } from '../../src/app/saveStore';
import { Session } from '../../src/app/session';

const HOUR = 3600_000;
const T0 = 1_700_000_000_000;
const GAINS = { seconds: 3 * 3600, scrap: 50, runeXp: 900, runeLevels: 1, expeditionsReturned: 1 };

function memoryClaims() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

function setup(now: () => number) {
  const scene = findScene('adventure')!;
  const session = new Session({ seed: 3, roomId: scene.roomId, sceneId: scene.id, mode: scene.mode });
  const store = new SaveStore(memoryBackend(), true, () => T0);
  const flow = createAdventureFlow(session, { store: Promise.resolve(store), now, claims: memoryClaims() });
  return { session, store, flow };
}

beforeEach(() => {
  apply.mockReset();
});

describe('offline progress on loading a slot', () => {
  it('reloading an older slot of the same game pays only the time since the last payment', async () => {
    apply.mockReturnValue(GAINS);
    let t = T0 + 3 * HOUR;
    const { session, store, flow } = setup(() => t);
    await store.write('slot1', makeSave(session.state), 'Room');
    await flow.load('slot1');
    t = T0 + 4 * HOUR;
    await flow.load('slot1');
    expect(apply).toHaveBeenNthCalledWith(1, session, T0, T0 + 3 * HOUR);
    expect(apply).toHaveBeenNthCalledWith(2, session, T0 + 3 * HOUR, T0 + 4 * HOUR);
  });

  it("hands the slot's savedAt and the current time to applyOfflineGains and keeps the summary", async () => {
    apply.mockReturnValue(GAINS);
    const { session, store, flow } = setup(() => T0 + 3 * HOUR);
    await store.write('slot1', makeSave(session.state), 'Room');
    expect(await flow.load('slot1')).toBeNull();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(session, T0, T0 + 3 * HOUR);
    expect(flow.offline.value).toEqual(GAINS);
  });

  it('applies it after the loaded game is in place, not before', async () => {
    let roomWhenApplied = '';
    apply.mockImplementation((s: Session) => {
      roomWhenApplied = s.state.room.id;
      return null;
    });
    const { session, store, flow } = setup(() => T0 + HOUR);
    const save = makeSave(session.state);
    await store.write('auto', save, 'Room');
    await flow.load('auto');
    expect(roomWhenApplied).toBe(save.world.roomId);
  });

  it('leaves no summary when nothing came of it (under a minute, unlit Hearth)', async () => {
    apply.mockReturnValue(null);
    const { session, store, flow } = setup(() => T0 + 30_000);
    await store.write('slot2', makeSave(session.state), 'Room');
    await flow.load('slot2');
    expect(apply).toHaveBeenCalledWith(session, T0, T0 + 30_000);
    expect(flow.offline.value).toBeNull();
  });

  it('clears an old summary when another game starts', async () => {
    apply.mockReturnValue(GAINS);
    const { session, store, flow } = setup(() => T0 + HOUR);
    await store.write('slot1', makeSave(session.state), 'Room');
    await flow.load('slot1');
    expect(flow.offline.value).not.toBeNull();
    flow.newGame();
    expect(flow.offline.value).toBeNull();
  });

  it('gives imported save files no offline gain', async () => {
    apply.mockReturnValue(GAINS);
    const { session, flow } = setup(() => T0 + 8 * HOUR);
    const text = JSON.stringify(makeSave(session.state));
    expect(await flow.importText(text)).toBeNull();
    expect(apply).not.toHaveBeenCalled();
    expect(flow.offline.value).toBeNull();
  });

  it('refuses an empty slot without applying anything', async () => {
    const { flow } = setup(() => T0 + HOUR);
    expect(await flow.load('slot3')).toMatch(/empty/);
    expect(apply).not.toHaveBeenCalled();
  });
});
