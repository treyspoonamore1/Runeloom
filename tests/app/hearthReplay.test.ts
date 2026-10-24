/** M7: Hearth edits (the 'offline' one included) are recorded and replay to the same hash; the app's Hearth views. */
import { describe, expect, it } from 'vitest';
import { hearthRoom } from '../../data/hearth';
import { Session } from '../../src/app/session';
import { roomTexts } from '../../src/app/rooms';
import {
  applyOfflineGains,
  getExpeditionBoard,
  getGarden,
  getHearthSummary,
  getRekindle,
  sendHearthEdit,
} from '../../src/app/hearth';
import { makeReplay } from '../../src/app/replay';
import { decodeFrames, parseReplay } from '../../src/app/replayFormat';
import {
  createAdventure,
  hashHex,
  loadSave,
  newGameHero,
  parseSave,
  runFrames,
  setupNewGameWeaves,
} from '../../src/sim';
import { makeRune } from '../../src/sim/items/items';
import { lightHearth } from '../../src/sim/meta/hearth';
import { HUB_ROOM } from '../sim/meta/helpers';

const ROOMS = { ...roomTexts, [hearthRoom]: HUB_ROOM };

function hubSession(): Session {
  const session = new Session({ seed: 7, roomId: 'test/arena', sceneId: 'arena', mode: 'adventure' });
  const hero = newGameHero();
  for (const r of ['nova', 'wide'] as const) {
    hero.runes.push(makeRune(hero, r, 2));
    hero.unlockedRunes.push(r);
  }
  hero.unlockedRunes.sort();
  session.state = createAdventure({ seed: 7, rooms: ROOMS, startRoomId: hearthRoom, hero });
  setupNewGameWeaves(session.state);
  lightHearth(session.state);
  session.state.hero.hearth.embers = 2000;
  session.state.hero.hearth.ash = 3;
  session.state.hero.threadScrap = 40;
  session.markAdventureStart();
  return session;
}

function play(session: Session, n: number): void {
  for (let i = 0; i < n; i++) session.step({ moveX: 0.2, moveY: 0, aimX: 0, aimY: 0, buttons: 0 });
}

describe('Hearth edits in replays', () => {
  it('a replay with upgrades, the garden, an expedition, offline time, trade and a mutation reproduces the final hash', () => {
    const session = hubSession();
    const h = session.state.hero.hearth;
    for (const b of ['kindling_pit', 'rune_garden', 'expedition_board', 'salvage_loom'] as const)
      expect(sendHearthEdit(session, { kind: 'hearthUpgrade', building: b })).toBeNull();
    play(session, 30);
    const nova = getGarden(session).plantable.find((r) => r.rune === 'nova')!;
    expect(sendHearthEdit(session, { kind: 'gardenPlant', uid: nova.uid })).toBeNull();
    expect(sendHearthEdit(session, { kind: 'expeditionSend', tier: 1 })).toBeNull();
    expect(sendHearthEdit(session, { kind: 'salvageSetting', setting: 'normal' })).toBeNull();
    play(session, 120);
    const gains = applyOfflineGains(session, 0, 3_600_000);
    expect(gains).not.toBeNull();
    expect(gains!.seconds).toBe(3600);
    expect(gains!.scrap).toBeGreaterThan(0);
    expect(gains!.expeditionsReturned).toBe(1);
    expect(getHearthSummary(session).expeditionsReady).toBe(1);
    play(session, 20);
    expect(sendHearthEdit(session, { kind: 'expeditionCollect', uid: h.expeditions[0]!.uid })).toBeNull();
    expect(sendHearthEdit(session, { kind: 'spindlewrightBuy', currency: 'weavers_knot' })).toBeNull();
    expect(sendHearthEdit(session, { kind: 'mutationBuy', mutation: 'deeper_weave' })).toBeNull();
    expect(sendHearthEdit(session, { kind: 'gardenUproot', uid: nova.uid })).toBeNull();
    play(session, 200);

    expect(session.heroEdits.map((e) => e.edit.kind)).toContain('offline');
    const file = parseReplay(JSON.stringify(makeReplay(session)));
    const replay = () =>
      runFrames(decodeFrames(file.frames), '', {
        seed: file.seed,
        mode: 'adventure',
        heroEdits: file.heroEdits,
        loadoutEdits: file.loadoutEdits,
        createState: () =>
          loadSave(parseSave(file.start!), (init) => createAdventure({ ...init, rooms: ROOMS })),
      });
    expect(hashHex(replay().hash)).toBe(file.finalHash);
    // Without the Hearth edits it ends differently.
    const without = runFrames(decodeFrames(file.frames), '', {
      seed: file.seed,
      mode: 'adventure',
      heroEdits: [],
      createState: () =>
        loadSave(parseSave(file.start!), (init) => createAdventure({ ...init, rooms: ROOMS })),
    });
    expect(hashHex(without.hash)).not.toBe(file.finalHash);
  });

  it('offline gains are skipped under a minute and when unlit', () => {
    const session = hubSession();
    expect(applyOfflineGains(session, 0, 30_000)).toBeNull();
    session.state.hero.hearth.lit = false;
    expect(applyOfflineGains(session, 0, 3_600_000)).toBeNull();
  });
});

describe('the app Hearth views', () => {
  it('plantable runes are pouch runes that are neither socketed nor planted', () => {
    const session = hubSession();
    const socketed = new Set(session.state.weaves.slots.flatMap((s) => s.runes ?? []));
    const before = getGarden(session).plantable;
    expect(before.length).toBeGreaterThan(0);
    for (const r of before) expect(socketed.has(r.uid)).toBe(false);
    expect(sendHearthEdit(session, { kind: 'hearthUpgrade', building: 'rune_garden' })).toBeNull();
    expect(sendHearthEdit(session, { kind: 'gardenPlant', uid: before[0]!.uid })).toBeNull();
    const after = getGarden(session);
    expect(after.planted.map((r) => r.uid)).toEqual([before[0]!.uid]);
    expect(after.plantable.map((r) => r.uid)).not.toContain(before[0]!.uid);
  });

  it('the expedition board and Rekindle views', () => {
    const session = hubSession();
    expect(sendHearthEdit(session, { kind: 'hearthUpgrade', building: 'expedition_board' })).toBeNull();
    const board = getExpeditionBoard(session);
    expect(board.free).toBe(1);
    expect(board.rewards(1).embers).toBeGreaterThan(0);
    expect(getRekindle(session).blocker).toMatch(/tier 8/);
    session.state.hero.riftTier = 8;
    expect(getRekindle(session).blocker).toBeNull();
    expect(getRekindle(session).ash).toBeGreaterThanOrEqual(1);
  });
});
