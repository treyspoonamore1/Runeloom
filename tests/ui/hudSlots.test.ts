import { describe, expect, it } from 'vitest';
import { Session } from '../../src/app/session';
import { getLoadout, setSpindle, setWeave } from '../../src/app/loadout';
import { slotSnaps, type CasterView } from '../../src/ui/hudSlots';
import { readSnap, snapEqual } from '../../src/ui/hudModel';

const session = () => new Session({ seed: 1, roomId: 'test/arena', sceneId: 'arena', mode: 'arena' });
const idle: CasterView = { mana: 50, castSlot: -1, castLeft: 0, castTime: 0 };
const noTimers = () => ({ cooldownLeft: 0, cooldownTotal: 0 });

describe('slotSnaps', () => {
  it('shows all four slots from the loadout, with names, glyphs and costs', () => {
    const s = session();
    const snaps = slotSnaps(getLoadout(s), idle, noTimers);
    expect(snaps.map((x) => [x.key, x.name, x.form, x.element, x.cost])).toEqual([
      ['LMB', 'Fire Bolt', 'bolt', 'fire', 6.6],
      ['RMB', 'Strike', 'strike', null, 4],
      ['Q', 'Empty', null, null, null],
      ['E', 'Empty', null, null, null],
    ]);
    expect(snaps.every((x) => x.affordable && !x.auto && x.warn === null)).toBe(true);
  });

  it('flags unaffordable weaves and sweeps the casting slot', () => {
    const s = session();
    const snaps = slotSnaps(getLoadout(s), { mana: 5, castSlot: 1, castLeft: 0.1, castTime: 0.4 }, noTimers);
    expect(snaps[0]!.affordable).toBe(false);
    expect(snaps[1]!).toMatchObject({ affordable: true, casting: true, progress: 0.75 });
  });

  it('marks automatic weaves with a cooldown, and weaves that no longer fit with a warning', () => {
    const s = session();
    setWeave(s, 2, 'Pulse > Lob[Storm, Saturate]');
    setSpindle(s, 'heartwood');
    setWeave(s, 3, 'Cast > Bolt[Storm] { OnHit > Nova[Storm]; OnExpire > Lob[Fire] }');
    setSpindle(s, 'twig');
    const snaps = slotSnaps(getLoadout(s), idle, (i) =>
      i === 2 ? { cooldownLeft: 0.5, cooldownTotal: 2 } : noTimers(),
    );
    expect(snaps[2]).toMatchObject({ auto: true, cooldown: 0.25, name: 'Storm Lob', casting: false });
    expect(snaps[3]!.warn).toBe('Needs 11 Capacity; this spindle has 8');
    expect(snaps[3]!.cost).toBe(16.5);
  });

  it('feeds readSnap, and snapEqual sees slot changes', () => {
    const s = session();
    const a = readSnap(s.state, slotSnaps(getLoadout(s), idle, noTimers));
    expect(snapEqual(a, readSnap(s.state, slotSnaps(getLoadout(s), idle, noTimers)))).toBe(true);
    setWeave(s, 2, 'Cast > Lob[Fire]');
    expect(snapEqual(a, readSnap(s.state, slotSnaps(getLoadout(s), idle, noTimers)))).toBe(false);
  });
});
