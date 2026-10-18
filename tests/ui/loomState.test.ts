import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Session } from '../../src/app/session';
import { getLoadout } from '../../src/app/loadout';
import { applyWeave, setLoadoutStorage } from '../../src/ui/loom/loadoutStore';
import { LoomState } from '../../src/ui/loom/loomState';
import { parseWeave } from '../../src/sim/weave';
import { referenceWeaves } from '../../src/sim/weave/referenceWeaves';

const session = () => new Session({ seed: 1, roomId: 'test/arena', sceneId: 'arena', mode: 'arena' });
beforeEach(() => setLoadoutStorage(null));
afterEach(() => setLoadoutStorage(null));

describe('LoomState', () => {
  const tree = (n: string) => {
    const p = parseWeave(n);
    if (!p.ok) throw new Error(n);
    return p.tree;
  };

  it('applies a valid draft at once and holds an invalid one without touching the slot', () => {
    const s = session();
    const st = new LoomState(s);
    st.selectSlot(2);
    st.setDraft(tree('Cast > Lob[Fire]'));
    expect(getLoadout(s).slots[2]!.notation).toBe('Cast > Lob[Fire]');
    expect(st.status).toMatchObject({ kind: 'ok', applied: true });
    st.setDraft(tree('Cast > Nova[Fire, Pierce]'));
    expect(getLoadout(s).slots[2]!.notation).toBe('Cast > Lob[Fire]');
    expect(st.status).toMatchObject({
      kind: 'invalid',
      message: "Nova can't take Pierce",
      path: ['root', 'i1'],
    });
    st.revert();
    expect(st.status.kind).toBe('ok');
  });

  it('marks a live weave that stops fitting after a spindle switch, and applies held drafts that start fitting', () => {
    const s = session();
    const st = new LoomState(s);
    st.setDraft(tree(referenceWeaves[12]!.notation));
    expect(st.status).toMatchObject({ kind: 'invalid', applied: false, path: [] });
    expect(getLoadout(s).slots[0]!.notation).toBe('Cast > Bolt[Fire]');
    st.setSpindle('heartwood');
    expect(getLoadout(s).slots[0]!.notation).toBe(referenceWeaves[12]!.notation);
    expect(st.status.kind).toBe('ok');
    st.setSpindle('twig');
    expect(st.status).toMatchObject({
      kind: 'invalid',
      applied: true,
      message: 'Needs 11 Capacity; this spindle has 8',
    });
  });

  it('follows the notation line while it parses, and empties a slot when everything is removed', () => {
    const s = session();
    const st = new LoomState(s);
    st.typeNotation('Cast > Bolt[Storm');
    expect(st.parseError.value?.index).toBe(17);
    expect(getLoadout(s).slots[0]!.notation).toBe('Cast > Bolt[Fire]');
    st.typeNotation('Cast > Bolt[Storm]');
    expect(st.parseError.value).toBeNull();
    expect(getLoadout(s).slots[0]!.notation).toBe('Cast > Bolt[Storm]');
    st.clearSlot();
    expect(getLoadout(s).slots[0]!.notation).toBeNull();
  });

  it('picks up loadout changes made elsewhere unless a draft is held', () => {
    const s = session();
    const st = new LoomState(s);
    applyWeave(s, 1, 'Cast > Beam[Frost]');
    st.syncFromLoadout();
    expect(st.drafts.value[1]).toEqual(tree('Cast > Beam[Frost]'));
  });
});
