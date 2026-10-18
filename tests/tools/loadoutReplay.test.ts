import { describe, expect, it } from 'vitest';
import { getLoadout, previewWeave, setSpindle, setWeave, slotTimers } from '../../src/app/loadout';
import { makeReplay } from '../../src/app/replay';
import { parseReplay } from '../../src/app/replayFormat';
import { Session } from '../../src/app/session';
import { Button, findScenario, spawnEnemy } from '../../src/sim';
import { checkReplay } from '../../tools/lib/replay';

function session(): Session {
  return new Session({ seed: 4, roomId: 'test/arena', sceneId: 'arena', mode: 'arena' });
}

describe('Loom loadout contract (src/app/loadout.ts)', () => {
  it('reads the slots from sim state', () => {
    const s = session();
    const v = getLoadout(s);
    expect(v.spindleId).toBe('twig');
    expect(v.capacity).toBe(8);
    expect(v.slots.map((x) => [x.label, x.notation, x.compiled?.ok, x.automatic])).toEqual([
      ['LMB', 'Cast > Bolt[Fire]', true, false],
      ['RMB', 'Cast > Strike[]', true, false],
      ['Q', null, undefined, false],
      ['E', null, undefined, false],
    ]);
  });

  it('setWeave applies valid weaves to the sim, records them, and rejects invalid ones', () => {
    const s = session();
    const r = setWeave(s, 3, 'OnDodge > Nova[Frost]');
    expect(r.applied).toBe(true);
    expect(r.view).toMatchObject({ slot: 3, label: 'E', notation: 'OnDodge > Nova[Frost]', automatic: true });
    expect(s.state.weaves.slots[3]!.program).not.toBeNull();
    const bad = setWeave(s, 3, 'Cast > Nova[Fire, Pierce]');
    expect(bad.applied).toBe(false);
    expect(bad.compiled?.ok === false && bad.compiled.error.message).toBe("Nova can't take Pierce");
    expect(bad.view.notation).toBe('OnDodge > Nova[Frost]');
    expect(setWeave(s, 3, 'Cast > Bolt[').parseError).toBeDefined();
    expect(s.loadoutEdits).toEqual([{ tick: 0, kind: 'weave', slot: 3, value: 'OnDodge > Nova[Frost]' }]);
    expect(s.edited).toBe(false);
    expect(previewWeave(s, 'Cast > Bolt[Fire, Split, Pierce]').compiled?.ok).toBe(true);
  });

  it('slotTimers shows the ICD after an event trigger fires and the Pulse period', () => {
    const s = session();
    setWeave(s, 2, 'OnDodge > Nova[Frost]');
    setWeave(s, 3, 'Pulse > Bolt[Fire]');
    expect(slotTimers(s.state, 2)).toEqual({ cooldownLeft: 0, cooldownTotal: 0 });
    const p = s.state.player;
    spawnEnemy(s.state, 'dummy', p.x + 10, p.y);
    s.step({ moveX: 1, moveY: 0, aimX: p.x + 10, aimY: p.y, buttons: Button.Dodge });
    expect(slotTimers(s.state, 2).cooldownTotal).toBe(0.5);
    expect(slotTimers(s.state, 2).cooldownLeft).toBeCloseTo(0.5, 9);
    expect(slotTimers(s.state, 3).cooldownTotal).toBe(2);
    expect(slotTimers(s.state, 3).cooldownLeft).toBeCloseTo(2 - 1 / 60, 9);
    expect(slotTimers(s.state, 0)).toEqual({ cooldownLeft: 0, cooldownTotal: 0 });
  });

  it('a replay with mid-run Loom edits reproduces its hash, and a reset keeps the weaves', () => {
    const s = session();
    const bot = findScenario('arena_bot')!;
    for (let i = 0; i < 900; i++) {
      if (i === 120) setSpindle(s, 'heartwood');
      if (i === 200) setWeave(s, 2, 'Pulse > Orb[Fire, Wide] > Emit > Bolt[Fire, Seeker]');
      if (i === 450) setWeave(s, 0, 'Cast > Bolt[Storm, Chain]');
      if (i === 600) setWeave(s, 2, null);
      s.step(bot.input(s.state.tick, s.state));
    }
    expect(s.loadoutEdits.map((e) => e.tick)).toEqual([120, 200, 450, 600]);
    const file = parseReplay(JSON.stringify(makeReplay(s)));
    expect(file.cheatsEdited).toBe(false);
    const r = checkReplay(file);
    expect(r.match).toBe(true);
    // Without the edits it diverges.
    expect(checkReplay({ ...file, loadoutEdits: [] }).match).toBe(false);

    s.reset({ seed: 9 });
    expect(s.state.weaves.spindleId).toBe('heartwood');
    expect(s.state.weaves.slots[0]!.notation).toBe('Cast > Bolt[Storm, Chain]');
    expect(s.loadoutEdits).toEqual([]);
    for (let i = 0; i < 300; i++) s.step(bot.input(s.state.tick, s.state));
    expect(checkReplay(parseReplay(JSON.stringify(makeReplay(s)))).match).toBe(true);
  });
});
