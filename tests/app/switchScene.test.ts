import { describe, expect, it } from 'vitest';
import { labRoomId } from '../../data/lab';
import { Session } from '../../src/app/session';
import { findScene, scenes } from '../../src/app/scenes';

describe('Session.switchScene (pause menu place picker)', () => {
  it('loads the scene room and mode, and keeps the weaves', () => {
    const session = new Session({ seed: 3, roomId: 'test/wilds', sceneId: 'arena', mode: 'arena' });
    const weaves = session.state.weaves.slots.map((s) => s.notation);
    const resets: string[] = [];
    session.onReset((s) => resets.push(s.room.id));

    session.switchScene(findScene('lab')!);
    expect(session.sceneId).toBe('lab');
    expect(session.state.room.id).toBe(labRoomId);
    expect(session.state.mode).toBe('sandbox');
    expect(session.state.weaves.slots.map((s) => s.notation)).toEqual(weaves);

    session.switchScene(findScene('arena')!);
    expect(session.state.mode).toBe('arena');
    expect(resets).toEqual([labRoomId, 'test/wilds']);
  });

  it('every scene has a short picker name', () => {
    for (const s of scenes) expect(s.short.length).toBeGreaterThan(0);
  });
});
