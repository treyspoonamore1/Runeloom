import { describe, expect, it } from 'vitest';
import {
  bannersFor,
  HUD_EVENT,
  pushToasts,
  roomBanner,
  roomEnterBanner,
  toastsFor,
  type LooseEvent,
  type ToastSpec,
} from '../../src/ui/adventure/hudEvents';
import { placeBox } from '../../src/ui/menus/frame';
import { BOSS_INFO } from '../../src/ui/adventure/hudAdapter';
import { bossKinds, worldRooms } from '../../data/progression';
import { introCards } from '../../data/ui';
import { roomTexts } from '../../src/app/rooms';
import { createAdventure, enterRoom, type GameState } from '../../src/sim';

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
      { type: HUD_EVENT.chestOpened, dungeon: 'kiln', big: false, count: 1 },
      { type: HUD_EVENT.chestOpened, dungeon: 'kiln', big: true, count: 1 },
      { type: HUD_EVENT.pickup, kind: 'heart_seed', total: 1 },
      { type: HUD_EVENT.pickup, kind: 'loom_shard', total: 1 },
      { type: HUD_EVENT.runeUnlocked, rune: 'frost' },
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

  it('maps the world and hero events: rewards, notes, Loom Stones, doors and boss kills', () => {
    const reward = { kind: 'rune', rune: { uid: 3, rune: 'frost', level: 1, xp: 0, quality: 0 } };
    const ev: LooseEvent[] = [
      { type: HUD_EVENT.rewardGranted, roomId: 'kiln/k6_frost_shrine', content: reward },
      { type: HUD_EVENT.runeUnlocked, rune: 'frost' }, // same rune as the reward: one toast
      { type: HUD_EVENT.loomStone, roomId: 'emberwood/e1_glade', key: 'loom_stone@5,11', first: true },
      { type: HUD_EVENT.loomStone, roomId: 'emberwood/e1_glade', key: 'loom_stone@5,11', first: false },
      { type: HUD_EVENT.doorOpened, key: 'door@3,4', kind: 'door', link: 'braziers:all' },
      { type: HUD_EVENT.keyUsed, dungeon: 'kiln', big: false, left: 2 },
      { type: HUD_EVENT.rested, roomId: 'emberwood/e1_glade', key: 'loom_stone@5,11' },
      { type: HUD_EVENT.roomCleared, id: 'emberwood/e2_thicket', first: true },
      { type: HUD_EVENT.roomCleared, id: 'hearth/hearth', first: true }, // the hub: no toast
      { type: HUD_EVENT.runeLevelUp, uid: 2, rune: 'bolt', level: 2, slot: 0 },
      { type: HUD_EVENT.note, key: 'loom_stone@1,1', text: "The Fen isn't woven yet." },
      { type: HUD_EVENT.bossDefeated, kind: 'cinder_warden', roomId: 'kiln/k10_wardens_hearth' },
    ];
    expect(toastsFor(ev, names).map((t) => [t.kind, t.title])).toEqual([
      ['rune', 'New rune: FROST'],
      ['stone', 'Loom Stone woken'],
      ['door', 'A door opened'],
      ['key', 'Key used'],
      ['stone', 'Rested'],
      ['level', 'Room cleared'],
      ['rune', 'BOLT level 2'],
    ]);
    expect(bannersFor(ev, (k) => (k === 'cinder_warden' ? 'The Cinder Warden' : k))).toEqual([
      { title: "The Fen isn't woven yet.", sub: '', note: true },
      { title: 'The Cinder Warden defeated', sub: '' },
    ]);
  });

  it('says a guaranteed rune is new; a first element rune gets the item-get panel instead of a toast', () => {
    const rune = (id: string, uid: number) => ({
      kind: 'rune',
      rune: { uid, rune: id, level: 1, xp: 0, quality: 0 },
    });
    const k10 = 'kiln/k10_wardens_hearth';
    const ev: LooseEvent[] = [
      { type: HUD_EVENT.runeUnlocked, rune: 'storm' },
      { type: HUD_EVENT.rewardGranted, roomId: k10, content: rune('storm', 1) },
      { type: HUD_EVENT.elementUnlocked, rune: 'storm', roomId: k10, source: 'boss' },
      { type: HUD_EVENT.runeUnlocked, rune: 'chain' },
      { type: HUD_EVENT.rewardGranted, roomId: k10, content: rune('chain', 2) },
    ];
    expect(toastsFor(ev, names)).toEqual([
      {
        kind: 'rune',
        title: 'New rune: CHAIN',
        sub: 'In your pouch · weave it in the Loom (Tab)',
        rarity: null,
        amount: 1,
      },
    ]);
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

  it('toasts Pattern Seeds with how many and the total found', () => {
    const t = toastsFor(
      [
        { type: HUD_EVENT.patternSeedGained, amount: 1, total: 3, x: 0, y: 0 },
        { type: HUD_EVENT.patternSeedGained, amount: 2, total: 5, x: 0, y: 0 },
      ],
      names,
    );
    expect(t).toEqual([
      { kind: 'level', title: 'Pattern Seed', sub: '+1 passive point · press P · 3 found', rarity: null, amount: 1 },
      { kind: 'level', title: '2 Pattern Seeds', sub: '+2 passive points · press P · 5 found', rarity: null, amount: 1 },
    ]);
  });

  it('shows a region boss intro card when it wakes (not the rift versions)', () => {
    const awake = (kind: string): LooseEvent => ({ type: HUD_EVENT.bossAwake, id: 1, kind, name: kind, x: 0, y: 0 });
    const b = bannersFor([awake('bellwether'), awake('glasswater_coil'), awake('rift_coil'), awake('cinder_warden')], (k) => k);
    expect(b.map((x) => x.title)).toEqual(['The Old Bellwether', 'The Glasswater Coil', 'The Cinder Warden']);
    for (const x of b) expect(x.sub.length).toBeGreaterThan(5);
  });

  it('every boss has a bar name and phase marks; the Fen bosses split where tuning says', () => {
    for (const k of bossKinds) expect(BOSS_INFO[k], k).toBeDefined();
    expect(BOSS_INFO.bellwether).toEqual({ name: 'The Old Bellwether', marks: [0.5] });
    expect(BOSS_INFO.glasswater_coil).toEqual({ name: 'The Glasswater Coil', marks: [0.66, 0.33] });
    expect(BOSS_INFO.rift_coil!.marks).toEqual(BOSS_INFO.glasswater_coil!.marks);
  });

  it("shows the Fen's intro card the first time G1 is entered, the room's banner after", () => {
    const room = roomBanner('Storm Landing', 'Glasswater Fen', 18);
    const enter = (firstVisit: boolean): LooseEvent => ({
      type: HUD_EVENT.roomEnter,
      id: 'fen/g1_storm_landing',
      name: 'Storm Landing',
      level: 18,
      firstVisit,
    });
    expect(roomEnterBanner(enter(true), room)).toEqual({ title: 'Glasswater Fen', sub: 'Area level 18 to 24' });
    expect(roomEnterBanner(enter(false), room)).toEqual(room);
    expect(roomEnterBanner({ ...enter(true), id: 'fen/g2_glass_reeds' }, room)).toEqual(room);
  });

  it('the sim triggers the Fen card: G1 is a real room, entered first with firstVisit, then without', () => {
    const ids = Object.values(worldRooms) as string[];
    for (const id of Object.keys(introCards.regions)) expect(ids, id).toContain(id);
    const st: GameState = createAdventure({ seed: 1, rooms: roomTexts, startRoomId: 'kiln/k10_wardens_hearth' });
    const visits: boolean[] = [];
    for (let i = 0; i < 2; i++) {
      st.events.length = 0;
      enterRoom(st, 'fen/g1_storm_landing', { kind: 'edge', from: 's' });
      for (const e of st.events as unknown as LooseEvent[])
        if (e.type === HUD_EVENT.roomEnter) visits.push(roomEnterBanner(e, { title: 'room', sub: '' }).title === 'Glasswater Fen');
    }
    expect(visits).toEqual([true, false]);
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
