import { describe, expect, it } from 'vitest';
import { Session } from '../../src/app/session';
import { roomTexts } from '../../src/app/rooms';
import {
  getInventory,
  getRunes,
  sendHeroEdit,
  describeItem,
  describePart,
  describeRune,
} from '../../src/app/hero';
import { getRuneCounts, previewWeave, setWeave, unlimitedRunes } from '../../src/app/loadout';
import { makeReplay } from '../../src/app/replay';
import { parseReplay } from '../../src/app/replayFormat';
import { checkReplay } from '../../tools/lib/replay';
import { Button, createGame, hashState, newGameHero, setupNewGameWeaves } from '../../src/sim';
import { makeItem, makePart, makeRune } from '../../src/sim/items/items';

/** A session playing a new-game adventure in the test arena, with a cloak, a part and spare runes to use. */
function adventureSession(): Session {
  const session = new Session({ seed: 5, roomId: 'test/arena', sceneId: 'arena', mode: 'adventure' });
  const hero = newGameHero();
  hero.items.push(makeItem(hero, 'travelers_cloak', 'magic', 3, [{ id: 'life_flat', tier: 3, value: 9 }]));
  hero.parts.push(makePart(hero, 'kiln_chitin', 2));
  for (const r of ['cast', 'nova', 'fire'] as const) hero.runes.push(makeRune(hero, r));
  hero.unlockedRunes.push('nova');
  hero.unlockedRunes.sort();
  session.state = createGame({ seed: 5, rooms: roomTexts, roomId: 'test/arena', mode: 'adventure', hero });
  setupNewGameWeaves(session.state);
  session.markAdventureStart();
  return session;
}

function play(session: Session, n: number, buttons = 0): void {
  for (let i = 0; i < n; i++) {
    const p = session.state.player;
    session.step({ moveX: 0.3, moveY: 0.1, aimX: p.x + 10, aimY: p.y, buttons: i % 20 < 5 ? buttons : 0 });
  }
}

describe('hero edits are recorded and replayed', () => {
  it('a replay with equip, fuse, unequip and weave edits reproduces the final hash', () => {
    const session = adventureSession();
    const cloak = getInventory(session).find((i) => i.base === 'travelers_cloak')!;
    const part = session.state.hero.parts[0]!;
    play(session, 30, Button.Cast1);
    expect(sendHeroEdit(session, { kind: 'equip', uid: cloak.uid, slot: 'cloak' })).toBeNull();
    expect(sendHeroEdit(session, { kind: 'equip', uid: cloak.uid, slot: 'hood' })).not.toBeNull();
    play(session, 30, Button.Cast1);
    expect(setWeave(session, 2, 'Cast > Nova[Fire]').applied).toBe(true);
    expect(
      sendHeroEdit(session, {
        kind: 'fuse',
        partUid: part.uid,
        spindleUid: session.state.hero.equipped.spindle!,
        socket: 0,
      }),
    ).toBeNull();
    play(session, 40, Button.Cast3);
    expect(sendHeroEdit(session, { kind: 'unequip', slot: 'cloak' })).toBeNull();
    play(session, 20, Button.Cast2);

    expect(session.heroEdits.map((e) => e.edit.kind)).toEqual(['equip', 'fuse', 'unequip']);
    expect(session.heroEdits[1]!.after).toBe(1);
    const file = parseReplay(JSON.stringify(makeReplay(session)));
    expect(file.start).toBeDefined();
    const r = checkReplay(file);
    expect(r.match).toBe(true);
    expect(r.hash).toBe(file.finalHash);

    // Without the hero edits the run ends differently.
    const without = checkReplay({ ...file, heroEdits: [] });
    expect(without.match).toBe(false);
  });

  it('the start save rebuilds exactly the session’s starting state', () => {
    const session = adventureSession();
    const start = hashState(session.state);
    const file = parseReplay(JSON.stringify(makeReplay(session)));
    expect(checkReplay(file).hash).toBe(start.toString(16).padStart(8, '0'));
  });
});

describe('the UI API', () => {
  it('reports rune counts, unlimited runes and ownership errors', () => {
    const session = adventureSession();
    expect(unlimitedRunes(session)).toBe(false);
    expect(getRuneCounts(session).cast).toEqual({ free: 1, total: 3 });
    const p = previewWeave(session, 'Cast > Nova[Fire, Wide]');
    expect(p.compiled?.ok).toBe(false);
    expect(p.compiled?.ok === false && p.compiled.error.message).toBe('Needs 1 Wide rune; you have 0 free');
    expect(
      getRunes(session)
        .filter((r) => r.slot === -1)
        .map((r) => r.rune.rune),
    ).toEqual(['cast', 'nova', 'fire']);
    const sandbox = new Session({ seed: 1, roomId: 'test/arena', sceneId: 'arena', mode: 'arena' });
    expect(unlimitedRunes(sandbox)).toBe(true);
    expect(getRuneCounts(sandbox)).toEqual({});
  });

  it('describes items, runes and parts with real text', () => {
    const session = adventureSession();
    const cloak = getInventory(session)[0]!;
    const d = describeItem(cloak);
    expect(d.name).toBe("Hale Traveler's Cloak");
    expect(d.rarity).toBe('magic');
    expect(d.lines).toEqual(['+9 to maximum life']);
    const spindle = session.state.hero.items[0]!;
    expect(describeItem(spindle).properties).toContain('Capacity: 8');
    expect(describeItem(spindle).lines).toEqual(['Socket 1: empty']);
    const rune = session.state.hero.runes[0]!;
    expect(describeRune(rune).name).toBe(rune.rune === 'cast' ? 'Cast' : describeRune(rune).name);
    expect(describeRune(rune).properties[0]).toBe('Level: 1');
    const part = describePart(session.state.hero.parts[0]!);
    expect(part.name).toBe('Kiln Chitin');
    expect(part.base).toBe('Tier II Fuse part');
    expect(part.lines[0]).toBe('Dodge recharges 22.5% faster');
  });
});
