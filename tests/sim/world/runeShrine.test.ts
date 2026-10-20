/**
 * The rune shrine (`R`, CONTENT §6.1) and the dungeon-item moment (DESIGN §10.2): K6's Frost is
 * paid when the player touches the shrine, once, and the first unlock of an element rune sends
 * 'elementUnlocked' once per save (Frost at the shrine, Storm when the Cinder Warden dies).
 */
import { describe, expect, it } from 'vitest';
import { regionRooms } from '../../../data/progression';
import {
  createAdventure,
  dealDirectDamage,
  enterRoom,
  loadSave,
  makeSave,
  PLAYER_ID,
  type GameState,
  type SimEvent,
} from '../../../src/sim';
import { roomFlags } from '../../../src/sim/world/worldState';
import { obj, ROOMS, run, runUntil, T, teleport } from './worldHelpers';

const K6 = regionRooms.k6;
const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) =>
  evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);
const frostItems = (s: GameState) => s.hero.runes.filter((r) => r.rune === 'frost').length;

/** A new game entering K6 from K5 (west), with its entry events. */
function enterK6(): { s: GameState; events: SimEvent[] } {
  const s = createAdventure({ seed: 1, rooms: ROOMS, startRoomId: regionRooms.k5 });
  s.cheats.noAI = true;
  enterRoom(s, K6, { kind: 'edge', from: 'e' });
  return { s, events: [...s.events] };
}

/** Walks the player up to the shrine's west face and steps until it is taken; returns the events. */
function touchShrine(s: GameState): SimEvent[] {
  const shrine = obj(s, 'rune_shrine');
  teleport(s, T(shrine.tx - 1), T(shrine.ty));
  return runUntil(s, (st) => obj(st, 'rune_shrine').on, 60, {
    moveX: 1,
    moveY: 0,
    aimX: T(shrine.tx),
    aimY: T(shrine.ty),
    buttons: 0,
  });
}

describe('the K6 rune shrine', () => {
  it('K6 has exactly one shrine, on the altar, and it starts full', () => {
    const { s } = enterK6();
    const shrines = s.objects.filter((o) => o.kind === 'rune_shrine');
    expect(shrines).toHaveLength(1);
    expect(shrines[0]!.key).toBe('rune_shrine@16,13');
    expect(shrines[0]!.on).toBe(false);
  });

  it('pays nothing on entry or clear, nor while the player only stands in the room', () => {
    const { s, events } = enterK6();
    expect(frostItems(s)).toBe(0);
    expect(s.hero.unlockedRunes).not.toContain('frost');
    expect(ofType(events, 'rewardGranted')).toHaveLength(0);
    // K6 has no enemies, so it is cleared at once, but its rewards wait for the shrine.
    expect(roomFlags(s.world, K6)).toMatchObject({ cleared: true, rewardsPaid: false });
    expect(ofType(events, 'roomCleared')[0]?.first).toBe(false);
    const later = runUntil(s, () => false, 120);
    expect(frostItems(s)).toBe(0);
    expect(ofType(later, 'elementUnlocked')).toHaveLength(0);
  });

  it('touching it pays Frost once, sends the moment once, and leaves it empty', () => {
    const { s } = enterK6();
    const shrine = obj(s, 'rune_shrine');
    const events = touchShrine(s);
    expect(shrine.on).toBe(true);
    expect(frostItems(s)).toBe(1);
    expect(s.hero.unlockedRunes).toContain('frost');
    expect(roomFlags(s.world, K6).rewardsPaid).toBe(true);
    expect(roomFlags(s.world, K6).taken).toContain(shrine.key);
    expect(ofType(events, 'shrineTaken')).toHaveLength(1);
    expect(ofType(events, 'rewardGranted')).toHaveLength(1);
    const moments = ofType(events, 'elementUnlocked');
    expect(moments).toEqual([
      { type: 'elementUnlocked', rune: 'frost', roomId: K6, x: T(16), y: T(13), source: 'shrine' },
    ]);
    // Standing against the empty shrine pays nothing more.
    const more = runUntil(s, () => false, 60, { moveX: 1, moveY: 0, aimX: 0, aimY: 0, buttons: 0 });
    expect(frostItems(s)).toBe(1);
    expect(ofType(more, 'rewardGranted')).toHaveLength(0);
    expect(ofType(more, 'elementUnlocked')).toHaveLength(0);
  });

  it('re-entry and a save/load keep it empty and never repeat the moment', () => {
    const { s } = enterK6();
    touchShrine(s);
    enterRoom(s, regionRooms.k5, { kind: 'edge', from: 'w' });
    enterRoom(s, K6, { kind: 'edge', from: 'e' });
    expect(obj(s, 'rune_shrine').on).toBe(true);
    expect(ofType(touchShrine(s), 'elementUnlocked')).toHaveLength(0);
    const loaded = loadSave(makeSave(s), (init) => createAdventure({ ...init, rooms: ROOMS }));
    if (loaded.room.id !== K6) enterRoom(loaded, K6, { kind: 'edge', from: 'e' });
    expect(obj(loaded, 'rune_shrine').on).toBe(true);
    const after = touchShrine(loaded);
    expect(ofType(after, 'rewardGranted')).toHaveLength(0);
    expect(ofType(after, 'elementUnlocked')).toHaveLength(0);
    expect(frostItems(loaded)).toBe(1);
  });

  it('a hero who already holds Frost gets the rune but no new-element moment', () => {
    const { s } = enterK6();
    s.hero.unlockedRunes.push('frost');
    const events = touchShrine(s);
    expect(ofType(events, 'rewardGranted')).toHaveLength(1);
    expect(ofType(events, 'elementUnlocked')).toHaveLength(0);
  });
});

describe("the Cinder Warden's Storm moment", () => {
  const killWarden = () => {
    const s = createAdventure({ seed: 4, rooms: ROOMS, startRoomId: regionRooms.k10 });
    s.cheats.god = true;
    const boss = s.enemies.find((e) => e.kind === 'cinder_warden')!;
    dealDirectDamage(s, boss, boss.life + 1e6, PLAYER_ID);
    const events: SimEvent[] = [];
    for (let i = 0; i < 10; i++) {
      run(s, 1);
      events.push(...s.events);
    }
    return { s, boss, events };
  };

  it('the Warden dying unlocks Storm with one moment at the boss, after its rewards', () => {
    const { boss, events } = killWarden();
    const moments = ofType(events, 'elementUnlocked');
    expect(moments).toHaveLength(1);
    expect(moments[0]).toMatchObject({ rune: 'storm', roomId: regionRooms.k10, source: 'boss' });
    expect(moments[0]!.x).toBeCloseTo(boss.x);
    expect(moments[0]!.y).toBeCloseTo(boss.y);
    // Only Storm is an element: Chain, Sigil and On Crit are plain rewards.
    expect(
      ofType(events, 'rewardGranted').map((e) => e.content.kind === 'rune' && e.content.rune.rune),
    ).toEqual(['storm', 'chain', 'sigil', 'on_crit']);
    const order = events.map((e) => e.type);
    expect(order.indexOf('bossDefeated')).toBeLessThan(order.indexOf('elementUnlocked'));
  });

  it('re-entering K10 or loading the save does not repeat it', () => {
    const { s } = killWarden();
    enterRoom(s, regionRooms.k10, { kind: 'edge', from: 'n' });
    const again = runUntil(s, () => false, 30);
    const loaded = loadSave(makeSave(s), (init) => createAdventure({ ...init, rooms: ROOMS }));
    const afterLoad = runUntil(loaded, () => false, 30);
    expect(ofType([...s.events, ...again, ...afterLoad], 'elementUnlocked')).toHaveLength(0);
    expect(loaded.hero.runes.filter((r) => r.rune === 'storm')).toHaveLength(1);
  });
});
