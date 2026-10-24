/** Twin Threads in the app and UI: getLoadout's open slots, the HUD strip, the console, the Loom. */
import { describe, expect, it } from 'vitest';
import { Session } from '../../src/app/session';
import { getLoadout, setWeave } from '../../src/app/loadout';
import { slotSnaps, type CasterView } from '../../src/ui/hudSlots';
import { CommandRegistry } from '../../src/ui/console/commands';
import { registerM2Commands, type M2Env } from '../../src/ui/console/m2';
import { LoomState } from '../../src/ui/loom/loomState';
import { setLoadoutStorage } from '../../src/ui/loom/loadoutStore';
import { LOCKED_SLOT_MESSAGE, refreshHero } from '../../src/sim';

const session = (twin: boolean) => {
  const s = new Session({ seed: 1, roomId: 'test/arena', sceneId: 'arena', mode: 'arena' });
  if (twin) {
    s.state.hero.hearth.mutations.twin_threads = 1;
    refreshHero(s.state);
  }
  return s;
};
const idle: CasterView = { mana: 50, castSlot: -1, castLeft: 0, castTime: 0 };
const noTimers = () => ({ cooldownLeft: 0, cooldownTotal: 0 });

describe('Twin Threads: what the UI sees', () => {
  it('getLoadout lists four slots without the mutation and five (R last) with it', () => {
    expect(getLoadout(session(false)).slots.map((s) => s.label)).toEqual(['LMB', 'RMB', 'Q', 'E']);
    const l = getLoadout(session(true));
    expect(l.slots.map((s) => s.label)).toEqual(['LMB', 'RMB', 'Q', 'E', 'R']);
    expect(l.slots.map((s) => s.slot)).toEqual([0, 1, 2, 3, 4]);
  });

  it('the HUD strip follows the open slots', () => {
    expect(slotSnaps(getLoadout(session(false)), idle, noTimers)).toHaveLength(4);
    const s = session(true);
    expect(setWeave(s, 4, 'Cast > Lob[Fire]').applied).toBe(true);
    const snaps = slotSnaps(getLoadout(s), idle, noTimers);
    expect(snaps.map((x) => x.key)).toEqual(['LMB', 'RMB', 'Q', 'E', 'R']);
    expect(snaps[4]).toMatchObject({ slot: 4, key: 'R', name: 'Fire Lob', form: 'lob' });
  });

  it('setWeave on the locked slot is refused with the lock message and not recorded', () => {
    const s = session(false);
    const r = setWeave(s, 4, 'Cast > Lob[Fire]');
    expect(r.applied).toBe(false);
    expect(r.compiled?.ok === false && r.compiled.error.message).toBe(LOCKED_SLOT_MESSAGE);
    expect(s.loadoutEdits).toEqual([]);
  });

  it('console: weave 5 / weave r says the slot is locked, and works with the mutation', () => {
    setLoadoutStorage(null);
    for (const twin of [false, true]) {
      const reg = new CommandRegistry<M2Env>();
      registerM2Commands(reg);
      const env: M2Env = { session: session(twin) };
      const run = (line: string) => reg.execute(line, env);
      const r = run('weave 5 Cast > Lob[Fire]');
      expect(r.ok).toBe(twin);
      if (!twin) expect(r.lines.join('\n')).toBe(`R is locked: ${LOCKED_SLOT_MESSAGE}.`);
      else expect(r.lines[0]).toMatch(/^R: Cast > Lob\[Fire\]/);
      expect(run('weave r').ok).toBe(twin);
      expect(run('weaves').lines).toHaveLength(twin ? 6 : 5);
    }
  });

  it('the Loom edits the fifth slot only when it is open', () => {
    setLoadoutStorage(null);
    expect(new LoomState(session(false)).drafts.value).toHaveLength(4);
    const s = session(true);
    const st = new LoomState(s);
    expect(st.drafts.value).toHaveLength(5);
    st.selectSlot(4);
    st.loadNotation('Cast > Lob[Fire]');
    expect(s.state.weaves.slots[4]!.notation).toBe('Cast > Lob[Fire]');
    expect(st.status.kind).toBe('ok');
  });
});
