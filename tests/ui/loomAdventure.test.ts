import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Session } from '../../src/app/session';
import { getLoadout } from '../../src/app/loadout';
import { setLoadoutStorage } from '../../src/ui/loom/loadoutStore';
import { LoomState } from '../../src/ui/loom/loomState';
import { placements } from '../../src/ui/loom/model';
import { setFixtures } from '../../src/ui/fixtures/mode';
import { newGameHero } from '../../src/ui/fixtures/hero';
import { setFixtureHero } from '../../src/ui/fixtures/store';

beforeEach(() => {
  setLoadoutStorage(null);
  setFixtures(true);
  setFixtureHero(newGameHero());
});
afterEach(() => setLoadoutStorage(null));

describe('the Loom in adventure mode', () => {
  it('counts owned runes against the drafts and blocks runes with no free copy', () => {
    const s = new Session({ seed: 1, roomId: 'test/wilds', sceneId: 'adventure', mode: 'adventure' });
    const st = new LoomState(s);
    expect(Object.fromEntries(st.totals.value!)).toEqual({ cast: 2, bolt: 1, strike: 1, fire: 1 });
    // Bolt[Fire] in LMB and Strike[] in RMB use one of each, both Casts and the only Fire.
    expect(Object.fromEntries(st.free.value!)).toEqual({ cast: 0, bolt: 0, strike: 0, fire: 0 });
    st.selectSlot(1);
    const p = placements(st.draft, 'fire', st.editOpts);
    expect(p.length).toBeGreaterThan(0);
    expect(p.every((x) => !x.ok && x.reason === 'No free Fire rune')).toBe(true);
    // Taking Fire out of LMB frees it for RMB's Strike.
    st.selectSlot(0);
    st.remove(['root', 'i0']);
    expect(st.free.value!.get('fire')).toBe(1);
    st.selectSlot(1);
    expect(placements(st.draft, 'fire', st.editOpts).some((x) => x.ok)).toBe(true);
  });

  it('keeps the unlimited pouch outside adventure mode', () => {
    const s = new Session({ seed: 1, roomId: 'test/arena', sceneId: 'arena', mode: 'arena' });
    const st = new LoomState(s);
    expect(st.totals.value).toBeNull();
    expect(st.free.value).toBeNull();
    expect(placements(st.draft, 'frost', st.editOpts).some((x) => x.ok)).toBe(true);
    expect(getLoadout(s).slots[0]!.notation).toBe('Cast > Bolt[Fire]');
  });
});
