import { describe, expect, it } from 'vitest';
import {
  applyLoadoutEdit,
  Button,
  createGame,
  DEFAULT_LOADOUT,
  hashState,
  previewWeave,
  runFrames,
  setLoadoutSpindle,
  setSlotWeave,
  step,
  type InputFrame,
  type LoadoutEdit,
} from '../../../src/sim';
import { loadRoomText } from '../../../tools/lib/rooms';
import { arena } from './runtimeHelpers';

describe('weave slots in the sim', () => {
  it('start with Fire Bolt on LMB and Strike on RMB on the Twig Spindle', () => {
    const s = arena();
    expect(s.weaves.spindleId).toBe('twig');
    expect(s.weaves.slots.map((x) => x.notation)).toEqual([
      'Cast > Bolt[Fire]',
      'Cast > Strike[]',
      null,
      null,
      null,
    ]);
    expect(s.weaves.slots[0]!.program!.mana).toBeCloseTo(6.6, 12);
    expect(s.loadout).toEqual(['fire_bolt', 'strike', null, null, null]);
    expect(DEFAULT_LOADOUT.spindleId).toBe('twig');
  });

  it('setSlotWeave stores the canonical notation and rejects invalid weaves without changing the slot', () => {
    const s = arena();
    expect(setSlotWeave(s, 2, 'cast > bolt[storm,chain]').applied).toBe(true);
    expect(s.weaves.slots[2]!.notation).toBe('Cast > Bolt[Storm, Chain]');
    for (const bad of [
      'Cast > Bolt[Storm',
      'Cast > Nova[Fire, Pierce]',
      'Cast > Lob[Fire] > OnExpire > Nova[Fire, Wide] > OnHit > Bolt[]',
      'Shatter > Bolt[Fire]', // M7
    ]) {
      const r = setSlotWeave(s, 2, bad);
      expect(r.applied, bad).toBe(false);
      expect(
        r.preview.parseError ?? (r.preview.compiled?.ok === false && r.preview.compiled.error),
      ).toBeTruthy();
      expect(s.weaves.slots[2]!.notation).toBe('Cast > Bolt[Storm, Chain]');
      expect(s.weaves.slots[2]!.program).not.toBeNull();
    }
    expect(setSlotWeave(s, 2, null).applied).toBe(true);
    expect(s.weaves.slots[2]!.notation).toBeNull();
    expect(() => setSlotWeave(s, 5, null)).toThrow();
  });

  it('a spindle switch keeps weaves that no longer fit, with their error, and they come back when they fit', () => {
    const s = arena();
    setLoadoutSpindle(s, 'heartwood');
    expect(setSlotWeave(s, 0, 'Pulse > Orb[Fire, Wide] > Emit > Bolt[Fire, Seeker]').applied).toBe(true);
    setLoadoutSpindle(s, 'twig');
    const slot = s.weaves.slots[0]!;
    expect(slot.notation).toBe('Pulse > Orb[Fire, Wide] > Emit > Bolt[Fire, Seeker]');
    expect(slot.program).toBeNull();
    expect(slot.error).toBe('Needs 12 Capacity; this spindle has 8');
    expect(s.loadout[0]).toBeNull();
    expect(previewWeave(s, slot.notation!).compiled?.ok).toBe(false);
    setLoadoutSpindle(s, 'heartwood');
    expect(s.weaves.slots[0]!.program).not.toBeNull();
  });

  it('editing the slot being cast cancels the cast', () => {
    const s = arena();
    step(s, { moveX: 0, moveY: 0, aimX: 100, aimY: 60, buttons: Button.Cast1 });
    expect(s.player.castSlot).toBe(0);
    setSlotWeave(s, 0, 'Cast > Bolt[Frost]');
    expect(s.player.castSlot).toBe(-1);
    expect(s.events.some((e) => e.type === 'castCancel')).toBe(true);
  });

  it('runFrames applies recorded edits between ticks, reproducing a run with mid-run weave changes', () => {
    const room = loadRoomText('test/arena');
    const frames: InputFrame[] = [];
    for (let i = 0; i < 600; i++)
      frames.push({
        moveX: 0,
        moveY: 0,
        aimX: 120,
        aimY: 70,
        buttons: i % 120 < 60 ? Button.Cast1 : Button.Cast3,
      });
    const edits: LoadoutEdit[] = [
      { tick: 0, kind: 'spindle', value: 'heartwood' },
      { tick: 100, kind: 'weave', slot: 2, value: 'Cast > Lob[Fire] > OnExpire > Nova[Fire, Wide]' },
      { tick: 250, kind: 'weave', slot: 0, value: 'Cast > Bolt[Storm, Chain]' },
      { tick: 400, kind: 'spindle', value: 'twig' },
    ];
    const live = createGame({ seed: 3, roomText: room });
    let next = 0;
    for (const f of frames) {
      while (next < edits.length && edits[next]!.tick === live.tick) applyLoadoutEdit(live, edits[next++]!);
      step(live, f);
    }
    const replayed = runFrames(frames, room, { seed: 3, loadoutEdits: edits });
    expect(replayed.hash).toBe(hashState(live));
    expect(runFrames(frames, room, { seed: 3 }).hash).not.toBe(replayed.hash);
  });
});
