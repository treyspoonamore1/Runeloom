import { describe, expect, it } from 'vitest';
import {
  HUD_EVENT,
  pushToasts,
  roomBanner,
  toastsFor,
  type LooseEvent,
  type ToastSpec,
} from '../../src/ui/adventure/hudEvents';
import { placeBox } from '../../src/ui/menus/frame';

const names = {
  rune: (id: string) => id.toUpperCase(),
  item: () => ({ name: 'Wool Cloak of Vigor', rarity: 'magic' as const }),
  part: () => 'Ember Feather II',
};

describe('adventure HUD events', () => {
  it('turns each pickup kind into a toast', () => {
    const ev: LooseEvent[] = [
      {
        type: HUD_EVENT.lootPicked,
        content: { kind: 'rune', rune: { uid: 1, rune: 'lob', level: 1, xp: 0, quality: 0 } },
      },
      { type: HUD_EVENT.lootPicked, content: { kind: 'item', item: {} } },
      { type: HUD_EVENT.lootPicked, content: { kind: 'part', part: {} } },
      { type: HUD_EVENT.lootPicked, content: { kind: 'scrap', amount: 3 } },
      { type: HUD_EVENT.keyPicked, dungeon: 'kiln' },
      { type: HUD_EVENT.keyPicked, dungeon: 'kiln', big: true },
      { type: HUD_EVENT.heartSeed },
      { type: HUD_EVENT.loomShard },
      { type: HUD_EVENT.runeGranted, rune: 'frost' },
      { type: HUD_EVENT.levelUp, level: 7 },
      { type: 'hit' },
    ];
    const t = toastsFor(ev, names);
    expect(t.map((x) => x.kind)).toEqual([
      'rune',
      'item',
      'part',
      'scrap',
      'key',
      'bigKey',
      'heart',
      'shard',
      'rune',
      'level',
    ]);
    expect(t[0]!.title).toBe('LOB');
    expect(t[1]).toMatchObject({ title: 'Wool Cloak of Vigor', rarity: 'magic' });
    expect(t[3]!.title).toBe('+3 Thread Scrap');
    expect(t[8]).toMatchObject({ title: 'FROST', sub: 'New rune unlocked' });
    expect(t[9]).toMatchObject({ title: 'Level 7', sub: 'Passive point available · press P' });
  });

  it('merges quick scrap pickups, expires old toasts and keeps the newest few', () => {
    let id = 0;
    const opts = { seconds: 3, levelSeconds: 5, mergeWindow: 1, max: 3, nextId: () => ++id };
    const scrap = (n: number): ToastSpec => ({
      kind: 'scrap',
      title: `+${n} Thread Scrap`,
      sub: '',
      rarity: null,
      amount: n,
    });
    let live = pushToasts([], [scrap(2)], 10, opts);
    live = pushToasts(live, [scrap(3)], 10.5, opts);
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({ title: '+5 Thread Scrap', amount: 5, until: 13.5 });
    live = pushToasts(live, [scrap(1)], 12, opts); // outside the merge window
    expect(live.map((t) => t.amount)).toEqual([5, 1]);
    const heart: ToastSpec = { kind: 'heart', title: 'Heart Seed', sub: '', rarity: null, amount: 1 };
    live = pushToasts(live, [heart, heart, heart], 12, opts);
    expect(live).toHaveLength(3);
    expect(pushToasts(live, [], 100, opts)).toEqual([]);
  });

  it('names the room, its region and area level in the banner', () => {
    expect(roomBanner('Riverbend', 'Emberwood', 3)).toEqual({
      title: 'Riverbend',
      sub: 'Emberwood · area level 3',
    });
  });
});

describe('menu tooltip placement', () => {
  it('goes right of the anchor, flips left at the edge, and stays on screen', () => {
    expect(placeBox({ x: 100, y: 100, w: 50, h: 20 }, 200, 100, 1280, 720)).toEqual({ x: 160, y: 100 });
    expect(placeBox({ x: 1100, y: 100, w: 50, h: 20 }, 200, 100, 1280, 720)).toEqual({ x: 890, y: 100 });
    expect(placeBox({ x: 100, y: 690, w: 50, h: 20 }, 200, 100, 1280, 720)).toEqual({ x: 160, y: 610 });
    // A phone: wider than either side, so it sits inside the screen.
    const p = placeBox({ x: 100, y: 100, w: 200, h: 20 }, 360, 100, 390, 844);
    expect(p.x).toBeGreaterThanOrEqual(10);
    expect(p.x + 360).toBeLessThanOrEqual(390);
  });
});
