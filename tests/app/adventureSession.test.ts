import { describe, expect, it } from 'vitest';
import { Session } from '../../src/app/session';
import { findScene } from '../../src/app/scenes';
import { getRegionMap, sendHeroEdit } from '../../src/app/hero';
import { makeReplay } from '../../src/app/replay';
import { checkReplay } from '../../tools/lib/replay';
import { newGame, startRoom } from '../../data/progression';
import { hashState, objectCenter } from '../../src/sim';
import { TILE_CELLS } from '../../src/sim/core/constants';

const EAST = { moveX: 1, moveY: 0, aimX: 0, aimY: 0, buttons: 0 };

function adventureSession(roomId?: string): Session {
  const scene = findScene('adventure')!;
  return new Session({ seed: 2, roomId: roomId ?? scene.roomId, sceneId: scene.id, mode: scene.mode });
}

describe('the adventure scene', () => {
  it('starts a new game in the start room at its Loom Stone', () => {
    const s = adventureSession();
    expect(s.state.mode).toBe('adventure');
    expect(s.state.room.id).toBe(startRoom);
    expect(s.roomId).toBe(s.state.room.id);
    const stone = s.state.objects.find((o) => o.kind === 'loom_stone')!;
    const p = s.state.player;
    const c = objectCenter(stone);
    expect(Math.hypot(p.x - c.x, p.y - c.y)).toBeLessThan(2 * TILE_CELLS);
    expect(s.state.hero.level).toBe(1);
  });

  it('tells room listeners about exits and rests, and replays reproduce', () => {
    const s = adventureSession('test/world_a');
    const rooms: string[] = [];
    s.onRoomChange((st) => rooms.push(st.room.id));
    for (let i = 0; i < 80; i++) s.step(EAST);
    expect(rooms).toEqual(['test/world_b']);
    expect(s.drainEvents().some((e) => e.type === 'roomEnter')).toBe(true);
    expect(getRegionMap(s).nodes.find((n) => n.current)!.id).toBe('test/world_b');
    const r = checkReplay(makeReplay(s));
    expect(r.match).toBe(true);
    for (let i = 0; i < 80; i++) s.step({ ...EAST, moveX: -1 });
    expect(sendHeroEdit(s, { kind: 'rest' })).toBeNull();
    expect(rooms).toEqual(['test/world_b', 'test/world_a', 'test/world_a']);
  });

  it('starts with the new-game hero and weaves', () => {
    const s = adventureSession();
    const h = s.state.hero;
    expect(h.items.find((i) => i.uid === h.equipped.spindle)?.base).toBe(newGame.spindle);
    expect(s.state.weaves.slots.map((w) => w.notation)).toEqual(
      newGame.weaves.map((n, i) => n ?? s.state.weaves.slots[i]!.notation),
    );
    expect(s.startSave).not.toBeNull();
  });

  it('a plain reset rebuilds the start save (same hero), a new seed starts a new game', () => {
    const s = adventureSession();
    const start = hashState(s.state);
    for (let i = 0; i < 40; i++) s.step(EAST);
    s.state.hero.threadScrap += 7; // a change the reset must undo
    s.reset();
    expect(hashState(s.state)).toBe(start);
    expect(s.startSave).not.toBeNull();
    for (let i = 0; i < 30; i++) s.step(EAST);
    expect(checkReplay(makeReplay(s)).match).toBe(true);
    s.reset({ seed: 77 });
    expect(s.state.seed).toBe(77);
    expect(s.state.hero.threadScrap).toBe(0);
    expect(s.startSave!.seed).toBe(77);
  });
});
